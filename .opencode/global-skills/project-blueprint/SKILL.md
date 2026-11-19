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
documents only - it does not write application code.

## Output layout (always under `docs/`)

```
docs/
|-- PRD.md
|-- TRD.md
|-- APP_FLOW.md
|-- DESIGN_BRIEF.md
|-- BACKEND_SCHEMA.md
|-- IMPLEMENTATION_PLAN.md          # thin master index
`-- implementations/
    |-- NN-<feature>.md             # one spec per feature
    `-- tasks/
        `-- <feature>/
            `-- TNN-<task>.md       # one task per file
```

## The six documents and their order

Documents depend on each other; generate upstream first, then link down.

```
PRD (what & why)
 `--- TRD (how, technically)
     |--- APP_FLOW (user journey)
     |--- DESIGN_BRIEF (visual direction)
     `--- BACKEND_SCHEMA (data model)
         `--- IMPLEMENTATION_PLAN (execution: master + features + tasks)
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

## Question tiers (BLOCKING vs OPTIONAL)

Not every unknown is equal. Separate them so the run never silently guesses a
structure-defining decision, and never stalls on trivia.

- **BLOCKING** - an answer that changes the *structure* of a document. Ask before
  writing that document and **wait**; do not pick a default for a BLOCKING question.
  Examples: data store / DB engine, auth model, payment gateway (real vs placeholder),
  money format, whether shoppers have accounts, core entities, whether the API is
  REST/GraphQL. Writing past a BLOCKING question means you are inventing structure.
- **OPTIONAL** - everything else. Do not stop for it: take the stated default, or the
  most obvious one, and record it as `TBD` with the question to ask (see the Open
  Questions table). OPTIONAL questions never block a document.
- **When unsure, default to OPTIONAL.** Only escalate to BLOCKING when two plausible
  answers would produce materially different documents that are expensive to unwind.
- **State the classification when you ask**, e.g. "BLOCKING: which DB?" vs
  "OPTIONAL (I will assume X if you do not say)". A BLOCKING question that the user
  cannot answer yet is a decision to stop and say so, not to guess.
- **Always offer a recommendation.** For every question - BLOCKING and OPTIONAL - lead
  with the option you recommend plus one line of why (grounded in the docs, the stated
  constraints, or a clearly labelled default - never invented), then 1-2 alternatives,
  so the user can accept in one word. Example: "BLOCKING - DB engine? Recommend
  PostgreSQL 16 (relational integrity for orders/totals; matches a small catalog).
  Alternatives: MySQL 8, SQLite (dev only)." A recommendation on a BLOCKING question
  is still only a suggestion: wait for the user's confirmation; never treat your own
  recommendation as the answer.
