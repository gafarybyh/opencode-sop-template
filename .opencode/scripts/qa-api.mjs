#!/usr/bin/env node
/**
 * qa-api.mjs — one command = the mechanical backend gate (G3 + G6b-for-API).
 *
 * Frontend gates (qa-gate, qa-perf) cannot see a server. This runs the backend's
 * own tests + coverage, boots the REAL HTTP server on an ephemeral port and hits
 * a declared smoke contract, and scans source for hardcoded secrets. It turns
 * "the API works" into an exit code instead of an assertion.
 *
 * It is project-agnostic: point --dir at a backend that has a qa-api.config.json
 * declaring how to start it and what to smoke (format: .opencode/sops/stacks/_backend.md).
 *
 * Honesty: a missing test runner, a server that never becomes ready, or a smoke
 * check that cannot run is INCOMPLETE (exit 3) — never a silent PASS.
 *
 * Usage: node .opencode/scripts/qa-api.mjs [--dir server] [--coverage-min 70]
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
const nodeExe = process.execPath;
const cmdOf = (arr) => {
  if (arr[0] === "node") return [nodeExe, ...arr.slice(1)];
  // On Windows, bare package-manager names need their .cmd shim when not run via a shell.
  if (process.platform === "win32" && ["npm", "npx", "pnpm", "yarn"].includes(arr[0])) return [arr[0] + ".cmd", ...arr.slice(1)];
  return arr;
};

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

function freePort() {
  return new Promise((res, rej) => {
    const s = createServer();
    s.once("error", rej);
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); });
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function httpSmoke() {
  if (!cfg.start) return { incomplete: "config has no 'start' command" };
  const port = await freePort();
  const tmpDb = join(tmpdir(), `qa-api-${port}-${Date.now()}.db`);
  const env = { PORT: String(port), ...(cfg.env || {}), DB_PATH: tmpDb };
  const [cmd, ...args] = cmdOf(cfg.start);
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
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) { if (!["node_modules", "data", "test", "tests", "__tests__"].includes(name)) walk(p); continue; }
      if (!/\.(mjs|js|ts|cjs)$/.test(name)) continue;
      // Test files hold fixtures, not real secrets; the gate is about shipped code.
      if (/\.(test|spec)\./.test(name)) continue;
      const rel = p.slice(targetDir.length + 1).replace(/\\/g, "/");
      if (allow.some((a) => rel.endsWith(a))) continue;
      const lines = readFileSync(p, "utf8").split("\n");
      lines.forEach((ln, i) => { if (re.test(ln) && !/process\.env/.test(ln)) findings.push(`${rel}:${i + 1}: ${ln.trim().slice(0, 80)}`); });
    }
  };
  try { walk(targetDir); } catch { /* ignore */ }
  return findings;
}

// --- run -------------------------------------------------------------------
const checks = [];
const push = (name, pass, detail) => checks.push({ name, pass, detail });

console.log(`qa-api: ${targetDir}  (coverage>=${COV_MIN}%)`);

// 1) tests
const testCmd = cfg.test || ["node", "--test"];
const tr = await runCmd(testCmd);
const passM = /(?:#|\u2139)\s*pass (\d+)/.exec(tr.out);
const failM = /(?:#|\u2139)\s*fail (\d+)/.exec(tr.out);
if (!passM) {
  console.error("qa-api: INCOMPLETE — test runner produced no 'pass N' line (is node --test available?).");
  console.error((tr.out + tr.err).slice(-500));
  writeStatus({ tool: "qa-api", ok: false, incomplete: true, reason: "test runner unavailable", at: new Date().toISOString() });
  process.exit(3);
}
const tPass = Number(passM[1]);
const tFail = failM ? Number(failM[1]) : 0;
push("tests", tr.code === 0 && tFail === 0 && tPass > 0, `${tPass} passed, ${tFail} failed`);

// 2) coverage
const covCmd = cfg.coverage || ["node", "--test", "--experimental-test-coverage"];
const cr = await runCmd(covCmd);
const covM = /all files\s*\|\s*([\d.]+)/.exec(cr.out);
const cov = covM ? Number(covM[1]) : null;
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
const BACKEND_EXT = new Set([".mjs", ".js", ".cjs", ".ts", ".sql", ".json"]);
const { hash: srcHash, files: srcFiles } = hashWithExts([targetDir], root, BACKEND_EXT);
writeStatus({
  tool: "qa-api", v: 1, at: new Date().toISOString(), dir: targetDir, ok,
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
