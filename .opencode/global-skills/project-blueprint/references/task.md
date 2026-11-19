# Per-Task File

One file per task, under `docs/implementations/tasks/<feature>/TNN-<slug>.md`. A task
is one unit of work with a single verify. Keep <= 100 lines; if bigger, it is two
tasks.

Write to `docs/implementations/tasks/<feature>/TNN-<slug>.md`.

## Frontmatter (required)

```yaml
---
id: TNN
feature: <slug>
status: todo            # todo | doing | blocked | done
depends-on: []          # task ids this needs first
owner: <name or TBD>
estimate: <e.g. 4h or TBD>
verify: <command that proves done>
---
```

---

# TNN — <Task title>

## 1. Goal
<The one thing this task achieves.>

## 2. Context
- Why: <the feature requirement this serves, link it>
- Preconditions: <what must be true before starting>

## 3. Steps
1. <...>
2. <...>

## 4. Files touched
- create: <paths>
- modify: <paths>

## 5. Acceptance / Done when
Conditions that can fail — a tester accepts or rejects without asking the author.
- [ ] <falsifiable condition>
- [ ] Verify passes: `<command>` -> expected <result>

## 6. Evidence
- What proves it is done: <test output / screenshot / log / PR link>. A status or a
  ticked box is not a substitute for this.

## 7. Depends on / blocks
- Depends on: <task ids>
- Blocks: <task ids>

## 8. Notes & risks
- <...>

## 9. Links
- Feature: [../../NN-<feature>.md](../../NN-<feature>.md)
