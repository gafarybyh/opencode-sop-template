#!/usr/bin/env node
/**
 * qa-perf.mjs — one command = the mechanical G6 gate (a11y + performance).
 *
 * qa-gate (G4) lints the design floor and screenshots (G5) prove the layout
 * looks right, but neither catches a layout SHIFT or an a11y-tree violation: a
 * screenshot of a page that jumped looks fine. G6 is the only gate that measures
 * that, and until now it was manual — i.e. honor-system. This makes it
 * falsifiable in one command, the same way qa-gate does for G4.
 *
 * What it measures against a running page (a URL or a file/folder):
 *   - CLS   (cumulative layout shift)            pass < 0.1
 *   - LCP   (largest contentful paint, ms)        pass < 2500
 *   - a11y  (axe-core: critical violations)       pass = 0 critical
 *   - console errors / failed requests / 4xx       pass = 0
 *   - horizontal overflow at 320px                 pass = none
 *
 * Honesty: if Chrome/puppeteer is missing, or axe-core cannot load (no network
 * for the CDN), it reports INCOMPLETE and exits 3 — never a clean PASS with a11y
 * silently skipped. Static-only is not an option here; perf needs a real render.
 *
 * Usage:
 *   node .opencode/scripts/qa-perf.mjs --url http://localhost:3000/
 *   node .opencode/scripts/qa-perf.mjs prototype/index.html     (spins a static server)
 *   node .opencode/scripts/qa-perf.mjs prototype/               (serves that folder)
 *   flags: --lcp 2500 --cls 0.1 --axe <url-or-path>
 *
 * Exit: 0 pass · 1 a threshold failed · 2 cannot run · 3 measurement incomplete.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, extname, normalize, sep } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const require = createRequire(import.meta.url);
const statusPath = join(root, ".opencode", "perf-status.json");

const die = (msg, code = 2) => { console.error(`qa-perf: ${msg}`); process.exit(code); };

// --- args -----------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const LCP_MAX = Number(opt("--lcp", "2500"));
const CLS_MAX = Number(opt("--cls", "0.1"));
const AXE_SRC = opt("--axe", "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js");
let urlArg = opt("--url", null);
const positional = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--url" && argv[i - 1] !== "--lcp" && argv[i - 1] !== "--cls" && argv[i - 1] !== "--axe");

// --- resolve puppeteer-core + Chrome (same dependency qa-gate uses) --------
function loadPuppeteer() {
  const candidates = [];
  if (process.env.APPDATA) candidates.push(join(process.env.APPDATA, "npm", "node_modules", "puppeteer-core"));
  for (const c of candidates) { try { return require(c); } catch { /* next */ } }
  try { return require("puppeteer-core"); } catch { /* next */ }
  return null;
}
function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const g = [
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
    process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
    process.env["PROGRAMFILES(X86)"] && join(process.env["PROGRAMFILES(X86)"], "Google/Chrome/Application/chrome.exe"),
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  return g.find((p) => existsSync(p)) || null;
}

// --- optional zero-dep static server for a file/folder target --------------
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8" };
async function startStaticServer(baseDir) {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      let rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
      let full = normalize(join(baseDir, rel));
      if (!full.startsWith(baseDir + sep) && full !== baseDir) { res.writeHead(403); res.end("Forbidden"); return; }
      let info = await stat(full).catch(() => null);
      if (info && info.isDirectory()) { full = join(full, "index.html"); info = await stat(full).catch(() => null); }
      if (!info) { res.writeHead(404); res.end("404"); return; }
      const data = await readFile(full);
      res.writeHead(200, { "Content-Type": MIME[extname(full).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
      res.end(data);
    } catch (e) { res.writeHead(500); res.end("500 " + e.message); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  return { server, url: `http://127.0.0.1:${port}/` };
}

// --- measurement -----------------------------------------------------------
async function measure(url) {
  const puppeteer = loadPuppeteer();
  if (!puppeteer) return { incomplete: "puppeteer-core not found (npm i -g puppeteer-core)" };
  const chrome = findChrome();
  if (!chrome) return { incomplete: "no Chrome/Chromium found (set CHROME_PATH)" };

  const browser = await puppeteer.launch({ executablePath: chrome, headless: "new", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const page = await browser.newPage();
    const consoleErrors = [], failed = [], httpErr = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
    page.on("pageerror", (e) => consoleErrors.push("PAGEERROR " + String(e).slice(0, 200)));
    page.on("requestfailed", (r) => failed.push(r.url()));
    page.on("response", (r) => { if (r.status() >= 400) httpErr.push(r.status() + " " + r.url()); });

    await page.evaluateOnNewDocument(() => {
      window.__perf = { lcp: 0, cls: 0, shifts: [] };
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime || window.__perf.lcp; }).observe({ type: "largest-contentful-paint", buffered: true }); } catch { /* older browser */ }
      try {
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) {
            window.__perf.cls += e.value;
            window.__perf.shifts.push({ v: Math.round(e.value * 1000) / 1000, t: Math.round(e.startTime), src: (e.sources || []).map((s) => s.node ? (s.node.nodeName + (s.node.className ? "." + String(s.node.className).split(" ")[0] : "")) : "?").slice(0, 3) });
          }
        }).observe({ type: "layout-shift", buffered: true });
      } catch { /* older browser */ }
    });

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: "networkidle0", timeout: 45000 });
    await new Promise((r) => setTimeout(r, 1800)); // let LCP settle and late shifts land

    const perf = await page.evaluate(() => ({ lcp: Math.round(window.__perf.lcp), cls: Math.round(window.__perf.cls * 1000) / 1000, shifts: window.__perf.shifts.slice(0, 5) }));

    // a11y via axe-core; unavailable => INCOMPLETE, never silently pass
    let a11y;
    try {
      await page.addScriptTag({ url: AXE_SRC });
      a11y = await page.evaluate(async () => {
        const r = await window.axe.run(document, { resultTypes: ["violations"] });
        const by = (imp) => r.violations.filter((v) => v.impact === imp).length;
        return { ok: true, critical: by("critical"), serious: by("serious"), total: r.violations.length, ids: r.violations.map((v) => v.id + "(" + v.impact + ")").slice(0, 12) };
      });
    } catch (e) { a11y = { ok: false, note: "axe-core unavailable: " + String(e).slice(0, 120) }; }

    // overflow at 320
    await page.setViewport({ width: 320, height: 800 });
    await page.reload({ waitUntil: "networkidle0", timeout: 45000 });
    await new Promise((r) => setTimeout(r, 400));
    const overflow320 = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

    return { perf, a11y, consoleErrors, failed, httpErr, overflow320 };
  } finally {
    await browser.close();
  }
}

