# SOP — Web / App Development (phases 0a-7)

End-to-end procedure. Each phase has an exit condition. Do not skip an unmet
exit; do not loop back without saying why.

## Read map

| Need | Phase |
|---|---|
| Requirements from `docs/` | 0a |
| Detect stack | 0b + `STACKS.md` |
| Understand the codebase | 1 |
| Spec / plan | 2-3 |
| Build | 4 |
| Mechanical verify | 5 |
| Visual / browser verify | 6 |
| Review and hand off | 7 |

Missing tools: fallback per `.opencode/sops/CONTEXT.md` and
`context/TROUBLESHOOTING.md`. Announce once, continue.

## Phase 0a — Read the project documents (always first)

**Exit:** you can quote the requirement, or have said no project documents exist.

Discover, do not assume filenames:

```js
ctx_batch(commands: [
  "rtk find docs -name *.md",
  "rtk find . -maxdepth 1 -name *.md"
], queries: ["requirement","stack","feature","design","decision"])
```

Read only files that map to the task. Common: `docs/PRD.md`, `docs/STACK.md`,
`docs/features/*.md`, `docs/DESIGN.md`, `docs/adr/*.md`.

Rules: docs are the source of truth and beat upstream docs and training data.
Quote the requirement before writing code. `ctx_execute(file: path)` for a doc over
~200 lines. Never edit docs unless asked. Report code-vs-doc conflicts; never
silently pick a side. If `docs/` is absent, say so once and continue.

## Phase 0b — Detect stack

**Exit:** `.opencode/STACK.md` exists, or the agent said "no stack detected" and
stopped.

Read `.opencode/sops/STACKS.md`. Detect with one batch call, write
`.opencode/STACK.md`, then load **one** file from `.opencode/sops/stacks/`.
`docs/STACK.md` is authoritative; `.opencode/STACK.md` records what the code
contains. Report differences. Never assume a framework or scaffold into an
unknown directory.

## Phase 1 — Understand the codebase

**Exit:** you can name the files you will touch and the pattern you will follow.

If `graphify-out/` is missing: the `.graphifyignore` starter was copied by
`copy-to-project.ps1`. The agent **adapts** its patterns to this project's
folder structure (every project differs), then runs `graphify update .`:

```bash
graphify query "<feature area>"     # when graphify-out/ exists
graphify explain "<concept>"
graphify update .                   # build/update graph from project root (dot = cwd)
```

Read sibling components and nearest tests before writing. Match file naming,
import style, error handling, and state management.

## Phase 2 — Spec (only when >1 file or >1 concern)

**Exit:** a concrete spec with user-approved scope.

- The `planner` subagent writes the spec; its ticket shape applies when it
  should become tickets.
- **Spawn trigger 1 — `planner`:** >1 file, new module, non-obvious data flow, or ambiguity
  >2 questions. One-file fix or single-file tweak: primary does it alone
  (brief overhead exceeds the benefit).
- Ambiguity means ask **once**, in a short numbered list, then proceed.
- Design-heavy feature: a short interrogation first (≤5 questions, each with a
  default) — the questions that must be answered before any code is written.
- One-file bug fix: skip and say so.

## Phase 3 — Plan

**Exit:** ordered steps, each naming a file, and the **change class** (A–E, per
the triage in `.opencode/sops/QUALITY_GATE.md`) that says which gates apply.

- **Spawn trigger 2 — `planner` (plan):** new module or non-obvious data flow -> the
  `planner` subagent writes the ticketed plan. Otherwise 3-7 numbered steps inline.
- **Spawn trigger 3 — `explore`:** codebase exploration across >3 files -> the `explore`
  subagent (`graphify query` first). ≤3 files: primary reads them directly.

## Project structure (greenfield only)

Applies when creating a project from scratch. For an existing project, inherit
its layout — never reorganize uninvited (see `develop.md`).

- **Scaffold with the framework's official CLI, never hand-roll.** Take the
  command from the stack file's **Scaffold** section; it produces the canonical
  base layout. Do not invent a parallel one.
- **Organize by feature/domain, not by file type.** A feature's components, hooks,
  and tests live together; avoid a global `components/` + `hooks/` + `utils/`
  sprawl once the app passes a few screens.
- **Colocate tests** beside the code they cover, or follow the project's existing
  convention — never add a second test root.
- **Backend:** follow the framework's convention when it has one (Django apps,
  NestJS modules); otherwise match the repo layout. No invented `src/features/`.

## Phase 4 — Build

**Exit:** the change compiles and runs locally.

Order: data/types -> logic -> UI shell -> UI polish.

Rules:

