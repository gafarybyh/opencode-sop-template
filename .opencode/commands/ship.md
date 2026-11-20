---
description: "Full ship cycle: detect stack, plan, build, verify mechanically, verify visually with screenshots, then review. Use when the user wants a feature taken all the way to done."
agent: develop
subtask: false
---

Run the complete cycle. Do not stop early unless a gate fails in a way you
cannot resolve; then report the exact gate and what is needed.

## 1. Ground

- Read `AGENTS.md`, `.opencode/sops/DEVELOPMENT.md`, `.opencode/sops/QUALITY_GATE.md`.
- **Read the project documents first** (`.opencode/sops/DEVELOPMENT.md` Phase 0a): discover what
  is in `docs/`, read the files relevant to this task, and quote the requirement
  you are implementing.
- `.opencode/STACK.md` — create it if missing (`.opencode/sops/STACKS.md` phase 0b),
  then load one `.opencode/sops/stacks/*.md`.
- If the request is ambiguous in a way that changes the data shape or the UX,
  ask one numbered list of at most 5 questions, then proceed with stated
  defaults.

## 2. Plan

- 3-7 ordered steps, each naming a file.
- If the change spans more than one concern, invoke `planner` and use its spec.

## 3. Build

Follow `.opencode/sops/DEVELOPMENT.md` phase 4. UI work loads `.opencode/skills/hallmark` (new page) or
`.opencode/skills/refactoring-ui` (existing UI). No comments unless asked.

## 4. Verify mechanically

From your stack file's **Verify** section, with `rtk` prefix:

```bash
rtk npm run build
rtk npx tsc --noEmit
rtk npx eslint .
rtk npx vitest run
```

Report the actual exit status of each. A failing command is a finding, not a
detail to bury.

## 5. Verify visually (only if UI changed)

**Ask the user first.** Browser verification takes time. If declined, record
`WAIVED G5/G6`, state "UI not visually verified", and skip the rest of this step.

```bash
node .opencode/scripts/qa-gate.mjs <path>
```

`qa-gate` runs `sloplint --render` and writes `.opencode/gate-status.json`;
paste its `PASS`/`FAIL` line. Then the `playwright-cli` CLI: resize 320 / 768 / 1280 / 1440 and screenshot each.
Then `chrome-devtools` MCP against the production/preview server: console
errors, 404s, a11y critical, LCP, CLS.

**Native stack (React Native / Expo, Flutter):** the browser path above does not
apply. Run `.opencode/sops/QUALITY_GATE.md` **Gate 6b** instead — device/emulator
screenshots at phone and tablet, touch targets, SafeArea, light/dark themes.

Attach the screenshot paths. State each number. Do not say "looks good".

## 6. Review

- Invoke `reviewer` on the diff.
- Address every blocking finding, or state why it is not applicable.
- Security-relevant changes also go through the `reviewer` agent (it covers
  security findings alongside code review).

## 7. Report

```
Change class: <A-E, per the QUALITY_GATE triage>
Shipped: <what now works, observable>
See it: <command | URL | path>
Not done: <deliberate omissions + why>
Risks: <anything that could bite>
Next: <one action under 2 minutes>
```

Include the gate table with real values for the **declared class only** (see the
triage in `QUALITY_GATE.md`); do not pad it with `N/A` rows for gates that class
does not run:

| Gate | Result |
|---|---|
| build | pass |
| typecheck | pass |
| lint | 0 new |
| tests | N passed |
| sloplint | qa-gate: PASS, 0 FAIL |
| screenshots | 320 / 768 / 1280 / 1440 attached |
| a11y | 0 critical |
| LCP / CLS | x.x s / 0.0x |

Native (RN/Flutter): `sloplint`, the four-viewport row, and `LCP / CLS` are `N/A`;
report Gate 6b instead (device screenshots, touch targets, SafeArea, themes).
