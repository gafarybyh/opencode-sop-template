# SOP — Quality Gate (Definition of Done)

Done = every applicable gate passed, or explicitly waived with a reason the user
accepted. Design commands live in `.opencode/sops/DESIGN_LAW.md`; this file is the
checklist.

## Triage — which gates apply (declare the class, then run only those)

Gates are risk-proportional. Pick the class in Phase 3, **state it in the
handoff** (`Change class: C — UI tweak`), and run its gates. Declaring a class
that does not match the diff is a false claim, exactly like claiming a gate
passed.

| Class | Trigger | Gates that apply |
|---|---|---|
| **A** — docs/config | only docs, comments, config, dependency bumps; no product code | G0, G2 (lint only if it lints those files), G9 (CI), G8 |
| **B** — logic | source code, no user-visible UI change | G0, G1, G2, G3, **G3b** (if server/schema), G7 (>1 file), G9 (CI), G8 |
| **C** — UI tweak | CSS/markup/copy change to an existing screen | G0, G1, G2, **G4**, G5-fast, G9 (CI), G8 |
| **D** — new screen | new page/screen, redesign, or layout rework | G0, G1, G2, G3 (if logic), **G3b** (if server/schema), **G4**, **G5 (full)**, **G6**, G7, G9 (CI), G8 |
| **E** — native UI | React Native / Expo / Flutter | G0, G1, G2, G3, **G6b**, G7, G9 (CI), G8 |

Notes:

- **G4 is machine-enforced** for classes C and D (pre-commit hook / CI). You do
  not have to remember it; running `qa-gate` is how you clear it.
- **G5/G6 are declared, not machine-enforced.** The hook and CI only read
  `gate-status.json` (the G4 design floor); they cannot see screenshots, the a11y
  tree, or LCP/CLS. So G5/G6 rest on the declared class and are **audited at
  review** (Gate 7 / `reviewer`): a class-C/D handoff must show the evidence its
  class requires, or an explicit waiver. Declaring class C to dodge class D's
  evidence is a false claim, exactly like claiming a gate passed.
- **G5-fast (class C)** = the checks that `qa-gate --render` already performs
  (overflow at 375, sticky/fold, focus ring) **plus** one screenshot at 1280,
  zero console errors, and keyboard reachability. The four-viewport row, the
  perf trace, and the full a11y sweep belong to class D.
- **Class D includes class C's checks.** Class D is the superset.
- When a change spans classes, take the **highest** class and run its gates.
- Escalate when in doubt: a change to a shared component, a token, or a layout
  primitive is class D for every screen that uses it, even if the diff is one
  line.

## Gate 0 — Requirement traceability (always)

- [ ] Requirement quoted from `docs/`, or stated as "not documented; user said X".
- [ ] Nothing contradicts `docs/PRD.md`, `docs/STACK.md`, `docs/DESIGN.md`, or a feature doc.
- [ ] Doc-vs-code conflict reported, not silently resolved.
- [ ] No library API written from memory; each verified this session or in repo.

## Gate 1 — Correctness (classes B, C, D, E)

- [ ] Behaviour works, verified by running it.
- [ ] No new `any` / `unknown` cast / `# type: ignore` without a one-line reason.
- [ ] No dead code, commented-out blocks, or debug `console.log`.
- [ ] No new `TODO` / `FIXME`.
- [ ] Error paths handled: network failure, empty result, invalid input.
- [ ] No hardcoded secret, token, or credential.

## Gate 2 — Mechanical build (all code changes; docs-only: lint the changed files)

Run with `rtk` prefix. Take the exact commands from the stack file's **Verify**
section; the examples below are illustrative only. Missing script = gap, not
pass: record `N/A <check>: <reason>` and ask for the command. Do not claim a gate
passed.

- [ ] Build: `rtk npm run build` / `rtk python -m build` / `rtk go build ./...`
- [ ] Typecheck: `rtk npx tsc --noEmit` / `vue-tsc` / `svelte-check` / `astro check` / `mypy`
- [ ] Lint zero **new** warnings vs a baseline captured before the change:
      `rtk npx eslint .` / `rtk ruff check` / `rtk cargo clippy`
