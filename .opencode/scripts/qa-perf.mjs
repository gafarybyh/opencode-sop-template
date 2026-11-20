#!/usr/bin/env node
/**
 * qa-perf.mjs — one command = the mechanical G6 gate (a11y + performance).
 *
 * qa-gate (G4) lints the design floor and screenshots (G5) prove the layout
 * looks right, but neither catches a layout SHIFT or an a11y-tree violation: a
 * screenshot of a page that jumped looks fine. G6 is the only gate that measures
 * that, so this makes it falsifiable in one command, like qa-gate does for G4.
 *
 * Per page it measures:
 *   - CLS   (cumulative layout shift)            pass < 0.1
 *   - LCP   (largest contentful paint, ms)        pass < 2500
 *   - a11y  (axe-core: critical violations)       pass = 0 critical
 *   - console errors / failed requests / 4xx       pass = 0
 *   - horizontal overflow at 320px                 pass = none
 *
 * Sweep: point it at a FOLDER and it tests every top-level *.html page (class D
 * "full" = all pages, not one). Point it at a file or --url for one page.
 *
 * axe-core is VENDORED at scripts/vendor/axe.min.js, so a11y runs offline. Only
 * if that file is missing AND the CDN is unreachable does a11y report INCOMPLETE
 * (exit 3) — never a silent PASS. Missing Chrome/puppeteer is also exit 3.
 *
 * Usage:
 *   node .opencode/scripts/qa-perf.mjs --url http://localhost:3000/
 *   node .opencode/scripts/qa-perf.mjs dist/index.html       (one page)
 *   node .opencode/scripts/qa-perf.mjs dist/                 (sweep every *.html)
 *   flags: --lcp 2500 --cls 0.1 --axe <url-or-path>
 *
 * Exit: 0 pass · 1 a threshold failed · 2 cannot run · 3 measurement incomplete.
 */
import { createServer } from "node:http";
import { readFile, stat, readdir } from "node:fs/promises";
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, extname, normalize, sep } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const require = createRequire(import.meta.url);
const statusPath = join(root, ".opencode", "perf-status.json");
const localAxe = join(here, "vendor", "axe.min.js");

const die = (msg, code = 2) => { console.error(`qa-perf: ${msg}`); process.exit(code); };

// --- args -----------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt; };
const LCP_MAX = Number(opt("--lcp", "2500"));
const CLS_MAX = Number(opt("--cls", "0.1"));
const AXE_SRC = opt("--axe", "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js");
let urlArg = opt("--url", null);
const positional = argv.filter((a, i) => !a.startsWith("--") && !["--url", "--lcp", "--cls", "--axe"].includes(argv[i - 1]));

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

