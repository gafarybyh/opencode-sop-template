# Implementation Plan — MASTER INDEX (thin)

This is an INDEX, not a plan body. It answers "where are we and what is next" at a
glance. It stays <= 1 page and must NOT contain task details — those live in the
feature files and task files. If it grows, move detail down, never up.

The plan carries the five components a rigorous plan needs — objectives, scope &
deliverables, roles (RACI), timeline & milestones, and resources/risks/dependencies —
plus gates, cadence, and change control. Keep the narrative short: the task plan,
RACI, and risk log do most of the work.

Write to `docs/IMPLEMENTATION_PLAN.md`.

---

# <Project> — Implementation Plan

## 0. Header
| Field | Value |
|---|---|
| Owner | <name> |
| Status | draft / active / done |
| Last updated | <date> · Version <v0.1> |
| Go-live | <date> |

## 1. Objectives & success measures
<One paragraph: what this plan delivers and the objective it serves.>
- Benefits tracking: <who measures what, when, and in which forum> (metrics live in [PRD.md](PRD.md)).

## 2. Scope & deliverables
- In scope: <...> · Out of scope: <...>
- Key deliverables: <the things a stakeholder can inspect at the end>

## 3. Phases & milestones
| Phase | Goal | Milestone (exit criteria) | Status |
|---|---|---|---|
| P1 | <...> | <observable checkpoint that closes the phase> | todo/doing/done |

## 4. Features (index)
Status rolls up from each feature file's frontmatter; do not hand-maintain it here.
| # | Feature | Spec file | Status | Depends on |
|---|---|---|---|---|
| 01 | <auth> | [implementations/01-auth.md](implementations/01-auth.md) | todo | — |
| 02 | <billing> | [implementations/02-billing.md](implementations/02-billing.md) | todo | 01 |

## 5. Dependencies & critical path
- <feature B> blocked by <feature A> / <decision> / <external>.
- Critical path: <the chain of features/tasks that sets the earliest possible go-live>.

## 6. Risk register
Execution risks only — schedule, resourcing, dependencies, delivery. Product/business
risks live in [PRD.md](PRD.md) §9; technical risks in [TRD.md](TRD.md) §12. Roll up
their status here, do not restate them.
| Risk | Likelihood | Impact | Mitigation | Trigger / contingency | Owner |
|---|---|---|---|---|---|
| <risk> | low/med/high | low/med/high | <...> | <signal + fallback> | <name> |

## 7. RACI
| Area | Responsible | Accountable | Consulted | Informed |
|---|---|---|---|---|
| <area> | <who does it> | <who owns the outcome> | <...> | <...> |

## 8. Resources, timeline & go-live
- Team: <...> · Key dates: <...> · Go-live: <date>
- Capacity assumptions: <people x days, known constraints>

## 9. Gates (entry / exit / go-live / handoff)
Each gate needs current criteria, the evidence that proves it, and a named decision
owner. A task status or a ticked checklist is not a substitute for accepted evidence.
| Gate | Criteria (must pass) | Evidence | Decision owner |
|---|---|---|---|
| Exit P1 | <...> | <test report / demo / sign-off> | <name> |
| Go-live | <...> | <...> | <name> |
| Handoff | <...> | <...> | <name> |

## 10. Communication & status cadence
- <Who reports what, to whom, how often, in which forum>.

## 11. Change control
- <How scope/schedule changes are proposed, approved, and recorded>.

## 12. Definition of done (project level)
- <Acceptance for the whole project. Feature/task DoD live in their own files.>

## 13. Links
- Specs: [PRD.md](PRD.md) · [TRD.md](TRD.md) · [APP_FLOW.md](APP_FLOW.md) · [DESIGN_BRIEF.md](DESIGN_BRIEF.md) · [BACKEND_SCHEMA.md](BACKEND_SCHEMA.md)