- UI work loads `.opencode/skills/hallmark` (new page/design) or
  `.opencode/skills/refactoring-ui` (existing UI), plus `.opencode/sops/DESIGN_LAW.md`
  for the floor and bans.
- No comments unless asked. No dead code. No `TODO` in a handoff.
- New behaviour gets a test when the stack has a runner (stack file **Verify**).
  No runner: say so. For class B logic, write the failing test before the fix
  (TDD) or at least before claiming done.
- **Threat-model before auth work.** If the task touches auth, session, token
  refresh, or permissions, run the `reviewer` agent **before Phase 4** to lock
  the security guardrails (session binding, refresh rotation, lockout, RBAC/ABAC
  checks, MFA). Write the guardrails down, then again at Phase 7.
  No auth change ships without this step.
- **Backend: create `qa-api.config.json` in the backend root as part of the build,**
  before you can verify it. It is a build output of this phase, not an optional
  extra — without it `qa-api` cannot boot the server and G3b cannot pass. Starter
  JSON + fields: `.opencode/sops/stacks/_backend.md`. Fill `start`, `readyPath`,
  `coverageMin`, and `smoke` entries that assert a 200, a 400, a 404 and a 401.
- **API contract.** For a new endpoint (or a changed request/response shape), add the
  contract **before** writing callers: Pydantic/DTO types, a committed
  `openapi.json`, or a `.schema.json` — whichever the stack uses. Hand-written
  callers do not count.
- **DB migration.** For a schema change write the migration up **and** down (rollback).
  Prefer expand–contract: add nullable -> backfill -> drop, so old and new code
  overlap during rollout. A non-reversible migration needs a written rollback plan.
- **Supply chain.** Pin dependencies in the lockfile. After every dep change run
  the audit (Gate 2) — a new dep is a supply-chain decision, not an afterthought.
- No new dependency without saying why and confirming it is absent.
- Security: never log secrets, never ship secrets to the client, validate at the
  boundary, encode output.
- Keep diffs small; one concern per change.

### Checkpoint — verify mode (Phase 4 -> Phase 5 gate)

Phase 5 and Phase 6 are the slowest parts of the SOP. Never start them
blindly. When Phase 4 exit is met, stop and ask **once per task**:

> Build selesai. Verify mode: **full verify sekarang / skip dulu (lanjut coding) / hanya lint cepat**?

- **full verify sekarang** — run Phase 5, then Phase 6 if class C/D.
- **skip dulu** — do not verify; continue the next build step. Record
  `VERIFY: DEFERRED` in the handoff. Phase 5/6 must run before Phase 7.
- **hanya lint cepat** — run only lint on changed files (seconds); skip
  build, typecheck, tests, screenshots. Record `VERIFY: LINT-ONLY`.

Rules:

- Fast checks always auto — lint changed files, format check, `git diff --stat`.
  These are seconds, not minutes; never ask for them.
- One question per task, not per command. If the user already picked a mode
  this session, reuse it, do not re-ask every file.
- Persist the choice in `.opencode/STACK.md` as `verify: auto | ask | off`
  (default `ask`). `auto` skips the question and runs full verify; `off`
  skips Phase 5/6 entirely and records `VERIFY: WAIVED`.
- A deferred or waived verify blocks Phase 7. The handoff must state
  `VERIFY: PASS | DEFERRED | LINT-ONLY | WAIVED` with the reason.
- Class A (docs/config) never triggers this checkpoint — lint only, no build.

## Phase 5 — Verify (mechanical)

**Exit:** the commands for your **change class** pass, or every failure is
explained and accepted. The class was fixed in Phase 3 (triage in
`.opencode/sops/QUALITY_GATE.md`). Do not run class-D ceremony on a class-A change.

| Class | Run |
|---|---|
| A — docs/config | lint the changed files only; no build, no tests |
| B — logic | build + typecheck + lint + tests (full list below) |
| C — UI tweak | build + typecheck + lint; tests only if logic changed |
| D — new screen | build + typecheck + lint + tests |
| E — native UI | build + typecheck + lint + tests + device/emulator boot (G6b substitutes G4/G5/G6) |

Take exact commands from the stack file's **Verify** section. Prefer
`package.json` scripts. JS example, with `rtk` prefix:

```bash
rtk npm run build
rtk npx tsc --noEmit        # or vue-tsc / svelte-check / astro check
rtk npx eslint .            # or biome check
rtk npx vitest run          # or pytest / go test / cargo test
```

