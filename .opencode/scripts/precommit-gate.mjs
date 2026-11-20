#!/usr/bin/env node
/**
 * precommit-gate.mjs — block a commit that touches UI without a fresh clean gate.
 *
 * Safety rule (no false blocks): act ONLY when the staged change touches a
 * lint-relevant file (html/css/jsx/tsx/vue/svelte/astro). Code-only commits
 * (Node API, docs, config) pass straight through, so this is safe on any repo.
 *
 * When UI is staged it requires .opencode/gate-status.json to be a clean pass
 * whose inputHash matches the CURRENT tree — i.e. qa-gate ran AFTER the last
 * edit. Stale/missing/failed => exit 1 with the exact command to run.
 *
 * Exit: 0 allow · 1 block.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative, isAbsolute } from "node:path";
import { hashInputs } from "./lib-gate-hash.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const UI = /\.(html|css|jsx|tsx|vue|svelte|astro)$/i;

// Files staged for commit (added/copied/modified/renamed).
const staged = spawnSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
  cwd: root,
  encoding: "utf8",
});
if (staged.status !== 0) {
  console.error("precommit-gate: git not available; allowing commit.");
  process.exit(0);
}
const uiStaged = staged.stdout.split(/\r?\n/).filter((f) => UI.test(f));

if (uiStaged.length === 0) process.exit(0); // no UI touched -> not this gate's business

const block = (why) => {
  console.error("");
  console.error(`precommit-gate: BLOCKED — ${why}`);
  console.error(`  UI files staged: ${uiStaged.slice(0, 6).join(", ")}${uiStaged.length > 6 ? " …" : ""}`);
  console.error("  Run:  node .opencode/scripts/qa-gate.mjs");
  console.error("  Fix every FAIL, then commit again. A --static run is a recorded waiver and will NOT satisfy this hook.");
  console.error("");
  process.exit(1);
};

const statusPath = join(root, ".opencode", "gate-status.json");
if (!existsSync(statusPath)) block("no design gate has run (gate-status.json missing)");

let st;
try {
  st = JSON.parse(readFileSync(statusPath, "utf8"));
} catch {
  block("gate-status.json is unreadable");
}

if (st.tool !== "qa-gate") block("gate-status.json was not written by qa-gate");
if (st.ok !== true) block(`the last design gate did not pass (ok=${st.ok}, fails=${st.fails})`);

// Render honesty, enforced: a --static run reports ok:true but renderRan:false.
// It is a handoff waiver, NOT proof the page renders. Committing UI on it would
// let the design floor be bypassed silently, so require a real render here.
// Escape hatch is explicit and logged: PRECOMMIT_ALLOW_STATIC=1 (CI stays the backstop).
if (st.renderRan !== true) {
  if (process.env.PRECOMMIT_ALLOW_STATIC === "1") {
    console.error("precommit-gate: WARNING — committing on a static-only gate (PRECOMMIT_ALLOW_STATIC=1).");
    console.error("  The render tier did NOT run; page-only gates (overflow/sticky/fold) are unverified.");
  } else {
    block("the last design gate was static-only (render tier did not run) — not valid evidence for a UI commit");
  }
}

const current = hashInputs([root], root);

// Compare against the SAME scope qa-gate was run on, not blindly the whole root.
// qa-gate <path> hashes only <path>, so hashing the root here false-blocked a
// clean gate on multi-folder repos. But a scoped gate must not license unrelated
// UI: every staged UI file has to live inside the gate's target. Gate the root
// (default) and both checks are the whole tree — the strictest, correct case.
const targets = Array.isArray(st.targets) && st.targets.length ? st.targets : ["."];
const norm = (p) => resolve(root, p).replace(/\\/g, "/");
const coversRoot = targets.some((t) => resolve(root, t) === root);
const gateHash = coversRoot ? current.hash : hashInputs(targets.map((t) => resolve(root, t)), root).hash;

if (st.inputHash !== gateHash) {
  block("UI changed since the last clean gate (stale PASS)");
}

const outside = uiStaged.filter((f) => !targets.some((t) => {
  const abs = norm(f);
  const dir = norm(t);
  return abs === dir || abs.startsWith(dir + "/");
}));
if (outside.length) {
  block(`the clean gate covered ${targets.join(", ")}, but these staged UI files are outside it: ${outside.slice(0, 6).join(", ")}`);
}

console.log(`precommit-gate: OK — design gate clean (${st.fails} FAIL, ${st.reflex} REFLEX), inputs match.`);
process.exit(0);
