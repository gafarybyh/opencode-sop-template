# Blueprint Verification (final gate)

A read-only pass over `docs/` **after** all requested files exist. This is the step
that catches the failures the writing pass misses: ghost IDs, a decision stated two
ways, a field a user story needs but the schema never stores, an invented metric.
Run it every time; a blueprint is not done until this gate passes.

- **Run it as an independent check.** Prefer the `reviewer` subagent so the author
  is not the only reviewer. The author re-reading their own work is not verification.
- **Output a table**, one row per check: `Check | PASS / FAIL / WAIVED | Evidence`
  (name the file + line, or the command output, that proves it). "Looks fine" is not
  evidence.
- **Fix or waive.** Fix every FAIL. If a FAIL is genuinely acceptable, record it as
  `WAIVED` with the user-accepted reason. Never report "done" while a check FAILs
  silently.
- **Mechanical checks first.** Run `scripts/verify_blueprint.py docs` (if the skill's
  scripts folder is available) to clear the mechanical and ID-origin checks fast,
  then do the semantic checks by reading the docs.

Sections 1-2 are automatable. Sections 3-8 are judgement calls that need reading the
docs; the script prints candidates (all `USx`/`FRx`/`Qx` referenced vs defined) to
make them quick.

---

## 1. Structure

- [ ] All requested documents exist at the required paths under `docs/`.
- [ ] `IMPLEMENTATION_PLAN.md` is an index - it holds no task list (target <= 1 page).
- [ ] One file per feature (`implementations/NN-<feature>.md`), one per task
      (`implementations/tasks/<feature>/TNN-<task>.md`); no task detail in a feature file.
- [ ] Every feature file has all 6 frontmatter keys: `feature, status, depends-on,
      owner, priority, estimate`.
- [ ] Every task file has all 7 frontmatter keys incl. a non-empty `verify`.
- [ ] Size limits: feature <= 200 lines, task <= 100 lines (past that, split).

## 2. Mechanical

- [ ] **ASCII only** - no smart quotes, em/en dashes, arrows, box-drawing, non-breaking
      spaces, or other non-ASCII. Save UTF-8 without BOM.
- [ ] Every relative markdown link resolves to a real file (no dead links, no `#anchor`
      to a heading that does not exist).
- [ ] `Last updated` / `Version` are consistent across the docs written in the same run
      (a split date set signals docs stitched from different sessions).
- [ ] Every Mermaid block uses a stable type (`flowchart`, `sequenceDiagram`,
      `erDiagram`, `stateDiagram-v2`, `journey`) and is labelled a derived view.

## 3. ID traceability (the most common failure)

Ghost IDs are the single biggest defect: a downstream doc cites a user story or
functional requirement that the upstream doc never defines.

- [ ] **Every `USx` referenced anywhere exists in PRD Sec. 6.** List orphans
      (e.g. a schema/feature citing US9-US13 when the PRD stops at US8).
- [ ] **Every `FRx` referenced anywhere exists in TRD Sec. 3.** List orphans
      (e.g. a feature citing FR10 when the TRD stops at FR9).
- [ ] Each feature's "PRD user stories" and "TRD requirements" lines point to real IDs
      **and** the cited stories actually match that feature's scope (not just present).
- [ ] Every **Must** user story is covered by at least one FR and at least one
      feature/task. Every FR maps back to a US.
- [ ] Every feature file's traceability block is present (no feature left with an empty
      "PRD user stories" / "TRD" line while other features fill theirs).

## 4. Single source of truth

The skill's core rule is "one source of truth per fact". Verify it, do not assume it.

- [ ] For each shared fact (status enum values, cart model, money format, auth method,
      session cookie name), grep every doc and confirm **one** canonical value; the
      other docs link to it instead of restating a different value.
- [ ] A decision made in the TRD (e.g. "client-side localStorage cart" vs "server cart")
      is **not contradicted** by the schema, a feature file, or a task. Flag any
      architecture decision that two documents implement differently.
- [ ] Enum/status values are identical everywhere they appear (e.g. `pending_payment`
      in PRD/TRD vs `Pending`/`pending` in schema/API is a FAIL until reconciled to one
      canonical spelling).