- [ ] Tests: `rtk npx vitest run` / `rtk pytest` / `rtk go test ./...` / `rtk cargo test`
- [ ] Dependency audit clean when dependencies changed: `rtk npm audit --audit-level=high` / `rtk pip-audit` / `rtk govulncheck ./...` / `rtk cargo audit`. A new dependency for a few lines of code is rejected.
- [ ] **Lockfile pinned**: every dep change updates the lockfile (`package-lock.json` /
      `pnpm-lock.yaml`, `uv.lock` / `poetry.lock`, `go.sum`, `Cargo.lock`). CI installs
      with the frozen lockfile (`npm ci`, `pip install --frozen`, `go mod verify`).
      An unpinned dependency is a supply-chain gap, not a pass.

If a baseline cannot be captured, report the absolute count and list pre-existing
warnings as `N/A pre-existing`. Capture the baseline before the change, e.g.
`rtk npx eslint . -f json > .lint-baseline.json` (or
`rtk ruff check --output-format json`), then compare counts after. Never "fix"
unrelated lint debt in the same change.

## Gate 3 — Test coverage (when logic changed)

- [ ] New pure logic has at least one test, written **with or before** the logic
      (TDD). A test written after green code tests behavior that already works, not
      the broken path — it does not close G3.
- [ ] Bug fix has a regression test that fails before the fix.
- [ ] Tests assert behaviour, not implementation detail.
- [ ] No test skipped or deleted to make the suite green.

No test runner and the user did not ask for one: say so, do not add a framework
silently.

## Gate 3b — Backend API + DB (when server code or schema changed)

The UI gates cannot see a server. A backend change is done only when its own
mechanical gate passes — same rule as G4 for the design floor.

- [ ] The backend declares `qa-api.config.json` in its root (start + readyPath +
      smoke for 200/400/404/401). If it is missing, the gate cannot run — creating
      it is part of the change, not an optional extra. Starter: `stacks/_backend.md`.
- [ ] `node .opencode/scripts/qa-api.mjs --dir <backend-dir>` prints **PASS
      (exit 0)**: tests pass, coverage ≥ floor (default 70%), smoke endpoints
      match (incl. 401/404), no hardcoded secrets. Paste its PASS line. Details:
      `.opencode/sops/stacks/_backend.md`.
- [ ] Integration tests hit the real HTTP surface: happy path, 400 invalid input,
      404 unknown, 401 on every protected route.
- [ ] Money/totals recomputed server-side from stored values; multi-row writes in
      a transaction.
- [ ] Migration applies to a fresh DB in the test run; a code-vs-`docs/BACKEND_SCHEMA.md`
      mismatch is reported, not silently resolved.
- [ ] **Rollback:** the migration ships up **and** down, or an expand–contract plan
      (add nullable -> backfill -> drop) so old/new code overlap during rollout.
      A non-reversible migration needs a written rollback plan.
- [ ] **API contract first:** a new or changed endpoint ships Pydantic/DTO types,
      a committed `openapi.json`, or a `.schema.json` — checked in before callers.
      Hand-written callers (`fetch`) do not count as contract evidence.
- [ ] **Threat-model (auth changes):** a `reviewer` pass before Phase 4 documented
      session binding, refresh rotation, lockout, RBAC/ABAC checks, and MFA. Re-run
      at Phase 7. An auth change without the early pass does not pass G3b.
- [ ] Supply chain: dependency audit clean (see Gate 2); lockfile pinned; SBOM
      generated on release (`npm sbom` / `pip-audit --format=cyclonedx-json` /
      `cargo audit --format=json`).

`qa-api` writes `.opencode/api-status.json`; the pre-commit hook blocks a stale
backend gate when `qa-api.config.json` exists — so this is enforced, not
honor-system. Missing runner / server-never-ready / smoke-cannot-run is INCOMPLETE
(exit 3), never a pass.

