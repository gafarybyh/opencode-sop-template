#!/usr/bin/env node
/**
 * qa-api.mjs — one command = the mechanical backend gate (G3 + G6b-for-API).
 *
 * Frontend gates (qa-gate, qa-perf) cannot see a server. This runs the backend's
 * own tests + coverage, boots the REAL HTTP server on an ephemeral port and hits
 * a declared smoke contract, and scans source for hardcoded secrets. It turns
 * "the API works" into an exit code instead of an assertion.
 *
 * It is project-agnostic and polyglot: point --dir at a backend that has a
 * qa-api.config.json declaring how to start it, how to run tests/coverage and
 * what to smoke (format: .opencode/sops/stacks/_backend.md). The config's
 * `framework` (node|python) only selects the default commands and the output
 * parser; any stack that prints "N passed, M failed" and a coverage number works.
 *
 * Honesty: a missing test runner, a server that never becomes ready, or a smoke
 * check that cannot run is INCOMPLETE (exit 3) — never a silent PASS. If the
 * runner's pass count cannot be read, that is INCOMPLETE too, not "0 failed".
 *
 * Usage: node .opencode/scripts/qa-api.mjs [--dir server] [--coverage-min 70]
 *        [--python <path-to-python>]   (override the interpreter; default: python)
 * Exit: 0 pass · 1 a check failed · 2 cannot run · 3 measurement incomplete.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { hashWithExts } from "./lib-gate-hash.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const statusPath = join(root, ".opencode", "api-status.json");
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const targetDir = resolve(root, opt("--dir", "server"));
const cfgPath = join(targetDir, "qa-api.config.json");
const writeStatus = (obj) => { try { mkdirSync(dirname(statusPath), { recursive: true }); writeFileSync(statusPath, JSON.stringify(obj, null, 2) + "\n"); } catch { /* best effort */ } };
const die = (m, code = 2) => { console.error(`qa-api: ${m}`); process.exit(code); };

if (!existsSync(cfgPath)) die(`no ${cfgPath}. A backend gate needs a smoke contract.`, 2);
let cfg;
try { cfg = JSON.parse(readFileSync(cfgPath, "utf8")); } catch (e) { die(`cannot parse ${cfgPath}: ${e.message}`, 2); }
const COV_MIN = Number(opt("--coverage-min", cfg.coverageMin ?? 70));
const FRAMEWORK = (cfg.framework || "node").toLowerCase();
const nodeExe = process.execPath;
const PYTHON_BIN = opt("--python", cfg.python || (process.platform === "win32" ? "python" : "python3"));

// Map a config command array to the real executable for this machine.
const cmdOf = (arr) => {
  if (!arr || !arr.length) return arr;
  const head = arr[0];
  if (head === "node") return [nodeExe, ...arr.slice(1)];
  // A python command: honour the configured/overridden interpreter.
  if (head === "python" || head === "python3" || head === "py") return [PYTHON_BIN, ...arr.slice(1)];
  // On Windows, bare package-manager names need their .cmd shim when not run via a shell.
  if (process.platform === "win32" && ["npm", "npx", "pnpm", "yarn"].includes(head)) return [head + ".cmd", ...arr.slice(1)];
  return arr;
};

// Default commands per framework (only used when the config omits them). No
// extra -q: a project-level `addopts = "-q"` plus our -q would become -qq and
// hide the "N passed" summary the parser needs.
const DEFAULT_TEST = FRAMEWORK === "python" ? ["python", "-m", "pytest"] : ["node", "--test"];
const DEFAULT_COVERAGE = FRAMEWORK === "python"
  ? ["python", "-m", "pytest", "--cov=.", "--cov-report=term"]
  : ["node", "--test", "--experimental-test-coverage"];

function runCmd(arr, extraEnv = {}) {
  return new Promise((res) => {
    const [cmd, ...args] = cmdOf(arr);
    const p = spawn(cmd, args, { cwd: targetDir, env: { ...process.env, ...extraEnv }, shell: false });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d.toString("utf8")));
    p.stderr.on("data", (d) => (err += d.toString("utf8")));
    p.on("close", (code) => res({ code, out, err }));
    p.on("error", (e) => res({ code: -1, out, err: String(e) }));
  });
}