## 5. Data-model coverage

A story that needs data the schema cannot store is a silent break - the build will
stall or lose information.

- [ ] Every field a user story or app-flow step says the user **enters or sees** has a
      column or entity that stores it (e.g. guest checkout collecting name, email,
      phone, address requires those columns on `orders` or a customer table).
- [ ] Every entity/table named in a feature file exists in `BACKEND_SCHEMA.md`, and
      every schema table is claimed by some feature or the TRD.
- [ ] PII classification agrees: what the TRD Sec. 9 calls PII must be marked PII in the
      schema's data-classification section (and vice versa). "No PII captured" in the
      schema while the TRD lists PII is a FAIL.
- [ ] Referential actions in the schema do not make a promised operation impossible
      (e.g. an admin "remove product" story vs a `restrict` FK that blocks deletion).

## 6. No invented content

- [ ] Every number in a metric, NFR, or success criterion traces to the PRD/TRD, or is
      `TBD` with the question to ask. Any hard figure with no upstream source (e.g. an
      "80% checkout completion" target when the PRD marks it TBD) is a FAIL.
- [ ] No invented personas, testimonials, logos, customers, or API endpoints.
- [ ] Assumptions are labelled as assumptions, with the "default if wrong" where the
      template asks for it.

## 7. Open questions

- [ ] Every `Q#` referenced anywhere exists in that document's Open Questions table
      (a `Q7` cited but only `Q8`/`Q9` defined is a dangling reference - FAIL).
- [ ] Mirrored questions across docs use the same number and meaning (PRD Q1 = TRD Q1).
- [ ] Each open question that gates work has an owner and a "needed by".
- [ ] **No BLOCKING question is left as `TBD`.** A question whose answer changes the
      document's structure (DB engine, auth model, real vs placeholder payment, money
      format, whether shoppers have accounts, core entities, REST/GraphQL) must have
      been answered before the doc was written. If a structural decision is still
      `TBD`/`pending`, that is a FAIL: the author guessed structure or stalled. A `TBD`
      on a non-structural (OPTIONAL) detail is fine.

## 8. Lifecycle closure

- [ ] PRD Definition of Done, TRD Definition of Done, and the IMPLEMENTATION_PLAN gates
      together cover every Must story and every NFR.
- [ ] The IMPLEMENTATION_PLAN dependency graph matches the feature `depends-on`
      frontmatter (no feature depends on something the graph omits, and vice versa).
- [ ] The critical path in the plan is a real path through the declared dependencies.

## 9. Offering to close open questions (optional, never blocking)

Open questions (`TBD` + `Q#`) are allowed to survive into build - that is the point
of the table. But the user may want to answer some now, so offer once, do not
interrogate.

- [ ] Collect every `TBD` / Open Question across all docs into one table:
      `Q# | Doc | Question | Owner | Needed by`. `scripts/verify_blueprint.py docs
      --questions` prints this list to start from.
- [ ] Ask the user **once** which, if any, they want to answer now - via the
      interactive question tool when available. Present each with a **recommended
      answer + one-line why** (recommended option first), plus 1-2 alternatives, so the
      user can accept with one word.
- [ ] For each answer: update the owning document and mark the question resolved
      (move it out of the Open Questions table or mark it answered). Never invent an
      answer the user did not give - unanswered stays `TBD`.
- [ ] If an answer changes a fact (a metric, a status value, a data field), re-run the
      affected checks (Sec. 3-6) before reporting.
- [ ] A blueprint with open questions still open is still DONE. This step is an offer,
      not a gate.

---

## Reporting

End the run with the table and one next action, e.g.:

```
| Check                  | Result | Evidence                                        |
|------------------------|--------|-------------------------------------------------|
| 1. Structure           | PASS   | 28 files, frontmatter 7/7 features, 15/15 tasks |
| 3. ID traceability     | FAIL   | 04-admin-products.md:20 cites US9-US12 (PRD US1-US8) |
| 5. Data-model coverage | FAIL   | orders has no email/phone/address; US3 needs them |
| ...                    | ...    | ...                                             |
```

A FAIL that the user accepts becomes `WAIVED` with the reason recorded next to it.
Otherwise the blueprint is not done.