**Backend (class B/D that touches a server or schema):** the mechanical verify is
`node .opencode/scripts/qa-api.mjs --dir <backend-dir>` — tests + coverage + a
live HTTP smoke + a secret scan, exit `0/1/3`. Details in
`.opencode/sops/stacks/_backend.md`. The pre-commit hook blocks a stale backend
gate, so a code change without a fresh PASS cannot be committed.

Classes C and D: build and start the production/preview server (background)
before Phase 6. Dev-server numbers are not gate evidence.

**Class E — native UI:** run the stack file's Verify (Flutter `flutter analyze` /
`flutter test`; React Native `tsc` + `eslint` + `jest`), then boot the app on a
device or emulator for G6b. Phase 6 browser screenshots, `qa-gate --render`,
and `qa-perf` LCP/CLS do not apply — do not force them.

For class B logic and class E native work, write tests **with or before** the
logic (TDD, or at minimum a failing regression test first) — a test written after
green code tests what already works, not what was broken.

## Phase 6 — Verify (visual and real)

**Skip the browser pass entirely for classes A and B** — no UI change, nothing
to render. **Class E skips the browser pass too** — instead run G6b: boot the
app on a device or emulator at phone and tablet widths, screenshot it, and apply
the `QUALITY_GATE.md` Gate 6b checklist (44pt/48dp targets, SafeArea, themes,
zero red console errors).

**Exit, by class:**
- **C — UI tweak (G5-fast):** qa-gate PASS (0 FAIL); one screenshot at 1280; no
  console errors; keyboard reachability. The four-viewport sweep, perf trace and
  full a11y audit belong to class D.
- **D — new screen / redesign (G5 full + G6):** qa-gate PASS (0 FAIL); screenshots
  at 320/768/1280/1440; no console errors; no critical a11y issue; LCP < 2.5 s;
  CLS < 0.1 at desktop 1440.

**Ask the user before the browser pass.** Screenshots and DevTools are slow. If
declined, record `WAIVED G5/G6`, state "UI not visually verified", and continue.
Never tick a visual gate without evidence.

```bash
node .opencode/scripts/qa-gate.mjs <path>
```

**SPA (assets under `/static/...`):** add `--url <preview-url>` so the render tier
sees the real page; rendering the files directly would miss the CSS and report
false FAILs. Same idea for `qa-perf` (use `--url`, or `--asset-root <ui-dir>`).

Then, per class: **C** — resize to 1280, one screenshot, tab through the changed
control. **D** — the `playwright-cli` CLI at 320 / 768 / 1280 / 1440, then
`chrome-devtools` MCP against the production/preview server (console, network,
a11y, performance trace). **Class D also runs the mechanical G6 gate:**

```bash
node .opencode/scripts/qa-perf.mjs --url http://localhost:<port>/
```

It must print PASS (exit 0): CLS < 0.1, LCP < 2.5 s, 0 critical a11y. A
screenshot looks fine even when the page shifted — CLS needs this measurement,
not an eyeball.

Browser tooling missing: stop and report "UI not verified, browser tooling missing".
Never tick a checklist without evidence. Full gate items:
`.opencode/sops/QUALITY_GATE.md` gates 4-6 and, for class E, gate 6b.

**Spawn trigger 4 — `ui-designer` (audit):** any audit, token-consistency check, or design
review of an existing surface goes to the `ui-designer` subagent with a brief
(token lock + scope). The primary does not audit its own UI — self-audit is
biased. `ui-designer` returns evidence; it does not run Phase 6.

## Phase 7 — Review and hand off

**Exit:** an independent review pass found nothing blocking.

- **Spawn trigger 5 — `reviewer`:** diff >1 file, or auth/input/network/file I/O changed.
  Single-file logic fix with a regression test: primary self-review is enough.
- When auth would change, run the `reviewer` **before Phase 4** (threat-model +
  guardrails) and again at Phase 7 (implementation review).
- Report: what now works, how to see it, what is deliberately not done, open
  risks, next action.

Never claim a UI looks right without Phase 6 evidence.

## Definition of done

`.opencode/sops/QUALITY_GATE.md`. Done = every box checked or explicitly waived
with a user-accepted reason.

## Failure modes to avoid

| Sloppy | Correct |
|---|---|
| Assuming Next.js in a Vue repo | detect, write `.opencode/STACK.md` |
| Reading 40 files to "understand" | `graphify query`, then read 3 |
| Writing the whole page before rendering | build the hero, render, continue |
| "Should look good now" | screenshot at 4 viewports, paste evidence |
| Fixing 9 things in one diff | smallest change that satisfies the task |
| Dependency for a 5-line util | write the 5 lines |
| Placeholder copy in a handoff | real copy, or label as placeholder |
