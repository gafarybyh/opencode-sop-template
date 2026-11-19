# Design Brief Document

Owns the direction a designer needs to execute: the problem, the audience, one
measurable objective, scope and constraints, visual direction, deliverables, and
who approves. One to two pages. It is a direction document for the designer; it is
not a design system, and not a rulebook.

**Boundaries (do not duplicate).**
- **PRD** = what/why and the user stories. The DESIGN_BRIEF translates that into
  design intent; it does not restate requirements.
- **APP_FLOW** = behaviour and steps. The DESIGN_BRIEF covers look, feel, and
  visual intent — not the flow.
- **Design system / design law (if the project has one)** = the locked tokens,
  components, and rules the UI build must obey. The BRIEF is an input to design; it
  does not replace or generate that system.
- This is a brief, not a pixel spec. Keep it 1-2 pages; delete any optional section
  that would not change the design.

**One objective per brief.** "A brief with two goals gets a design that serves
neither." Pick the single decision this project forces, and the measure that proves
it worked.

Write to `docs/DESIGN_BRIEF.md`.

---

# <Project / Feature> — Design Brief

## 0. Header
| Field | Value |
|---|---|
| Project | <name> |
| Owner / requester | <name> |
| Designer | <name or TBD> |
| Approver (decision-maker) | <name> |
| Status | draft / in review / approved |
| Last updated | <date> · Version <v0.1> |
| Related | [PRD.md](PRD.md) · [APP_FLOW.md](APP_FLOW.md) |

## 1. Background & context
<The situation and why this project exists now, in a few lines. Link the PRD.>

## 2. Problem statement
<The user challenge the design must solve. No solution language — describe the
problem, not a chosen answer.>

## 3. Objective & success metric
- Objective (one): <the single decision/outcome this design drives>
- Measure: <how success is proven — e.g. "+15% signup completion (from 42%)">
- (If the PRD already defines metrics, link them instead of restating.)

## 4. Target audience
- **<Persona>** — <demographics, psychographics, what they need, context of use:
  device, environment, ability, language>. Link PRD personas rather than copy them.

## 5. Scope & constraints
- In scope: <screens / surfaces / deliverables>
- Out of scope (explicit): <what is deliberately excluded — naming it prevents more
  arguments than naming what is included>
- Constraints:
  - Technical: <e.g. must work on iOS 15+, 3G, 320px width>
  - Business: <e.g. cannot change pricing model; brand rules>
  - Timeline: <e.g. prototype by a date>
- Accessibility standard: <e.g. WCAG 2.2 AA, touch targets, contrast>
- Localization: <languages, RTL, formats>

## 6. Competitive & market context (optional)
- <What competitors do; where the gaps are. Prevents reinventing what already exists.>

## 7. Brand assets & existing system (optional)
- Logo, colours, typography, existing tokens/components to reuse: <links / paths>
- If the project already has a design system (tokens/components) or a design-law
  SOP, follow it; do not invent a parallel one.

## 8. Design direction & references
- Mood / tone: <3-5 concrete adjectives>
- References (2-3): <link or name — and what to take from each (palette balance,
  type voice, layout idea), never copy wholesale>
- Anti-references (optional): <what to avoid, and why>

## 9. Deliverables & formats
- <Screens, components, design tokens, prototype, spec handoff — with format and
  spec (e.g. Figma file, token JSON, redlines)>

## 10. Technology & platform constraints (optional)
- Target platforms and breakpoints: <web / iOS / Android; sizes>
- Performance budget the design must respect: <e.g. LCP < 2.5 s, image weight>

## 11. Stakeholders, approver & decision-maker
| Role | Name |
|---|---|
| Approver (final sign-off) | <name> |
| Reviewers | <names> |
| Informed | <names> |

## 12. Feedback & approval rules
- Feedback channel and cadence: <where, how often>
- Review rounds: <e.g. max 2 rounds, then decide>
- Sign-off criteria: <what "approved" means>

## 13. Budget & timeline
- Budget / effort: <range or TBD>
- Milestones: <concept — date · review — date · final — date>

## 14. Open questions
| # | Question | Owner | Needed by |
|---|---|---|---|
| Q1 | <...> | <name> | <date> |

## 15. Links
- Upstream: [PRD.md](PRD.md) · Flow: [APP_FLOW.md](APP_FLOW.md) · Existing design system / design law (if any)
