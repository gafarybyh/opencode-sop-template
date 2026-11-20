#!/usr/bin/env node
/**
 * eval-consistency.mjs — deterministic self-eval of the template's own
 * consistency. Turns "trust me, it's wired" into a pass/fail a machine checks.
 *
 * It exists because the recurring failure mode is DRIFT: a command or tool
 * changes in one file while another file still points at the old one (e.g. the
 * design gate became `qa-gate` but an agent profile still said raw `sloplint`).
 * That gap is silent and human-grep misses it. This catches it.
 *
 * Scope: the DETERMINISTIC half of the eval. "Does an agent comply / do
 * outcomes improve" is the empirical half and needs real task runs; this script
 * cannot fabricate those numbers and does not try.
 *
 * Exit 0 = consistent; 1 = drift found (each finding names file:line).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const findings = [];
const rel = (p) => relative(root, p).replace(/\\/g, "/");

// --- 1. Required artifacts exist -------------------------------------------
const REQUIRED = [
  "AGENTS.md",
  ".opencode/scripts/qa-gate.mjs",
  ".opencode/scripts/lib-gate-hash.mjs",
  ".opencode/scripts/precommit-gate.mjs",
  ".opencode/scripts/install-git-hooks.ps1",
  ".opencode/scripts/qa-perf.mjs",
  ".opencode/scripts/qa-api.mjs",
  ".opencode/scripts/vendor/axe.min.js",
  ".opencode/sops/stacks/_backend.md",
  ".opencode/plugins/qa-gate-guard.js",
  ".opencode/ci/qa-gate.yml",
  ".opencode/sops/QUALITY_GATE.md",
];
for (const f of REQUIRED) if (!existsSync(join(root, f))) findings.push(`missing artifact: ${f}`);

// --- 2. Every "done" surface names qa-gate ---------------------------------
const SURFACES = [
  "AGENTS.md",
  ".opencode/commands/ship.md",
  ".opencode/commands/build-ui.md",
  ".opencode/sops/QUALITY_GATE.md",
  ".opencode/sops/DEVELOPMENT.md",
  ".opencode/agents/develop.md",
  ".opencode/agents/ui-designer.md",
  ".opencode/sops/DESIGN_LAW.md",
];
for (const f of SURFACES) {
  const p = join(root, f);
  if (!existsSync(p)) continue;
  if (!readFileSync(p, "utf8").includes("qa-gate")) {
    findings.push(`${f} does not mention qa-gate (drift: design-gate command diverged)`);
  }
}

// --- 3. No instruction surface tells you to RUN raw sloplint as the step ---
// Drift is a copy-pasteable command, not a mention. A doc may explain that
// qa-gate wraps `sloplint --render`; it may not hand the agent a bare command to
// run instead. So: only fenced blocks/inline imperatives whose command starts
// with a runner and never mention qa-gate are flagged. Skill internals (they own
// the linter), troubleshooting, stack notes and the audit-only command are exempt.
const CMD_START = /^\s*(?:\$|>|PS>)?\s*(?:rtk\s+|sudo\s+)?(?:node|npx|npm|pnpm|yarn|sloplint)\b/;
const EXEMPT = [/skills\/hallmark/, /TROUBLESHOOTING/, /\/stacks\//, /bootstrap-windows/, /check-setup/, /ui-audit/];
const files = ["AGENTS.md", "README.md", "SETUP.md"];
for (const d of ["sops", "agents", "commands"]) {
  const dir = join(root, ".opencode", d);
  if (existsSync(dir)) for (const e of readdirSync(dir, { withFileTypes: true })) if (e.isFile() && e.name.endsWith(".md")) files.push(`.opencode/${d}/${e.name}`);
}
const rawSloplintInvocation = (block) =>
  block.split("\n").some((l) => CMD_START.test(l) && /sloplint/.test(l));
for (const f of files) {
  const p = join(root, f);
  if (!existsSync(p) || EXEMPT.some((re) => re.test(rel(p)))) continue;
  const lines = readFileSync(p, "utf8").split("\n");
  let block = null;
  let blockStart = 0;
  lines.forEach((l, i) => {
    if (/^\s*```/.test(l)) {
      if (block === null) { block = []; blockStart = i; return; }
      const body = block.join("\n");
      const hasQaGate = /qa-gate/.test(body);
      if (!hasQaGate && rawSloplintInvocation(body)) {
        const bad = block.find((b) => CMD_START.test(b) && /sloplint/.test(b)) || "";
        findings.push(`${rel(p)}:${blockStart + 1} fenced command runs raw sloplint instead of qa-gate: ${bad.trim().slice(0, 70)}`);
      }
      block = null;
      return;
    }
    if (block !== null) { block.push(l); return; }
    if (/^\s*[-*]?\s*(?:Run|Then run|Re-run)\b[^\n]*sloplint/.test(l) && !/qa-gate/.test(l)) {
      findings.push(`${rel(p)}:${i + 1} imperatively runs raw sloplint (route it through qa-gate): ${l.trim().slice(0, 70)}`);
    }
  });
}

// --- 4. Prose step drift: a verification step that names sloplint but never
// qa-gate. The fenced/imperative check above misses wrapped prose like
// "…plus sloplint and screenshots". Explanations ("qa-gate runs sloplint"), the
// skill internals, the audit-only command, troubleshooting, stacks and
// DESIGN_LAW (which owns the linter) are exempt. qa-gate counts if it appears on
// the same line OR either neighbour, since prose wraps mid-sentence.
const PROSE_STEP = /sloplint/i;
const PAIRS_STEP = /screenshot|plus sloplint|sloplint and|run sloplint|sloplint to verify/i;
const EXPLAINS = /wraps|runs `?sloplint|to debug|directly only|Layer 1|static tier/i;
const PROSE_EXEMPT = [/DESIGN_LAW/, /skills\/hallmark/, /TROUBLESHOOTING/, /\/stacks\//, /ui-audit/];
for (const f of files) {
  const p = join(root, f);
  if (!existsSync(p) || PROSE_EXEMPT.some((re) => re.test(rel(p)))) continue;
  const lines = readFileSync(p, "utf8").split("\n");
  lines.forEach((l, i) => {
    if (!PROSE_STEP.test(l) || !PAIRS_STEP.test(l) || EXPLAINS.test(l)) return;
    // Only instruction lines drift. Table rows, frontmatter, and explanatory
    // "N/A / does not apply" prose legitimately mention sloplint + screenshots.
    if (!/^\s*(?:[-*]|\d+\.)\s/.test(l)) return;
    if (/\|/.test(l)) return;
    if (/N\/A|do(?:es)? not apply|assume a browser|not apply/i.test(l)) return;
    const window = [lines[i - 1] ?? "", l, lines[i + 1] ?? ""].join("\n");
    if (/qa-gate/.test(window)) return;
    findings.push(`${rel(p)}:${i + 1} prose step routes verification to sloplint without qa-gate: ${l.trim().slice(0, 70)}`);
  });
}

// --- 5. Backend config is mandated, not optional ---------------------------
// The recurring slip: someone softens "create qa-api.config.json" back to "if it
// exists", which silently removes the backend gate's trigger. In the files that
// must MANDATE it, the obligation has to sit next to the mention, and the
// opt-in phrasing is forbidden. (Stack run-lines may say "declares".)
const mandateFiles = ["AGENTS.md", ".opencode/sops/DEVELOPMENT.md", ".opencode/sops/QUALITY_GATE.md"];
const OPT_IN = /\bif\s+(?:the\s+)?backend\s+declares\b/i;
const MANDATE = /(create|creates|creating|must|required|mandatory|not done without|in the same change|build output|part of the change)/i;
for (const f of mandateFiles) {
  const p = join(root, f);
  if (!existsSync(p)) continue;
  const txt = readFileSync(p, "utf8");
  if (!/qa-api\.config\.json/.test(txt)) {
    findings.push(`${f} no longer mentions qa-api.config.json (backend config mandate dropped)`);
    continue;
  }
  if (OPT_IN.test(txt)) {
    findings.push(`${f} phrases the backend config as opt-in ("if the backend declares") — it must be a create/must rule`);
  }
  const lines = txt.split("\n");
  const near = lines.some((l, i) =>
    /qa-api\.config\.json/.test(l) && MANDATE.test([lines[i - 1] ?? "", l, lines[i + 1] ?? ""].join(" "))
  );
  if (!near) findings.push(`${f} mentions qa-api.config.json but with no create/must rule beside it (became optional)`);
}
// _backend.md must keep the "Required build output" heading so the starter reads as mandatory.
{
  const p = join(root, ".opencode/sops/stacks/_backend.md");
  if (existsSync(p) && !/Required build output/i.test(readFileSync(p, "utf8"))) {
    findings.push(".opencode/sops/stacks/_backend.md lost its 'Required build output' section (config became optional)");
  }
}

// --- report ----------------------------------------------------------------
if (findings.length === 0) {
  console.log("eval-consistency: PASS (artifacts present, done-surfaces name qa-gate, no raw-sloplint/prose drift, backend config mandated)");
  process.exit(0);
}
console.error(`eval-consistency: ${findings.length} issue(s):`);
for (const f of findings) console.error("  - " + f);
process.exit(1);
