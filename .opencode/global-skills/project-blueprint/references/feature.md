# Per-Feature Spec

One file per feature, under `docs/implementations/NN-<feature>.md`. Owns the
feature's scope, traceability, acceptance, and its task index. Task detail goes in
task files, not here. Target <= 200 lines; past that, the feature is probably two
features.

Write to `docs/implementations/NN-<feature>.md`.

## Frontmatter (required)

```yaml
---
feature: <slug>
status: todo            # todo | doing | blocked | done
depends-on: []          # feature slugs this needs first
owner: <name or TBD>
priority: must | should | could
estimate: <e.g. 3d or TBD>
---
```

---

# <NN> — <Feature name>

## 1. Goal
<What this feature delivers, observable, in one or two sentences.>

## 2. Scope
- In: <...>
- Out: <...>

## 3. Traceability
Every feature can explain what asked for it.
- PRD user stories: <US1, US3>
- TRD requirements: <FR2, NFR performance>
- Screens / flow: [APP_FLOW.md](../APP_FLOW.md) — <which flows>
- Tables: [BACKEND_SCHEMA.md](../BACKEND_SCHEMA.md) — <which tables>

## 4. Dependencies
- Needs (before): <feature / task / decision>
- Unblocks (after): <feature / task>

## 5. Tasks (index)
Status rolls up from each task file's frontmatter; do not hand-maintain it here.
| ID | Task | File | Status | Depends on | Owner |
|---|---|---|---|---|---|
| T01 | <...> | [tasks/<feature>/T01-<slug>.md](tasks/<feature>/T01-<slug>.md) | todo | — | <name> |
| T02 | <...> | [tasks/<feature>/T02-<slug>.md](tasks/<feature>/T02-<slug>.md) | todo | T01 | <name> |

## 6. Acceptance / DoD
- [ ] <testable, falsifiable condition>
- [ ] <...>

## 7. Verify
- <exact command(s) that close this feature>

## 8. Risks & notes
- <feature-specific risk or open issue, and how it is handled>

## 9. Links
- [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) · [PRD.md](../PRD.md) · [TRD.md](../TRD.md) · [APP_FLOW.md](../APP_FLOW.md) · [DESIGN_BRIEF.md](../DESIGN_BRIEF.md) · [BACKEND_SCHEMA.md](../BACKEND_SCHEMA.md)
