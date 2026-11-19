---
name: project-blueprint
description: "Generate the six planning documents for a project before any code: Product Requirements (PRD), Technical Requirements (TRD), App Flow, Design Brief, Backend Schema, and an Implementation Plan (a thin master index plus per-feature specs and per-task files). Use when the user wants to plan, spec, or blueprint a project or feature, asks for a PRD or spec, or says 'buat blueprint project'. Writes everything under docs/."
argument-hint: "<project or feature> | <one or more docs> | continue"
version: 1.0.0
metadata:
  opencode/slash: "true"
---

# Project Blueprint

Turn a rough idea into six linked planning documents, written under `docs/`, so an
agent or a team can build from them instead of guessing. This skill produces
documents only — it does not write application code.

## Output layout (always under `docs/`)

```
docs/
├── PRD.md
├── TRD.md
├── APP_FLOW.md
├── DESIGN_BRIEF.md
├── BACKEND_SCHEMA.md
├── IMPLEMENTATION_PLAN.md          # thin master index
└── implementations/
    ├── NN-<feature>.md             # one spec per feature
    └── tasks/
        └── <feature>/
            └── TNN-<task>.md       # one task per file
```

## The six documents and their order

Documents depend on each other; generate upstream first, then link down.

```
PRD (what & why)
 └─ TRD (how, technically)
     ├─ APP_FLOW (user journey)
     ├─ DESIGN_BRIEF (visual direction)
     └─ BACKEND_SCHEMA (data model)
         └─ IMPLEMENTATION_PLAN (execution: master + features + tasks)
```

| # | Document | Answers | Template |
|---|---|---|---|
| 1 | PRD | What and why | `references/prd.md` |
| 2 | TRD | How, technically | `references/trd.md` |
| 3 | App Flow | The user's journey | `references/app-flow.md` |
| 4 | Design Brief | Visual direction | `references/design-brief.md` |
| 5 | Backend Schema | The data model | `references/backend-schema.md` |
| 6 | Implementation Plan | Order of execution | `references/implementation-plan.md`, `references/feature.md`, `references/task.md` |

Load only the template(s) for the document(s) you are writing now. Do not load all
six at once.

## Workflow

1. **Ground first.** List `docs/`. If a document already exists, read it and
   extend it — never overwrite silently. Ask before replacing anything.
2. **Scope the run.** Ask one short list (max 5 questions): which documents to
   produce, the project/feature name, and anything unknown that changes structure.
   Take stated defaults for the rest.
3. **Produce upstream -> downstream.** Write in the order above. Each document
   links to the ones it derives from.
4. **Split the implementation plan.** The master file is an index; features are one
   file each; tasks are one file each. Never put task detail in the master.
5. **Cross-link, do not duplicate.** A fact lives in exactly one document; others
   point to it by relative link.
6. **Report.** List the files created and the one next action.

## Rules

- **One source of truth per fact.** The PRD owns what/why; the TRD owns technical
  decisions; the schema owns the data model. Never restate a fact in a second
  file — link to it.
- **Anti-god-file.** `IMPLEMENTATION_PLAN.md` is an index, target <= 1 page: it
  holds objectives, scope, phases, milestones, a feature table, dependencies &
  critical path, risks, gates, cadence, and go-live — never the task list. Feature
  files target <= 200 lines; task files <= 100 lines. Past that, split.
- **Measurable over adjectives.** Metrics and NFRs carry numbers ("LCP < 2.5 s",
  "+15% conversion"), never "fast" or "better UX".
- **Existing project: inherit.** If `docs/` already has documents or a codebase
  exists, match their shape and naming; do not impose this template's names over an
  established convention. Report differences.
- **No invented content.** No fake metrics, personas, testimonials, or APIs. Mark
  unknowns as `TBD` with the question to ask.

## Done

Every requested document exists under `docs/`, cross-linked, with the
implementation plan split into master + features + tasks. No document restates
another's facts. Report the paths and the next action.
