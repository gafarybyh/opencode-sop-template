#!/usr/bin/env node
/**
 * qa-gate.mjs — one command = the mechanical design gate (QUALITY_GATE G4).
 *
 * Runs Hallmark sloplint (static CSS + rendered DOM) over the UI files and
 * exits non-zero on any FAIL/REFLEX, so "done" is falsifiable in a single
 * command instead of a paragraph of prose. Writes .opencode/gate-status.json
 * so the qa-gate-guard hook, the reviewer, or CI can tell whether the gate
 * actually ran after the latest UI change.
 *
 * Scope note (honest): this is G4 (design floor) only. It does NOT replace
 * G1 correctness, G3 tests, G5 four-viewport screenshots, or G6 a11y/perf.
 * "qa-gate PASS" means "design floor clean", not "SOP done".
 *
 * Render honesty: by default the render tier is REQUIRED. If Chrome/puppeteer
 * is missing it cannot run, so the gate reports INCOMPLETE and exits 3 — never
 * a clean PASS with page-only gates (34/56) silently skipped. To accept
 * static-only on purpose, pass --static; that is recorded as a waiver
 * (WAIVED G4 render) in gate-status.json so the handoff can name it.
 *
 * Usage:
 *   node .opencode/scripts/qa-gate.mjs [target ...] [--static] [-- <flags>]
 *     no target  -> the project root
 *     a path     -> lint just that folder/file
 *     --static   -> accept static-only (no --render); recorded as a waiver
 *     --genre x  -> forwarded to sloplint (any other leading-dash flag too)
 *
 * Exit: 0 clean · 1 slop found · 2 cannot run · 3 render tier did not run.
 */
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { hashInputs } from "./lib-gate-hash.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", ".."); // <root>/.opencode/scripts/qa-gate.mjs -> <root>
const slop = join(root, ".opencode", "skills", "hallmark", "scripts", "sloplint.mjs");
const statusPath = join(root, ".opencode", "gate-status.json");

const die = (msg, code = 2) => {
  console.error(`qa-gate: ${msg}`);
  process.exit(code);
};

if (!existsSync(slop)) die(`sloplint not found at ${slop} (is the hallmark skill installed?)`);

const argv = process.argv.slice(2);
const staticOnly = argv.includes("--static");
const targets = argv.filter((a) => !a.startsWith("-"));
const passthrough = argv.filter((a) => a.startsWith("-") && a !== "--static");
const scan = targets.length ? targets.map((t) => resolve(root, t)) : [root];

// sloplint resolves puppeteer via `npm root -g`; hand it a Chrome if we can find one.
const env = { ...process.env };
if (!env.CHROME_PATH) {
  const guesses = [
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
    process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
    process.env["PROGRAMFILES(X86)"] && join(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const found = guesses.find((p) => existsSync(p));
  if (found) env.CHROME_PATH = found;
}

const rel = (p) => (p === root ? "." : p);
const slopArgs = [slop, ...scan, "--scope", "app", ...(staticOnly ? [] : ["--render"]), "--json", ...passthrough];
console.log(`qa-gate: sloplint ${staticOnly ? "(static only)" : "--render"} --scope app  ${scan.map(rel).join(" ")}`);

const r = spawnSync(process.execPath, slopArgs, { encoding: "utf8", env });
const code = typeof r.status === "number" ? r.status : 2;
const raw = (r.stdout || "").trim();

if (code === 2 && !raw) {
  const tail = (r.stderr || "sloplint could not run").trim().split("\n").slice(-1)[0];
  die(tail, 2);
}

let summary = { fails: null, reflex: null, warns: null, files: 0, render: "unknown" };
let findings = [];
if (raw) {
  try {
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const j = JSON.parse(json);
    summary = j.summary || summary;
    findings = Array.isArray(j.findings) ? j.findings : [];
  } catch {
    /* sloplint printed non-JSON (e.g. "no files found"); defaults stand */
  }
}

const num = (v, d) => (Number.isFinite(v) ? v : d);
const fails = num(summary.fails, code === 0 ? 0 : -1);
const reflex = num(summary.reflex, 0);
const warns = num(summary.warns, 0);
const render = typeof summary.render === "string" ? summary.render : "unknown";
const renderRan = !staticOnly && render !== "off" && !render.startsWith("not run");
const incomplete = !staticOnly && !renderRan; // render was required but did not run
const ok = code === 0 && !incomplete;

// Show the worst findings so the fix is obvious without re-running.
const rank = { FAIL: 0, REFLEX: 1 };
const shown = findings
  .filter((f) => f.grade === "FAIL" || f.grade === "REFLEX")
  .sort((a, b) => (rank[a.grade] ?? 9) - (rank[b.grade] ?? 9))
  .slice(0, 20);
for (const f of shown) {
  const where = f.file ? `${f.file}${f.line ? ":" + f.line : ""}` : "?";
  const fix = f.fix ? ` | fix: ${f.fix}` : "";
  console.log(`  ${f.grade} ${f.gate ?? ""} ${where} ${f.evidence ?? ""}${fix}`.trimEnd());
}

const inputHash = hashInputs(scan, root);

const status = {
  tool: "qa-gate",
  v: 2,
  at: new Date().toISOString(),
  ok,
  exit: incomplete ? 3 : code,
  scope: "app",
  files: num(summary.files, scan.length),
  fails,
  reflex,
  warns,
  render,
  renderRan,
  staticOnly,
  incomplete,
  inputHash: inputHash.hash,
  inputFiles: inputHash.files,
  targets: scan.map(rel),
  findings: shown.map((f) => ({ gate: f.gate, grade: f.grade, file: f.file, line: f.line, evidence: f.evidence })),
};
try {
  mkdirSync(dirname(statusPath), { recursive: true });
  writeFileSync(statusPath, JSON.stringify(status, null, 2) + "\n");
} catch {
  /* status file is best-effort; the exit code is the real signal */
}

console.log("");
if (incomplete) {
  console.log(`qa-gate: INCOMPLETE — render tier did NOT run (${render}).`);
  console.log(`         Page-only gates (34 overflow, 56 sticky, hero fold) are UNCHECKED.`);
  console.log(`         Install Chrome, or accept static-only with: node .opencode/scripts/qa-gate.mjs --static`);
  console.log(`         (record WAIVED G4 render in the handoff). Not a clean pass.`);
} else if (staticOnly) {
  console.log(`qa-gate: PASS (static only, WAIVED G4 render — page-only gates 34/56 not checked)  (${fails} FAIL, ${reflex} REFLEX, ${warns} WARN)`);
} else {
  console.log(`qa-gate: ${ok ? "PASS" : "FAIL"}  (${fails} FAIL, ${reflex} REFLEX, ${warns} WARN)  -> ${statusPath}`);
}
process.exit(incomplete ? 3 : code);
