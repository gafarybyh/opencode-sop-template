#!/usr/bin/env node
/**
 * eval-score.mjs — the empirical half of the template's self-eval.
 *
 * It does not run anything and it does not invent data. It writes a trial
 * skeleton (--init) and scores the trials a human recorded (--score), so the
 * question "did declaring a change class right-size the gates?" gets an
 * arithmetic answer instead of an opinion.
 *
 * Exit codes match qa-gate's honesty rule:
 *   0 = thresholds met   1 = threshold missed   3 = INCOMPLETE (trials missing)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const resultsPath = join(root, "eval", "results.json");

const ARMS = ["before", "after"];
const RUNS = 3;
const TASKS = [
  { id: "T1", class: "A", require: [], forbid: ["qa-gate", "screenshots"] },
  { id: "T2", class: "B", require: ["tests"], forbid: ["screenshots"] },
  { id: "T3", class: "C", require: ["qa-gate", "screenshot-1280"], forbid: [] },
];
const THRESHOLDS = { compliance: 0.9, zeroFailShip: 1.0, falseBlocks: 0, overCeremony: 0 };

const args = process.argv.slice(2);
const mode = args.includes("--score") ? "score" : args.includes("--init") ? "init" : null;
if (!mode) {
  console.error("usage: eval-score.mjs --init | --score");
  process.exit(2);
}

if (mode === "init") {
  if (existsSync(resultsPath)) {
    console.error(`eval-score: ${resultsPath} already exists; refusing to overwrite recorded trials`);
    process.exit(2);
  }
  const trials = [];
  for (const arm of ARMS) for (const task of TASKS) for (let run = 1; run <= RUNS; run++) {
    trials.push({
      arm, task: task.id, run,
      declaredClass: null, gatesRan: [], minutes: null, tokens: null,
      falseBlock: null, notes: "",
    });
  }
  mkdirSync(dirname(resultsPath), { recursive: true });
  writeFileSync(resultsPath, JSON.stringify({ arms: ARMS, tasks: TASKS, trials }, null, 2) + "\n", "utf8");
  console.log(`eval-score: wrote ${resultsPath} with ${trials.length} unrecorded trials`);
  console.log("Record each trial after a real session, then run: node .opencode/scripts/eval-score.mjs --score");
  process.exit(0);
}

if (!existsSync(resultsPath)) {
  console.error(`eval-score: INCOMPLETE — no results file at ${resultsPath}`);
  console.error("Run: node .opencode/scripts/eval-score.mjs --init");
  process.exit(3);
}

let data;
try {
  data = JSON.parse(readFileSync(resultsPath, "utf8"));
} catch (e) {
  console.error(`eval-score: cannot parse ${resultsPath}: ${e.message}`);
  process.exit(2);
}

const taskById = new Map(TASKS.map((t) => [t.id, t]));
const recorded = (t) => t.declaredClass !== null && Array.isArray(t.gatesRan) && t.gatesRan.length >= 0 && t.minutes !== null && t.falseBlock !== null;
const trials = Array.isArray(data.trials) ? data.trials : [];
const total = ARMS.length * TASKS.length * RUNS;
const done = trials.filter(recorded).length;
const missing = total - done;

const perArm = new Map(ARMS.map((a) => [a, []]));
for (const t of trials) if (recorded(t) && perArm.has(t.arm)) perArm.get(t.arm).push(t);

const pct = (n, d) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);
const median = (xs) => {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : Math.round(((v[mid - 1] + v[mid]) / 2) * 10) / 10;
};
const compliant = (t) => {
  const task = taskById.get(t.task);
  if (!task || t.declaredClass !== task.class) return false;
  const ran = new Set(t.gatesRan);
  return task.require.every((r) => ran.has(r)) && task.forbid.every((f) => !ran.has(f));
};
const overCeremony = (t) => {
  const task = taskById.get(t.task);
  return !!task && task.forbid.some((f) => (t.gatesRan || []).includes(f));
};

const rows = [];
for (const arm of ARMS) {
  const list = perArm.get(arm) || [];
  const n = list.length;
  const comp = n ? list.filter(compliant).length : 0;
  const t3 = list.filter((t) => t.task === "T3");
  const ship = t3.filter((t) => (t.gatesRan || []).includes("qa-gate")).length;
  const falseBlocks = list.filter((t) => t.falseBlock === true).length;
  const over = list.filter(overCeremony).length;
  rows.push({
    arm, n, comp: n ? pct(comp, n) : null,
    ship: t3.length ? pct(ship, t3.length) : null,
    falseBlocks, over,
    minutes: median(list.map((t) => t.minutes)),
    tokens: median(list.map((t) => t.tokens)),
  });
}

const pad = (s, w) => String(s).padEnd(w);
console.log(`eval-score: ${done}/${total} trials recorded (${missing} missing)`);
console.log(pad("arm", 8) + pad("n", 4) + pad("compliance", 12) + pad("0-FAIL ship", 13) + pad("falseBlock", 12) + pad("overCeremony", 14) + pad("med min", 9) + "med tokens");
for (const r of rows) {
  console.log(
    pad(r.arm, 8) + pad(r.n, 4) + pad(r.comp === null ? "-" : `${r.comp}%`, 12) +
    pad(r.ship === null ? "-" : `${r.ship}%`, 13) + pad(r.falseBlocks, 12) + pad(r.over, 14) +
    pad(r.minutes === null ? "-" : r.minutes, 9) + (r.tokens === null ? "-" : r.tokens)
  );
}

if (missing > 0) {
  console.error(`eval-score: INCOMPLETE — ${missing} trial(s) unrecorded; not a pass`);
  process.exit(3);
}

const missed = [];
for (const r of rows) {
  if (r.comp !== null && r.comp / 100 < THRESHOLDS.compliance) missed.push(`${r.arm}: compliance ${r.comp}% < ${THRESHOLDS.compliance * 100}%`);
  if (r.ship !== null && r.ship / 100 < THRESHOLDS.zeroFailShip) missed.push(`${r.arm}: zero-FAIL ship ${r.ship}% < 100%`);
  if (r.falseBlocks > THRESHOLDS.falseBlocks) missed.push(`${r.arm}: ${r.falseBlocks} false block(s)`);
  if (r.over > THRESHOLDS.overCeremony) missed.push(`${r.arm}: ${r.over} docs/logic trial(s) ran UI gates`);
}
if (missed.length) {
  console.error("eval-score: threshold missed");
  for (const m of missed) console.error("  - " + m);
  process.exit(1);
}
console.log("eval-score: PASS (all thresholds met)");
