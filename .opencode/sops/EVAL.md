---
description: How the template measures itself — deterministic consistency checks plus a small n>1 compliance trial protocol
---

# SOP — Eval (does the SOP actually work?)

An SOP can read well and still change nothing. This file defines the two halves
of measuring it, and the rule that keeps both honest: **no number is ever
estimated, inferred, or invented.** Unmeasured is reported as unmeasured.

## Half 1 — Deterministic consistency (automated)

`node .opencode/scripts/eval-consistency.mjs`

Checks the failure mode that actually recurs: **drift**. One file changes and
another still points at the old command, flag, or path. It asserts:

1. Every artifact the SOP depends on exists (`qa-gate`, hash lib, pre-commit
   gate, hook installer, guard plugin, CI file, `QUALITY_GATE.md`).
2. Every "done" surface (`AGENTS.md`, `ship`, `build-ui`, `QUALITY_GATE`,
   `DEVELOPMENT`, `develop`, `ui-designer`, `DESIGN_LAW`) names `qa-gate`.
3. No instruction surface hands the agent a **copy-pasteable command** that
   bypasses `qa-gate` (explanations that `qa-gate` wraps `sloplint --render` are
   correct and pass; a bare `sloplint --render` block fails).

Runs inside `check-template.ps1` (`=== SOP consistency (eval) ===`), so it
executes with the rest of the template smoke test. Exit `0` = consistent,
exit `1` = drift, and each finding names `file:line`.

It is deliberately narrow. It cannot tell you whether an agent complied;
that is Half 2.

## Half 2 — Compliance trial (manual, n > 1)

Purpose: answer "does declaring a change class actually right-size the gates,
without lowering the floor?" — the only question the deterministic check cannot
answer.

### Design

- **Arms**: `before` and `after` — the SOP state you are comparing. One arm per
  optimization you ship. Never mix arms inside one results file.
- **Tasks**: five, fixed, one per change class. Do not reword them between
  arms or the comparison is void.
  - **T1** (class A, docs-only): "Fix a typo and a broken link in the project's
    README. Commit nothing." Expected: G0/G2-lite only; **no** `qa-gate`, **no**
    screenshots.
  - **T2** (class B, logic): "Add input validation to the save handler plus a
    test, in an existing project." Expected: test runner invoked; **no**
    screenshots.
  - **T3** (class C, UI tweak): "Change the primary button's label and hover
    state on an existing screen." Expected: `qa-gate` run with a pasted PASS
    line; one screenshot at 1280.
  - **T4** (class D, new screen + backend): "Add a new page that lists an
    API resource, backed by a new endpoint; add tests." Expected: `qa-gate` PASS,
    `qa-api` PASS line, screenshots at 320/768/1280/1440, migration up **and**
    down, API contract checked in before the caller.
  - **T5** (class E, native): "Change a button label and add a focus state on an
    existing Flutter/RN screen. Run `flutter analyze` / `tsc` and boot the app on
    an emulator — no browser screenshots, no `qa-gate --render`." Expected: analyze
    + device screenshot at phone width, zero red console errors, no browser gate
    attempted.
- **Runs**: 3 per task per arm (n = 15 per arm). Fresh session each run, prompt
  pasted verbatim, no hints.
- **Recording**: after each run, fill one trial object. A field you did not
  observe stays `null` — do not guess. Screenshots and the gate output lines
  (`qa-gate` / `qa-api` PASS, or G6b device screenshot) are the evidence; without
  them the trial is unrecorded.

### Metrics

| Metric | Definition | Threshold |
|---|---|---|
| Gate compliance | trials where the declared class matched the diff **and** the class's gates ran, ÷ recorded trials | ≥ 90% |
| False blocks | trials where an enforcement hook blocked work that was not UI | 0 |
| Zero-FAIL ship rate | T3 trials that ended with a real `qa-gate` PASS line, ÷ recorded T3 trials | 100% |
| Class E honesty | T5 trials that ran device/emulator G6b **and** did not attempt browser gates (`qa-gate --render`, LCP/CLS), ÷ recorded T5 trials | 100% |
| Cost | median wall-clock minutes and total tokens per trial, per arm | reported, not gated |
| Over-ceremony | T1/T2 trials that ran UI gates (`qa-gate`, screenshots) anyway | 0 |

Measured via `node .opencode/scripts/eval-score.mjs`:

```bash
node .opencode/scripts/eval-score.mjs --init      # writes eval/results.json skeleton
node .opencode/scripts/eval-score.mjs --score     # prints the table, checks thresholds
```

Exit codes follow the same honesty rule as `qa-gate`: `0` = thresholds met,
`1` = threshold missed, `3` = **INCOMPLETE** (trials still unrecorded — not a
pass, not a fail).

### What this is not

- Not a benchmark of model quality; the model is held constant.
- Not statistical significance. n = 15 per arm detects gross regressions
  ("the hook fires on docs-only work", "nobody runs the gate", "native work is
  forced through browser gates"), nothing subtler.
  Claim only what the table shows.
- Not a place to store invented numbers. A results file with `null` fields is a
  legitimate, useful output: it says what still needs measuring.