// Parse "N passed" and "M failed" from the common runners:
//   node --test : "# pass 12" / "# fail 0"
//   pytest      : "12 passed, 1 failed in 0.5s"  (pytest -q also prints this)
//   vitest/jest : "Tests  12 passed" / "Tests: 1 failed, 12 passed"
function parseCounts(text) {
  const t = text || "";
  let pass = null, fail = null;
  let m = /(?:#|\u2139)\s*pass (\d+)/.exec(t); if (m) pass = Number(m[1]);
  m = /(?:#|\u2139)\s*fail (\d+)/.exec(t); if (m) fail = Number(m[1]);
  if (pass === null) { m = /\b(\d+)\s+passed\b/.exec(t); if (m) pass = Number(m[1]); }
  if (fail === null) { m = /\b(\d+)\s+failed\b/.exec(t); if (m) fail = Number(m[1]); }
  return { pass, fail };
}

// Parse a coverage percentage from the common reporters:
//   node --test : "all files | 96.9 | ..."
//   pytest-cov  : "TOTAL  2535  1137  55%"
//   vitest/jest : "All files | 88.5 |"  /  "Statements   : 88.5%"
function parseCoverage(text) {
  const t = text || "";
  let m = /all files\s*\|\s*([\d.]+)/i.exec(t); if (m) return Number(m[1]);
  m = /^TOTAL\s+.*?\s([\d.]+)%/m.exec(t); if (m) return Number(m[1]);
  m = /All files\s*\|\s*([\d.]+)/.exec(t); if (m) return Number(m[1]);
  m = /Statements\s*:\s*([\d.]+)%/.exec(t); if (m) return Number(m[1]);
  return null;
}

function freePort() {
  return new Promise((res, rej) => {
    const s = createServer();
    s.once("error", rej);
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); });
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Only hand the server a throwaway DB when the config actually uses ${DB_PATH};
// otherwise DB_PATH is meaningless (a Node/sqlite app may honour it, a Python
// app with its own data dir does not, and a stray env var can surprise it).
function smokeEnv(port, tmpDb) {
  const base = { PORT: String(port), ...(cfg.env || {}) };
  const usesDbPath = JSON.stringify(cfg.env || {}).includes("${DB_PATH}") || (cfg.start || []).some((s) => String(s).includes("${DB_PATH}"));
  if (usesDbPath) base.DB_PATH = tmpDb;
  return base;
}

async function httpSmoke() {
  if (!cfg.start) return { incomplete: "config has no 'start' command" };
  const port = await freePort();
  const tmpDb = join(tmpdir(), `qa-api-${port}-${Date.now()}.db`);
  const env = smokeEnv(port, tmpDb);
  const [cmd, ...args] = cmdOf(cfg.start.map((s) => String(s).replace(/\$\{PORT\}/g, String(port)).replace(/\$\{DB_PATH\}/g, tmpDb)));
  const child = spawn(cmd, args, { cwd: targetDir, env: { ...process.env, ...env }, shell: false });
  let bootLog = "";
  child.stdout.on("data", (d) => (bootLog += d.toString("utf8")));
  child.stderr.on("data", (d) => (bootLog += d.toString("utf8")));
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      try { const r = await fetch(baseUrl + (cfg.readyPath || "/")); if (r.status < 500) { ready = true; break; } } catch { /* not up yet */ }
      await sleep(200);
    }
    if (!ready) return { incomplete: "server did not become ready in 10s", bootLog: bootLog.slice(0, 400) };
    const results = [];
    for (const s of cfg.smoke || []) {
      const init = { method: s.method || "GET" };
      if (s.body !== undefined) { init.headers = { "content-type": "application/json" }; init.body = JSON.stringify(s.body); }
      let status = 0;
      try { const r = await fetch(baseUrl + s.path, init); status = r.status; } catch { status = 0; }
      results.push({ method: s.method || "GET", path: s.path, expect: s.expect, got: status, pass: status === s.expect });
    }
    return { results };
  } finally {
    child.kill();
    await new Promise((r) => setTimeout(r, 150));
    try { const fs = await import("node:fs"); if (fs.existsSync(tmpDb)) fs.rmSync(tmpDb, { force: true }); } catch { /* best effort on Windows file lock */ }
  }
}

function secretScan() {
  const findings = [];
  const re = /(password|secret|token|api[_-]?key)\s*[:=]\s*["'][^"']{6,}["']/i;
  const allow = cfg.secretScanAllow || [];
  const SKIP = ["node_modules", "data", "test", "tests", "__tests__", "venv", ".venv", "__pycache__", "build", "dist"];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) { if (!SKIP.includes(name)) walk(p); continue; }
      if (!/\.(mjs|js|ts|cjs|py)$/.test(name)) continue;
      // Test files hold fixtures, not real secrets; the gate is about shipped code.
      if (/\.(test|spec)\./.test(name) || /^test_.*\.py$/.test(name)) continue;
      const rel = p.slice(targetDir.length + 1).replace(/\\/g, "/");
      if (allow.some((a) => rel.endsWith(a))) continue;
      const lines = readFileSync(p, "utf8").split("\n");
      lines.forEach((ln, i) => {
        if (!re.test(ln)) return;
        if (/process\.env|os\.environ|os\.getenv/.test(ln)) return;
        findings.push(`${rel}:${i + 1}: ${ln.trim().slice(0, 80)}`);
      });
    }
  };
  try { walk(targetDir); } catch { /* ignore */ }
  return findings;
}