- **Ask through the interactive question tool.** When the harness provides one (e.g.
  opencode's question tool), present questions as a picker the user selects from -
  not a wall of prose. Put the recommended option **first** and mark it
  `(Recommended)`, follow with 1-2 alternatives, and let the tool's own "type your own
  answer" cover free input. Batch related questions in one call (up to 5). If no such
  tool exists, fall back to a numbered text list with the same order: recommended
  first, alternatives after.

## Workflow

1. **Ground first.** List `docs/`. If a document already exists, read it and
   extend it - never overwrite silently. Ask before replacing anything.
2. **Scope the run.** Ask one short list (max 5 questions): which documents to
   produce, the project/feature name, and anything unknown that changes structure.
   Classify each as **BLOCKING** or **OPTIONAL** and **attach a recommendation +
   1-2 alternatives** (see "Question tiers" below); ask them through the interactive
   question tool when available. Wait for every BLOCKING answer
   before writing the document it affects; take stated or obvious defaults for
   OPTIONAL ones.
3. **Produce upstream -> downstream.** Write in the order above. Each document
   links to the ones it derives from.
4. **Split the implementation plan.** The master file is an index; features are one
   file each; tasks are one file each. Never put task detail in the master.
5. **Cross-link, do not duplicate.** A fact lives in exactly one document; others
   point to it by relative link.
6. **Verify before you report.** Run every check in `references/verification.md`
   against `docs/` (and `scripts/verify_blueprint.py` for the mechanical ones).
   Produce a verification table (`Check | PASS/FAIL/WAIVED | Evidence`). Fix
   failures, or record each as an explicit, user-accepted exception. Do not report
   "done" while any check FAILs silently. Prefer an independent checker (the
   `reviewer` subagent) so the author is not the only reviewer.
7. **Offer to close open questions (optional, never blocking).** After the docs
   verify, collect every `TBD` / Open Question across the docs into one table
   (`Q# | Doc | Question | Owner | Needed by`) and ask the user once which, if any,
   they want to answer now. When you present them, give each question a recommended
   answer (with a one-line why) plus 1-2 alternatives, so the user can accept with one
   word - through the interactive question tool when available (recommended option
   first). By this point every BLOCKING question must already be answered - if a structural decision is still `TBD`, stop and resolve it first
   (verification Sec. 7 will FAIL otherwise); the offer here is only for OPTIONAL
   questions. For each answer, update the owning document and mark the question
   resolved - never invent an answer for one the user leaves open. Anything
   unanswered stays `TBD`. If an answer changes a fact, re-run the affected
   verification checks (Sec. 3-6). This is an offer, not an interrogation: a
   blueprint is still "done" with OPTIONAL open questions left open.
8. **Report.** List the files created, the verification table, the open questions
   still open, and the one next action.

## Rules

- **One source of truth per fact.** The PRD owns what/why; the TRD owns technical
  decisions; the schema owns the data model. Never restate a fact in a second
  file - link to it.
- **Diagrams are derived views.** Draw flow (App Flow Sec.  Diagram), ERD (Backend
  Schema Sec.  ERD), architecture (TRD Sec.  System architecture), and feature dependencies
  (Implementation Plan Sec.  Dependencies) with **Mermaid**, using stable types only
  (`flowchart`, `sequenceDiagram`, `erDiagram`, `stateDiagram-v2`, `journey`; avoid
  the experimental C4 / `architecture-beta`). A diagram never becomes a second source
  of truth: the tables and text own the facts and the diagram only mirrors them -
  when they differ the table wins and a mismatch is a review question. Update the
  diagram in the same change, keep each small, and split by area rather than one
  mega-diagram.
- **Anti-god-file.** `IMPLEMENTATION_PLAN.md` is an index, target <= 1 page: it
  holds objectives, scope, phases, milestones, a feature table, dependencies &
  critical path, risks, gates, cadence, and go-live - never the task list. Feature
  files target <= 200 lines; task files <= 100 lines. Past that, split.
- **Measurable over adjectives.** Metrics and NFRs carry numbers ("LCP < 2.5 s",
  "+15% conversion"), never "fast" or "better UX".
- **Existing project: inherit.** If `docs/` already has documents or a codebase
  exists, match their shape and naming; do not impose this template's names over an
  established convention. Report differences.
- **No invented content.** No fake metrics, personas, testimonials, or APIs. Mark
  unknowns as `TBD` with the question to ask - except BLOCKING unknowns, which must
  be answered before the affected document is written, never left as `TBD` (see
  Question tiers).
- **ASCII only, no mojibake.** Write every file in plain ASCII: no smart quotes,
  em/en dashes, arrows, box-drawing, or other non-ASCII symbols. Write `->`, `-`,
  `>=`, `<=`, `x`, `...`, `section` (or `Sec.`) instead. Non-ASCII shows up as
  garbled characters (mojibake) in Windows consoles and editors on cp1252/cp936,
  so keep the text ASCII and save files as UTF-8 without a BOM.

## Done

Every requested document exists under `docs/`, cross-linked, with the
implementation plan split into master + features + tasks, **and** it passes
every check in `references/verification.md` (structure, mechanical, ID
traceability, single source of truth, data-model coverage, no invented content,
open questions, lifecycle closure), **and** no BLOCKING question is left
unresolved (an unanswered BLOCKING question is a stop, not a `TBD`). Done is
blocked until each check is PASS or an explicitly user-accepted WAIVED. Report the
paths, the verification table, and the next action.