// --- run -------------------------------------------------------------------
let server = null;
if (!urlArg) {
  if (!positional.length) die("give a --url, a file, or a folder (e.g. qa-perf.mjs prototype/index.html)");
  const target = resolve(root, positional[0]);
  if (!existsSync(target)) die(`target not found: ${target}`);
  const info = await stat(target);
  const baseDir = info.isDirectory() ? target : dirname(target);
  const rel = info.isDirectory() ? "/" : "/" + target.slice(baseDir.length + 1).replace(/\\/g, "/");
  const s = await startStaticServer(baseDir);
  server = s.server;
  urlArg = s.url.replace(/\/$/, "") + rel;
}

console.log(`qa-perf: measuring ${urlArg}  (LCP<${LCP_MAX}ms, CLS<${CLS_MAX}, a11y 0 critical)`);
let result;
try {
  result = await measure(urlArg);
} finally {
  if (server) server.close();
}

if (result.incomplete) {
  console.error(`qa-perf: INCOMPLETE — ${result.incomplete}. Not a pass.`);
  try { mkdirSync(dirname(statusPath), { recursive: true }); writeFileSync(statusPath, JSON.stringify({ tool: "qa-perf", ok: false, incomplete: true, reason: result.incomplete, at: new Date().toISOString() }, null, 2) + "\n"); } catch { /* best effort */ }
  process.exit(3);
}

const { perf, a11y, consoleErrors, failed, httpErr, overflow320 } = result;
const checks = [];
const push = (name, pass, detail) => checks.push({ name, pass, detail });
push("LCP", perf.lcp > 0 && perf.lcp < LCP_MAX, `${perf.lcp}ms (max ${LCP_MAX})`);
push("CLS", perf.cls < CLS_MAX, `${perf.cls} (max ${CLS_MAX})`);
push("a11y critical", a11y.ok && a11y.critical === 0, a11y.ok ? `${a11y.critical} critical, ${a11y.serious} serious` : a11y.note);
push("console errors", consoleErrors.length === 0, `${consoleErrors.length}`);
push("network (failed/4xx)", failed.length + httpErr.length === 0, `${failed.length} failed, ${httpErr.length} 4xx`);
push("overflow @320", overflow320 === false, overflow320 ? "horizontal scroll present" : "none");

const a11yUnavailable = !a11y.ok;
const failedChecks = checks.filter((c) => !c.pass);
const ok = !a11yUnavailable && failedChecks.length === 0;

const status = {
  tool: "qa-perf", v: 1, at: new Date().toISOString(), url: urlArg, ok,
  thresholds: { lcp: LCP_MAX, cls: CLS_MAX },
  lcp: perf.lcp, cls: perf.cls, shifts: perf.shifts, a11y,
  consoleErrors, failedRequests: failed, httpErrors: httpErr, overflow320,
  checks,
};
try { mkdirSync(dirname(statusPath), { recursive: true }); writeFileSync(statusPath, JSON.stringify(status, null, 2) + "\n"); } catch { /* best effort */ }

console.log("");
for (const c of checks) console.log(`  ${c.pass ? "PASS" : "FAIL"}  ${c.name}: ${c.detail}`);
if (perf.shifts && perf.shifts.length) {
  console.log("  largest layout shift(s):");
  for (const s of perf.shifts) console.log(`    +${s.v} at ${s.t}ms  src: ${s.src.join(", ")}`);
}
console.log("");

if (a11yUnavailable) {
  console.log("qa-perf: INCOMPLETE — a11y could not be measured (axe-core unreachable). Not a clean pass.");
  process.exit(3);
}
if (ok) {
  console.log(`qa-perf: PASS  (LCP ${perf.lcp}ms, CLS ${perf.cls}, 0 critical a11y)  -> ${statusPath}`);
  process.exit(0);
}
console.log(`qa-perf: FAIL  (${failedChecks.map((c) => c.name).join(", ")})  -> ${statusPath}`);
process.exit(1);