// --- one page --------------------------------------------------------------
async function measurePage(browser, url) {
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

  // a11y: vendored axe first (offline), CDN only as fallback. Unavailable => INCOMPLETE.
  let a11y;
  try {
    if (existsSync(localAxe)) await page.addScriptTag({ path: localAxe });
    else await page.addScriptTag({ url: AXE_SRC });
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

  await page.close();
  return { perf, a11y, consoleErrors, failed, httpErr, overflow320 };
}

function checksFor(r) {
  const checks = [];
  const push = (name, pass, detail) => checks.push({ name, pass, detail });
  push("LCP", r.perf.lcp > 0 && r.perf.lcp < LCP_MAX, `${r.perf.lcp}ms (max ${LCP_MAX})`);
  push("CLS", r.perf.cls < CLS_MAX, `${r.perf.cls} (max ${CLS_MAX})`);
  push("a11y critical", r.a11y.ok && r.a11y.critical === 0, r.a11y.ok ? `${r.a11y.critical} critical, ${r.a11y.serious} serious` : r.a11y.note);
  push("console errors", r.consoleErrors.length === 0, `${r.consoleErrors.length}`);
  push("network (failed/4xx)", r.failed.length + r.httpErr.length === 0, `${r.failed.length} failed, ${r.httpErr.length} 4xx`);
  push("overflow @320", r.overflow320 === false, r.overflow320 ? "horizontal scroll present" : "none");
  return checks;
}

// --- build page list -------------------------------------------------------
let server = null;
let pages = []; // [{label, url}]
if (urlArg) {
  pages = [{ label: urlArg, url: urlArg }];
} else {
  if (!positional.length) die("give a --url, a file, or a folder (e.g. qa-perf.mjs dist/)");
  const target = resolve(root, positional[0]);
  if (!existsSync(target)) die(`target not found: ${target}`);
  const info = await stat(target);
  const baseDir = info.isDirectory() ? target : dirname(target);
  const s = await startStaticServer(baseDir);
  server = s.server;
  const baseUrl = s.url.replace(/\/$/, "");
  if (info.isDirectory()) {
    const entries = (await readdir(target)).filter((f) => f.toLowerCase().endsWith(".html")).sort();
    if (!entries.length) die(`no .html pages in ${target}`);
    pages = entries.map((f) => ({ label: f, url: `${baseUrl}/${f}` }));
  } else {
    pages = [{ label: target.slice(baseDir.length + 1).replace(/\\/g, "/"), url: `${baseUrl}/${target.slice(baseDir.length + 1).replace(/\\/g, "/")}` }];
  }
}

// --- run -------------------------------------------------------------------
const puppeteer = loadPuppeteer();
if (!puppeteer) die("puppeteer-core not found (npm i -g puppeteer-core)", 3);
const chrome = findChrome();
if (!chrome) die("no Chrome/Chromium found (set CHROME_PATH)", 3);

console.log(`qa-perf: ${pages.length} page(s)  (LCP<${LCP_MAX}ms, CLS<${CLS_MAX}, a11y 0 critical)  axe: ${existsSync(localAxe) ? "vendored (offline)" : AXE_SRC}`);

const browser = await puppeteer.launch({ executablePath: chrome, headless: "new", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const pageResults = [];
try {
  for (const pg of pages) {
    let r;
    try { r = await measurePage(browser, pg.url); }
    catch (e) { r = { incomplete: "measurement error: " + String(e).slice(0, 160) }; }
    if (r.incomplete) {
      console.error(`qa-perf: INCOMPLETE on ${pg.label} — ${r.incomplete}. Not a pass.`);
      try { mkdirSync(dirname(statusPath), { recursive: true }); writeFileSync(statusPath, JSON.stringify({ tool: "qa-perf", ok: false, incomplete: true, page: pg.label, reason: r.incomplete, at: new Date().toISOString() }, null, 2) + "\n"); } catch { /* best effort */ }
      if (server) server.close();
      await browser.close();
      process.exit(3);
    }
    pageResults.push({ label: pg.label, url: pg.url, ...r, checks: checksFor(r) });
  }
} finally {
  await browser.close();
  if (server) server.close();
}

// aggregate
const a11yUnavailable = pageResults.some((p) => !p.a11y.ok);
const allFailed = pageResults.flatMap((p) => p.checks.filter((c) => !c.pass).map((c) => `${p.label}: ${c.name}`));
const ok = !a11yUnavailable && allFailed.length === 0;

const status = {
  tool: "qa-perf", v: 2, at: new Date().toISOString(), ok, pageCount: pageResults.length,
  thresholds: { lcp: LCP_MAX, cls: CLS_MAX }, axe: existsSync(localAxe) ? "vendored" : "cdn",
  pages: pageResults.map((p) => ({
    label: p.label, url: p.url, lcp: p.perf.lcp, cls: p.perf.cls, shifts: p.perf.shifts, a11y: p.a11y,
    consoleErrors: p.consoleErrors, failedRequests: p.failed, httpErrors: p.httpErr, overflow320: p.overflow320, checks: p.checks,
  })),
};
try { mkdirSync(dirname(statusPath), { recursive: true }); writeFileSync(statusPath, JSON.stringify(status, null, 2) + "\n"); } catch { /* best effort */ }

console.log("");
for (const p of pageResults) {
  const worst = p.checks.filter((c) => !c.pass);
  const tag = worst.length === 0 ? "PASS" : "FAIL";
  console.log(`  ${tag}  ${p.label}  LCP ${p.perf.lcp}ms · CLS ${p.perf.cls} · a11y ${p.a11y.ok ? p.a11y.critical + " crit" : "n/a"} · console ${p.consoleErrors.length} · net ${p.failed.length + p.httpErr.length} · ovf320 ${p.overflow320}`);
  for (const c of worst) console.log(`        FAIL ${c.name}: ${c.detail}`);
  for (const s of p.perf.shifts) console.log(`        shift +${s.v} at ${s.t}ms src: ${s.src.join(", ")}`);
}
console.log("");

if (a11yUnavailable) {
  console.log("qa-perf: INCOMPLETE — a11y could not be measured (axe-core unreachable and not vendored). Not a clean pass.");
  process.exit(3);
}
if (ok) {
  console.log(`qa-perf: PASS  (${pageResults.length} page(s), 0 critical a11y)  -> ${statusPath}`);
  process.exit(0);
}
console.log(`qa-perf: FAIL  (${allFailed.length} failed check(s) across ${pageResults.length} page(s))  -> ${statusPath}`);
process.exit(1);