// --- run -------------------------------------------------------------------
const checks = [];
const push = (name, pass, detail) => checks.push({ name, pass, detail });

console.log(`qa-api: ${targetDir}  (framework=${FRAMEWORK}, coverage>=${COV_MIN}%)`);

// 1) tests
const testCmd = cfg.test || DEFAULT_TEST;
let tr = await runCmd(testCmd);
let tc = parseCounts(tr.out);
// Robustness: a project pytest addopts (e.g. "-q") can hide the summary line,
// and stacking our own -q would make it -qq. If the count is unreadable on a
// Python backend, retry once with pytest's addopts neutralised so "N passed"
// prints. An unreadable count stays INCOMPLETE (exit 3), never "0 failed".
if (tc.pass === null && FRAMEWORK === "python" && !testCmd.includes("-o")) {
  tr = await runCmd([...testCmd, "-o", "addopts="]);
  tc = parseCounts(tr.out);
}
if (tc.pass === null) {
  console.error("qa-api: INCOMPLETE — could not read a 'N passed' line from the test runner.");
  console.error("  Set cfg.test to the exact command; it must print 'N passed' (pytest/vitest/jest/node --test all do).");
  console.error((tr.out + tr.err).slice(-500));
  writeStatus({ tool: "qa-api", ok: false, incomplete: true, reason: "test pass-count unreadable", at: new Date().toISOString() });
  process.exit(3);
}
const tPass = tc.pass;
const tFail = tc.fail ?? 0;
push("tests", tr.code === 0 && tFail === 0 && tPass > 0, `${tPass} passed, ${tFail} failed`);

// 2) coverage
const covCmd = cfg.coverage || DEFAULT_COVERAGE;
let cr = await runCmd(covCmd);
let cov = parseCoverage(cr.out);
if (cov === null && FRAMEWORK === "python" && !covCmd.includes("-o")) {
  cr = await runCmd([...covCmd, "-o", "addopts="]);
  cov = parseCoverage(cr.out);
}
push("coverage", cov !== null && cov >= COV_MIN, cov === null ? "coverage not reported" : `${cov}% line (min ${COV_MIN}%)`);

// 3) http smoke (real server over a real socket)
const smoke = await httpSmoke();
if (smoke.incomplete) {
  console.error(`qa-api: INCOMPLETE — ${smoke.incomplete}. Not a pass.`);
  if (smoke.bootLog) console.error("boot:", smoke.bootLog);
  writeStatus({ tool: "qa-api", ok: false, incomplete: true, reason: smoke.incomplete, at: new Date().toISOString() });
  process.exit(3);
}
const smokeFails = smoke.results.filter((r) => !r.pass);
push("http smoke", smokeFails.length === 0, `${smoke.results.length - smokeFails.length}/${smoke.results.length} endpoints as expected`);

// 4) secret scan
const secrets = secretScan();
push("no hardcoded secrets", secrets.length === 0, secrets.length ? `${secrets.length} finding(s)` : "none");

// --- report ----------------------------------------------------------------
const ok = checks.every((c) => c.pass);
// Source hash: lets precommit-gate prove the backend gate ran on the CURRENT
// tree (no stale PASS), the same way qa-gate's inputHash does for the UI.
// Extensions cover Node and Python backends so a .py edit invalidates a PASS.
const BACKEND_EXT = new Set([".mjs", ".js", ".cjs", ".ts", ".sql", ".json", ".py"]);
const { hash: srcHash, files: srcFiles } = hashWithExts([targetDir], root, BACKEND_EXT);
writeStatus({
  tool: "qa-api", v: 2, at: new Date().toISOString(), dir: targetDir, framework: FRAMEWORK, ok,
  srcHash, srcFiles,
  tests: { pass: tPass, fail: tFail }, coverage: cov, coverageMin: COV_MIN,
  smoke: smoke.results, secretFindings: secrets, checks,
});

console.log("");
for (const c of checks) console.log(`  ${c.pass ? "PASS" : "FAIL"}  ${c.name}: ${c.detail}`);
for (const s of smoke.results) if (!s.pass) console.log(`        smoke ${s.method} ${s.path}: got ${s.got}, expected ${s.expect}`);
for (const s of secrets) console.log(`        secret? ${s}`);
console.log("");
if (ok) { console.log(`qa-api: PASS  (${tPass} tests, ${cov}% line coverage, ${smoke.results.length} smoke checks)  -> ${statusPath}`); process.exit(0); }
console.log(`qa-api: FAIL  (${checks.filter((c) => !c.pass).map((c) => c.name).join(", ")})  -> ${statusPath}`);
process.exit(1);
