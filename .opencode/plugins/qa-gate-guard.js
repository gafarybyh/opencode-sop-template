// qa-gate-guard — reminds the agent to run the design gate before claiming done.
//
// It surfaces a one-line reminder by prepending `echo "<msg>" ; ` to the next
// shell command when the UI changed since the last clean qa-gate run. This is
// the same, proven mechanism as the global graphify plugin: it needs no extra
// API and the agent sees the line in tool output.
//
// What it catches: "handoff without running the gate" — the failure mode where
// an agent says a UI is done having only eyeballed it. It does NOT force a run
// (a plugin cannot), it makes skipping visible and points at the one command.
//
// Scope honesty: the gate is QUALITY_GATE G4 (design floor) only. The reminder
// says so, so nobody mistakes "qa-gate PASS" for "all gates pass".
//
// No opencode package is imported on purpose: a plain file in
// .opencode/plugins/ cannot resolve "@opencode/plugin". Keep the reminder free
// of backticks and $(...) so the echoed PowerShell string never executes.
import { existsSync, readdirSync, statSync, readFileSync } from "fs";
import { join } from "path";

const UI_EXT = new Set([".html", ".css", ".jsx", ".tsx", ".vue", ".svelte", ".astro"]);
const SKIP_DIR = new Set(["node_modules", "dist", "build", "coverage", "graphify-out"]);
const MAX_ENTRIES = 20000;
const SCAN_TTL_MS = 2000;

function newestUiMtime(dir) {
  let newest = 0;
  let seen = 0;
  const stack = [dir];
  while (stack.length && seen < MAX_ENTRIES) {
    const d = stack.pop();
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (++seen > MAX_ENTRIES) break;
      if (e.isDirectory()) {
        if (e.name.startsWith(".") || SKIP_DIR.has(e.name)) continue;
        stack.push(join(d, e.name));
      } else if (e.isFile()) {
        const dot = e.name.lastIndexOf(".");
        if (dot < 0) continue;
        if (!UI_EXT.has(e.name.slice(dot).toLowerCase())) continue;
        try {
          const m = statSync(join(d, e.name)).mtimeMs;
          if (m > newest) newest = m;
        } catch {
          /* ignore unreadable file */
        }
      }
    }
  }
  return newest;
}

function readStatus(root) {
  const p = join(root, ".opencode", "gate-status.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

// Shared logic for the OpenCode 2 (setup) and OpenCode 1 (server) runtimes.
function makeGuard(root) {
  const lastReminded = new Map(); // key -> ui-mtime that already produced a reminder
  let cache = { t: 0, newest: 0 };

  const newest = () => {
    const now = Date.now();
    if (now - cache.t < SCAN_TTL_MS) return cache.newest;
    const n = newestUiMtime(root);
    cache = { t: now, newest: n };
    return n;
  };

  // Returns { reason, stamp } when a reminder is due for this key, else null.
  const due = (key) => {
    const n = newest();
    if (n === 0) return null; // no UI files in this project
    const st = readStatus(root);
    let reason = null;
    if (!st) reason = "no design gate has run in this project";
    else if (!st.ok) reason = "the last design gate FAILED";
    else {
      const gateAt = Date.parse(st.at) || 0;
      if (n > gateAt + 1000) reason = "UI changed since the last clean design gate";
    }
    if (!reason) return null;
    const prev = lastReminded.get(key) || 0;
    if (n <= prev) return null; // already reminded for this edit burst
    lastReminded.set(key, n);
    return { reason, stamp: n };
  };

  const reminder = (reason) =>
    "[qa-gate] " + reason + ". Before claiming done, run node .opencode/scripts/qa-gate.mjs and confirm it prints PASS and exits 0. Design floor G4 only. ";

  return { due, reminder };
}

const hasOpencode = (dir) => existsSync(join(dir, ".opencode"));

export default {
  id: "qa-gate-guard",

  // OpenCode 2: command tool is "shell"; one server outlives many sessions.
  async setup(ctx) {
    try {
      const root = ctx.location.directory;
      if (!hasOpencode(root)) return;
      const guard = makeGuard(root);
      await ctx.tool.hook("execute.before", (event) => {
        if (event.tool !== "shell" || typeof event.input?.command !== "string") return;
        if (event.input.command.includes("qa-gate.mjs")) return; // running the gate is the fix
        const v = guard.due(event.sessionID);
        if (!v) return;
        event.input = { ...event.input, command: 'echo "' + guard.reminder(v.reason) + '" ; ' + event.input.command };
      });
    } catch {
      /* a guard must never break the run */
    }
  },

  // OpenCode 1: command tool is "bash"; server lives per session.
  async server({ directory }) {
    if (!hasOpencode(directory)) return {};
    const guard = makeGuard(directory);
    return {
      "tool.execute.before": async (input, output) => {
        try {
          if (input.tool !== "bash" || typeof output.args?.command !== "string") return;
          if (output.args.command.includes("qa-gate.mjs")) return;
          const v = guard.due(directory);
          if (!v) return;
          output.args.command = 'echo "' + guard.reminder(v.reason) + '" ; ' + output.args.command;
        } catch {
          /* never break the run */
        }
      },
    };
  },
};