## Gate 4 — Design floor (when UI changed)

- [ ] `node .opencode/scripts/qa-gate.mjs` reports **PASS, 0 FAIL** (it runs `sloplint --render`; details in `.opencode/sops/DESIGN_LAW.md`).
- [ ] **SPA:** if the UI loads CSS/JS from absolute paths (`/static/...`), render the
      running server, not the files: `node .opencode/scripts/qa-gate.mjs <ui-dir> --url <preview-url>`.
      Rendering the files directly (`file://`) does not load those assets and reports
      false FAILs; the static tier still lints `<ui-dir>`.
- [ ] Every `REFLEX` fixed or waived in the CSS stamp with evidence.
- [ ] All Layer-1 floor items in `.opencode/sops/DESIGN_LAW.md` hold.
- [ ] No item from the `.opencode/sops/DESIGN_LAW.md` ban table.
- [ ] Enforcement (repo with UI): a pre-commit hook (`.opencode/scripts/install-git-hooks.ps1`)
      or the CI in `.opencode/ci/qa-gate.yml` blocks a UI commit/push unless
      `gate-status.json` is a clean pass whose `inputHash` matches the tree.
      `copy-to-project.ps1` installs both into a new project; a static-only
      (`--static`) gate does not satisfy the hook — it is a waiver, not evidence.

## Gate 5 — Visual evidence (UI changed; class C: fast subset, class D: full)

**Ask the user first.** Screenshots and DevTools cost real time. If the user
declines, record `WAIVED G5/G6` and state "UI not visually verified"; never claim
it passed.

- [ ] User approved browser verification.
- [ ] Screenshots per class (C: 1280 only; D: 320 / 768 / 1280 / 1440) from the `playwright-cli` CLI.
- [ ] No horizontal scrollbar at 320.
- [ ] Hero headline + one sentence + primary action visible at 1280x800.
- [ ] Keyboard Tab reaches every control; focus ring visible.
- [ ] `prefers-reduced-motion: reduce` degrades all animation.
- [ ] Empty, loading, and error states exist for any async surface.
- [ ] Dark mode implemented or declared out of scope.

## Gate 6 — Accessibility and performance (class D)

**One command first:** `node .opencode/scripts/qa-perf.mjs --url <preview-url>` (or a
file/folder) measures CLS, LCP, a11y (axe-core), console/network errors and
320px overflow, and exits `0`/`1`/`3` like `qa-gate`. It is the mechanical half of
this gate — a screenshot cannot catch a layout shift, so "looks fine" is not
evidence here. Then use `chrome-devtools` MCP against the production/preview
server (never the dev server) for anything it does not cover. For an SPA whose
assets load from `/`, prefer `--url` against the preview server; if you sweep a
folder instead, add `--asset-root <ui-dir>` when the pages sit in a subfolder.

- [ ] `qa-perf` PASS (exit 0): CLS < 0.1, LCP < 2.5 s, 0 critical a11y, 0 console
      errors, no 4xx/failed request, no overflow at 320. Paste its PASS line.
- [ ] Body text contrast >= 4.5:1; large text >= 3:1.
- [ ] Images have `width`/`height` or a sized parent (no layout shift).
- [ ] Platform patterns follow current Baseline guidance (when `modern-web-guidance` is installed): correct fallbacks, no deprecated APIs.

`qa-perf` exits 3 (INCOMPLETE) when axe-core is unreachable or Chrome/puppeteer is
missing — that is not a pass. Record `WAIVED G6 <reason>` and say "G6 not measured".

## Gate 6b — Native UI (mobile, when UI changed)

Applies to React Native / Expo and Flutter. The web gates above assume a browser
and a DOM, so **G4 (`sloplint --render`), the G5 four-viewport screenshot, and the
G6 LCP/CLS are `N/A`** for a native app — do not force them. Substitute:

