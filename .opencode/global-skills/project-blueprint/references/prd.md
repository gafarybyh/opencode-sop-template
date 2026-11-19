# Product Requirements Document (PRD)

Owns the problem, the users, what is built, and how success is measured - the
"what and why". Every other document derives from this one. Keep it
outcome-focused; leave technical decisions to the TRD.

**Boundary with the TRD.** The PRD states product intent. Do not duplicate the
TRD: functional decomposition and *numeric* NFR targets (p95 latency, uptime) live
in `TRD.md`. Here, NFRs appear only as product constraints ("must meet WCAG 2.2 AA",
"EU data residency", "works offline"). Requirement detail rides on prioritised user
stories, not a second requirements table.

Write to `docs/PRD.md`.

---

# <Project / Feature> - Product Requirements

## 0. Header
| Field | Value |
|---|---|
| Status | draft / in review / approved |
| Owner | <name> |
| Reviewers | <names> |
| Last updated | <date> |
| Version | <v0.1> |

**Change log**
| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | <date> | <name> | Initial draft |

## 1. TL;DR
- <The change in one line.>
- <Who it is for and the outcome.>
- <The single most important metric.>

> Three to five bullets. If a reader stops here, they still know what and why.

## 2. Problem statement
<The user problem and its context in 2-4 sentences. Who hurts, and why now.>

> No solution language here. "Users need a dashboard" is a solution; "users cannot
> see yesterday's numbers without asking an analyst" is a problem.

## 3. Goals & success metrics
| Goal | Metric | Baseline | Target | By when | How measured |
|---|---|---|---|---|---|
| <goal> | <metric> | <current> | <number> | <date> | <source> |

> Metrics must be measurable with a baseline and a target. "Improve UX" is not a
> metric; "+15% checkout completion (from 42%) within 30 days" is.

## 4. Non-goals / out of scope
- <explicitly excluded - this prevents scope creep>
- <adjacent problem we are deliberately not solving now>

## 5. Users & personas
- **<Persona>** - <need, context, what they care about>.

## 6. User stories & acceptance criteria
Each story carries an ID, a priority, and testable acceptance. Requirement detail
lives here; the TRD does not repeat it.

- **US1** (Must) As a <role>, I want <capability> so that <outcome>.
  - Acceptance: Given <context>, when <action>, then <observable result>.
- **US2** (Should) <...>

> Priority: Must / Should / Could. Acceptance is Given/When/Then and must be
> testable without asking the author a question.

## 7. Non-functional constraints (product level)
State the expectation; the TRD turns it into a number.
- Accessibility: <e.g. WCAG 2.2 AA>
- Localization: <languages, RTL, formats>
- Data residency / privacy: <e.g. EU data stays in EU>
- Performance expectation: <e.g. feels instant on 3G> (target in TRD)
- Compatibility: <browsers, devices, OS versions>

## 8. Assumptions & dependencies
- Assumption: <...> (default if wrong: <...>)
- Dependency: <team / system / decision / external API>

## 9. Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| <business/product risk> | low/med/high | low/med/high | <...> |

> Product and business risks here; technical risks belong in the TRD.

## 10. Milestones / phasing
- <milestone / phase> - <date or exit condition>

## 11. Open questions
| # | Question | Owner | Needed by |
|---|---|---|---|
| Q1 | <...> | <name> | <date> |

## 12. Definition of done / release criteria
- [ ] <product-level condition: tests, docs, analytics, comms>
- [ ] <all Must stories meet their acceptance criteria>

## 13. Links
- Technical: [TRD.md](TRD.md)
- Flow: [APP_FLOW.md](APP_FLOW.md) - Design: [DESIGN_BRIEF.md](DESIGN_BRIEF.md) - Data: [BACKEND_SCHEMA.md](BACKEND_SCHEMA.md)
- Execution: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
