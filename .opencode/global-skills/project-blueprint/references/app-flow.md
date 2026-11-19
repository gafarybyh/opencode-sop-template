# App Flow Document

Owns how a user moves through the app: entry points, steps, decisions, error and
empty paths, screen states, and the data each step needs. Derives from the PRD and
TRD.

**Boundaries (do not duplicate).**
- **PRD** = the user stories this flow satisfies. **APP_FLOW (here)** = how a user
  actually moves to complete one task.
- **TRD** = the technical request path ("data flow"). Here, "data per step" means
  what the *user* sees or enters.
- **DESIGN_BRIEF** = visual direction. This document is behaviour, not styling.
- **BACKEND_SCHEMA** = where the data is stored. Link to it; do not redefine fields.

**One flow = one task, one persona, one outcome.** "New visitor completes signup"
is a flow; "users interact with the app" is not. Put the goal in the title so scope
creep is visible. For a large product, write one file per major flow under
`docs/flows/<area>.md`; never put the whole app in one diagram.

Write to `docs/APP_FLOW.md` (or `docs/flows/<area>.md`).

---

# <Project / Feature> — App Flow

## 0. Header
| Field | Value |
|---|---|
| Flow | <one-task title, e.g. "Guest completes checkout"> |
| Type | task flow / user flow / wireflow |
| Persona | <who> |
| Covers (PRD) | US1, US3 |
| Status | draft / in review / approved |
| Last updated | <date> · Version <v0.1> |

> Type: a **task flow** is linear (one path, no branching). A **user flow** adds
> decision points, alternate entry points, and error states. A **wireflow** adds a
> wireframe per screen. Pick the lightest type that answers the questions.

## 1. Goal & scope
- Goal (outcome): <what "done" means for the user, e.g. "order paid and confirmed">
- In scope: <screens / steps covered>
- Out of scope: <adjacent flows, with a link if they live elsewhere>

## 2. Preconditions & postconditions
- Preconditions: <state before the flow: logged in, cart non-empty, ...>
- Postconditions (success): <state after: order created, email sent, ...>
- Postconditions (abandon): <what is left behind and how it is recovered>

## 3. Entry points
| Entry point | Type | User context / intent | Landing screen |
|---|---|---|---|
| <e.g. paid ad> | deep link / ad / notification / direct / search | <first-time, needs trust> | <screen> |

> Different entry points carry different intent; the flow adapts rather than
> assuming one starting context.

## 4. Notation legend
Use four node types; a **screen is not a node** — one screen can hold an entry
point, several actions, and a decision.
- **Entry** — where a path starts.
- **Action** — what the user does (tap, submit, choose).
- **Decision** — a branch on a condition.
- **End-state** — success, failure, or exit.

## 5. Primary flow (happy path)
The shortest successful route from entry to goal. If it needs more than ~12 steps,
the task is too big — split the flow.
| # | Screen / state | User action | Advances via (hotspot) | Data shown / entered |
|---|---|---|---|---|
| 1 | <screen> | <action> | <button / link / swipe> | <fields, values> |
| 2 | <screen> | <action> | <...> | <...> |
| 3 | <end-state> | — | — | <confirmation> |

## 6. Decision points
- At step <n>, if <condition> -> <path A>; else -> <path B>.

## 7. Alternate & error paths
A flow that shows only the happy path hides its risks. Cover the edges:
| Trigger | Path | Recovery / next step |
|---|---|---|
| Payment fails | <...> | retry / fallback method |
| Empty result | <...> | empty state + next action |
| Validation error | <...> | inline error, keep input |
| Offline / timeout | <...> | retry, cache |
| Unauthorized / expired session | <...> | re-auth, return to step |
| Permission prompt (camera, location, notifications) | <...> | deny path + re-prompt |
| User abandons / returns later | <...> | save & resume |

## 8. Screen states
| Screen | Empty | Loading | Error | Success | Partial / permission |
|---|---|---|---|---|---|
| <name> | <...> | <...> | <...> | <...> | <...> |

## 9. Data per step (what the user sees / enters)
| Step | Reads (source) | Writes / submits | Notes |
|---|---|---|---|
| 1 | <field — from BACKEND_SCHEMA> | <field> | <validation> |

## 10. Diagram
- Flowchart or wireflow (screen + hotspot). <link or ASCII sketch>
- For a wireflow: one wireframe per screen, arrows for hotspots and the data passed.

## 11. Accessibility & edge considerations
- Keyboard / screen-reader path through each step: <...>
- Reduced motion, slow network, small screen: <...>
- Copy for errors and empty states (plain language): <...>

## 12. Open questions
| # | Question | Owner | Needed by |
|---|---|---|---|
| Q1 | <...> | <name> | <date> |

## 13. Links
- Upstream: [PRD.md](PRD.md) · [TRD.md](TRD.md) · Design: [DESIGN_BRIEF.md](DESIGN_BRIEF.md) · Data: [BACKEND_SCHEMA.md](BACKEND_SCHEMA.md)