- [ ] Screenshot the running app on a device/emulator at phone and tablet widths; attach the files.
- [ ] Touch targets >= 44pt (iOS) / >= 48dp (Android); no overlapping hit areas.
- [ ] SafeArea respected around notches, status bar, and home indicator.
- [ ] Light and dark themes both render correctly.
- [ ] Empty, loading, and error states exist for any async surface.
- [ ] App console: zero red errors (Metro / `flutter run` logs).
- [ ] Contrast: body text >= 4.5:1, large text >= 3:1 (same rule as G6).

Declined, or no device/emulator available: record `WAIVED G6b <reason>`. Never
claim it passed.

## Gate 7 — Review (classes B-E, > 1 file)

**This gate also audits gates the machine cannot see (G5/G6).** The pre-commit
hook and CI enforce only the G4 design floor; screenshots, the a11y tree and
LCP/CLS are declared. The reviewer checks the declared class against the diff and
the handoff evidence: a class-D change with no four-viewport screenshots, no
a11y result, or no LCP/CLS is a blocking finding (or must carry an accepted
waiver). A class declared lower than the diff warrants is blocking too.

- [ ] The `reviewer` agent run; blockers addressed.
- [ ] Security checked when auth, input parsing, network, file I/O, or
      dependencies changed (the `reviewer` agent covers this).
- [ ] **Early auth review:** if the change touches auth/session/token/permission,
      `reviewer` also ran before Phase 4 (see G3b) and the guardrails are written
      down. Late-only security review for auth is a blocking finding.
- [ ] Diff is one concern. Unrelated refactors split out or dropped.

## Gate 8 — Handoff quality

State, in this order:

1. **What now works** — concrete, observable.
2. **How to see it** — exact command, URL, or path.
3. **What is deliberately not done** — and why.
4. **Open risks** — anything that could bite later.
5. **Next action** — one thing, under two minutes.

Always add one line: `VERIFY: PASS | DEFERRED | LINT-ONLY | WAIVED` with a reason
when deferred or waived. The checkpoint that sets this status lives in
`.opencode/sops/DEVELOPMENT.md`, Phase 4 "Checkpoint — verify mode". A handoff
with `VERIFY: DEFERRED` or `WAIVED` is not Done; Phase 5/6 must run before
Phase 7, or the user must accept the waiver in writing.

No "let me know if you need anything else". No recap of the plan.

## Gate 9 — CI and supply chain (all classes)

A change is not Done while it only passes locally. The CI workflow backstop
(`.opencode/ci/qa-gate.yml`) must run the same gates as this file, not only G4.

- [ ] CI runs **build + typecheck + lint + test** on every push and PR (G2 job).
- [ ] CI runs **qa-api** when `qa-api.config.json` exists (a job per backend).
- [ ] CI runs **qa-perf** when UI files exist (G6 job).
- [ ] CI installs with the **frozen lockfile** (`npm ci`, `pip install --frozen`,
      `go mod verify`). No `--no-save` installs in CI steps.
- [ ] Dependency audit runs in CI on every dep change (`npm audit` / `pip-audit` /
      `cargo audit`); a high/critical finding blocks merge.
- [ ] Release: SBOM generated and attached to the release artifact
      (`npm sbom` / `pip-audit --format=cyclonedx-json` / `cargo audit --format=json`).

When a repo has no CI yet, that is a deliberate gap — say so in the handoff under
"What is deliberately not done", never claim CI passed.

## Waiving a gate

Only when the user accepts it. Record in the handoff:

```
WAIVED G4 render: Chrome not installed; ran qa-gate --static.
Static tier clean. Install Chrome, re-run qa-gate (inputHash updates) to close this.
```

Never silently downgrade a gate. Never report a waived gate as passed.

## Time estimates (be concrete)

| Work | Estimate |
|---|---|
| One component, tokens and states existing | 15-30 min |
| One page from scratch, design included | 1-2 h |
| Feature across API + UI + tests | half a day |
| Fixing slop across an existing page | 1-3 h per page |
| New stack scaffold | 30-60 min |

State the estimate before starting when the task is larger than one component.
