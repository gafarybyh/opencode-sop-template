# OpenCode SOP Template

![opencode 2.x](https://img.shields.io/badge/opencode-2.x-3b82f6)
![platform](https://img.shields.io/badge/platform-Windows%20PowerShell%205.1-012456)
![license](https://img.shields.io/badge/license-see%20Credits-lightgrey)

A portable `.opencode/` folder plus one `AGENTS.md`. Copy both into a project and
the agent knows how to build web apps **without producing AI slop** — it reads the
project docs first, detects the real stack, follows a phased procedure, and proves
its work with a linter, screenshots, and hard quality gates.

Built for **opencode 2.x**; works with any agent that reads `AGENTS.md` + `SKILL.md`.
The SOP text is portable; the install scripts are **Windows PowerShell 5.1** only.

> **This file is the short version.** It answers *what this is and how to run it*.
> The full guide — every step, every MCP decision, the troubleshooting tables and
> the design rationale — is in **[`SETUP.md`](SETUP.md)**.

---

## Contents

- [Features](#features)
- [Quick start](#quick-start)
- [What gets installed](#what-gets-installed)
- [Repository layout](#repository-layout)
- [What is inside](#what-is-inside)
- [How it works](#how-it-works)
- [Verify](#verify)
- [Requirements](#requirements)
- [Good to know](#good-to-know)
- [Credits and licenses](#credits-and-licenses)

---

## Features

- **Docs-first, detect-second.** The project documents in `docs/` are the source
  of truth; the stack is detected from real manifests, never assumed.
- **Phased procedure (0a → 7).** Requirements → detect → understand → spec → plan
  → build → mechanical verify → visual verify → review. Each phase has an exit
  condition.
- **Evidence, not adjectives.** Done means `sloplint` clean, screenshots at
  320 / 768 / 1280 / 1440, and LCP < 2.5 s / CLS < 0.1 — not "looks good".
- **Anti-slop design floor.** A deterministic linter (`sloplint`) plus a 151-rule
  design rulebook and a concrete ban catalogue.
- **Small context, on demand.** `AGENTS.md` is a thin router; detailed SOPs and
  skills load only when their trigger fires — no dumping every rule up front.
- **Specialised subagents.** `develop`, `ui-designer`, `reviewer`, `planner` —
  each with the right permissions (reviewers cannot edit).
- **Two-layer install.** The SOP is copied per project; machine tools, plugins
  and MCP servers are installed once per PC.

---

## Quick start

Double-click **`Setup.bat`**. One menu does everything: install the machine layer,
copy the SOP into a project, check what is missing, or open the project in opencode.

```powershell
Setup.bat                          # interactive menu
Setup.bat setup "C:\dev\my-app"    # full setup, no prompts
Setup.bat machine                  # machine layer only
Setup.bat copy  "C:\dev\my-app"    # copy the SOP into a project
Setup.bat status                   # check what is present
```

The menu is a console UI, so it works over RDP and in terminals without a desktop.
When a desktop is available it opens a folder picker for the destination.

The two halves can also run separately:

```powershell
# Machine layer only (once per PC)
powershell -NoProfile -ExecutionPolicy Bypass -File ".\.opencode\scripts\bootstrap-windows.ps1"

# Project copy only
powershell -NoProfile -ExecutionPolicy Bypass -File ".\.opencode\scripts\copy-to-project.ps1" -Destination "C:\path\to\new-project"
```

Finally, replace `PROJECT_NAME` in `AGENTS.md` before the first real task.

---

## What gets installed

Two layers, split so each fact lives in exactly one place.

| Layer | What it contains | Installed by |
|---|---|---|
| **Per project** | the SOP: `sops/`, `agents/`, `commands/`, `skills/`, `instructions/`, `plugins/graphify-auto-update.js`, `AGENTS.md`, `.gitignore` | `copy-to-project.ps1` |
| **Per machine** (`~/.config/opencode`) | MCP servers (`chrome-devtools`, optional `tavily`), package plugins (`context-mode`), the global `AGENTS.md`, the `SHELL` env var, CLI tools (`opencode`, `rtk`, `graphify`, `playwright-cli`) | `bootstrap-windows.ps1` |

MCP servers and package plugins are deliberately **not** copied into projects: one
machine-wide definition serves every project. To add an MCP server, edit the global
config, not the template.

---

## Repository layout

```
opencode-template/
├── Setup.bat          <- the one door; stays here, never copied
├── AGENTS.md          <- the routing table that gets copied
├── .gitignore         <- single source of truth, copied into projects
├── README.md          <- this file
├── SETUP.md           <- the full setup guide
└── .opencode/         <- the SOP: sops, agents, commands, skills, scripts
```

A project after copying:

```
my-app/
├── docs/              your documents (PRD, STACK, features, ADR)
├── src/ ...           code
├── AGENTS.md          the only setup file at the root
├── .gitignore         copied from the template, covers generated files
└── .opencode/         everything else
```

---

## What is inside

| Path | What it is |
|---|---|
| `Setup.bat` | One-door setup menu (stays in the template, not copied) |
| `AGENTS.md` | Routing table and hard rules; opencode reads it automatically |
| `.gitignore` | Single source of truth for what must never be committed |
| `.opencode/sops/` | Five procedures + `stacks/` (one file per stack) + `context/TROUBLESHOOTING.md` |
| `.opencode/agents/` | `develop` (primary) plus `ui-designer`, `planner`, `reviewer` (subagents) |
| `.opencode/commands/` | `/stack`, `/new-feature`, `/ship`, `/build-ui`, `/ui-audit`, `/i-have-adhd` |
| `.opencode/skills/hallmark` | Anti-slop design skill with a deterministic linter (`sloplint.mjs`) |
| `.opencode/skills/refactoring-ui` | 151-rule design rulebook distilled from *Refactoring UI* |
| `.opencode/skills/design-taste` | Ban catalogue, motion, interaction states, OKLCH colour |
| `.opencode/skills/i-have-adhd` | Answer-first output shaping |
| `.opencode/instructions/ALWAYS-ON.md` | Source for the global always-on file (`~/.config/opencode/AGENTS.md`) |
| `.opencode/plugins/graphify-auto-update.js` | Runs `graphify update .` after edits (debounced, flushed on idle) |
| `.opencode/mcp/` | Why these MCP servers, the config snippet, install steps |
| `.opencode/scripts/` | `bootstrap-windows`, `check-setup`, `check-template`, `copy-to-project`, `install-skills`, `lib-jsonc`, `setup-menu` |

---

## How it works

### The procedure

The agent follows `.opencode/sops/WEB_DEV.md`, phase by phase. Each phase has an
exit condition; the agent may not skip an unmet exit.

| Phase | Goal |
|---|---|
| 0a | Read the project documents in `docs/` and quote the requirement |
| 0b | Detect the stack, write `.opencode/STACK.md`, load one stack file |
| 1 | Understand the codebase (`graphify query`, read siblings and tests) |
| 2–3 | Spec and plan (only for >1 file or >1 concern) |
| 4 | Build — data/types → logic → UI shell → UI polish |
| 5 | Mechanical verify — build, typecheck, lint, tests |
| 6 | Visual verify — `sloplint --render`, screenshots, a11y, LCP/CLS |
| 7 | Independent review and handoff |

### Agents

| Agent | Mode | Job |
|---|---|---|
| `develop` | primary | Implementation; owns the phases and the evidence |
| `ui-designer` | subagent | Visual direction and the design system |
| `planner` | subagent | Spec and tracer-bullet tickets (read-only) |
| `reviewer` | subagent | Code and security review, high-confidence findings only (read-only) |

### Commands

Every command is a Markdown file in `.opencode/commands/`. Type `/` in opencode to
pick one. Routing is fixed per command:

| Command | Runs as |
|---|---|
| `/stack` | `develop` (primary) |
| `/new-feature` | `develop` (primary) |
| `/ship` | `develop` (primary) |
| `/build-ui` | `ui-designer` (subagent) |
| `/ui-audit` | `ui-designer` (subagent) |
| `/i-have-adhd` | output style (any agent) |

`develop` owns the main flow (`/stack`, `/new-feature`, `/ship`); the UI commands
(`/build-ui`, `/ui-audit`) route to the `ui-designer` subagent instead.

#### What each command does

- **`/stack`** — Detect the project stack, write `.opencode/STACK.md`, and report
  which MCP servers and skills apply. *Use it* at the start of a session, when the
  stack is unclear, or after switching projects.
- **`/new-feature`** — Run the structured feature workflow: explore the codebase,
  clarify with a short question list, design, implement, then review. *Use it*
  instead of diving straight into code when a feature touches multiple files.
- **`/ship`** — Take a feature all the way to done: detect stack, plan, build,
  verify mechanically, verify visually with screenshots, then review. Ends with the
  gate table (build, typecheck, lint, tests, sloplint, screenshots, a11y, LCP/CLS).
- **`/build-ui`** — Build or redesign a page with the Hallmark anti-slop skill: pick
  a direction, build the hero first, lint in a real browser, then expand. *Use it*
  for new pages, landing pages, and redesigns that must not look AI-generated.
- **`/ui-audit`** — Audit existing UI for slop, hierarchy, spacing, type, colour,
  a11y, and performance, with real screenshots at four viewports; reports findings
  ranked by severity. *Use it* when a UI looks off or before shipping a page.
- **`/i-have-adhd`** — Switch the session to answer-first, low-noise output
  (numbered steps, state restated, no preamble). Persists until "stop adhd mode".

> **Only `develop` is a primary agent**, so it is the only project agent the Tab
> switcher cycles to (alongside opencode's built-in `build`). `ui-designer`,
> `planner`, and `reviewer` are **subagents** — they run when a command routes to
> them or when `develop` delegates, not via Tab. opencode's default agent is
> `build`, not `develop`; start with `@develop` or press Tab to switch.

### Quality gates

`.opencode/sops/QUALITY_GATE.md` is the definition of done: requirement
traceability, correctness, build/typecheck/lint/tests, design floor, visual
evidence, a11y and performance, review, and handoff. Every gate passes or is
**explicitly waived with a user-accepted reason** — a waived gate is never reported
as passed.

---

## Verify

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\.opencode\scripts\check-template.ps1"
```

Expected: `failures: 0   warnings: 0` and `Template smoke test passed.`

```powershell
opencode plugin list
```

Expected: `graphify-auto-update` listed as `local` (a `-` in the ID column means the
plugin failed to load — check `opencode debug paths log`).

> The first `opencode` call after a copy may print `No plugins found` because the
> config watcher has not scanned the new folder yet. Run it a second time.

---

## Requirements

| Need | Notes |
|---|---|
| **opencode 2.x** | The plugin API target |
| **Windows PowerShell 5.1** | The install scripts are Windows-only |
| Node 18+, npm 9+, Git | Installed/checked by `bootstrap-windows.ps1` |
| Chrome | Used by `chrome-devtools` MCP and `sloplint --render` |
| `rtk`, `graphify`, `playwright-cli` | CLI tools installed by `bootstrap-windows.ps1` |

The **SOP text is OS-agnostic**; only the install scripts assume Windows.

---

## Good to know

- **Two `AGENTS.md` files.** opencode loads `~/.config/opencode/AGENTS.md` (every
  session, machine-wide) **and** `<project>/AGENTS.md` (this project). They are
  combined, not overridden. The global file is a copy of
  `.opencode/instructions/ALWAYS-ON.md`; the scripts write and verify it.
- **Two graphify plugins, not duplicates.** The global `graphify.js` reminds the
  agent to query the graph instead of grepping; the project
  `graphify-auto-update.js` runs `graphify update .` after edits. They load from
  different `.opencode/plugins/` directories, so there is no double-load.
- **Local plugin API.** `.opencode/plugins/graphify-auto-update.js` default-exports
  `{ id, setup(ctx) }` and imports **no** opencode package (a plain file in
  `.opencode/plugins/` cannot resolve `@opencode/plugin`). Do not add
  `import { Plugin } from "@opencode/plugin"` to a local plugin.
- **What to commit.** Commit the whole `.opencode/` if the team shares the SOP.
  Never commit the detected stack, dependencies, or build output:

  ```
  node_modules/
  .opencode/STACK.md
  .opencode/node_modules/
  graphify-out/
  ```

  `copy-to-project.ps1` copies `.gitignore` into each project and only appends
  missing entries — your rules are never removed or reordered.

---

## The rules that make it not-slop

1. **`docs/` first, detect second.** Read the documents, then detect the stack.
2. **One source of truth per fact.** No duplicated definitions across `docs/`,
   the SOP, and `AGENTS.md`.
3. **Verify in a real browser.** A screenshot and a passing test are evidence;
   "looks right" is not.
4. **No AI slop.** No gradients on flat surfaces, emoji as icons,
   rounded-everything, five shadows, or a hero on every page.

---

## Credits and licenses

This template vendors third-party skills and builds on several tools. Each keeps
its own license; see the `LICENSE`/`NOTICE` files inside the relevant
`.opencode/skills/<name>/` folder.

| Project | Author | License |
|---|---|---|
| Hallmark | Nutlope / Together AI | MIT |
| i-have-adhd | ayghri | MIT |
| context-mode | mksglu | MIT |
| graphify | Graphify-Labs | see package |
| Playwright CLI | Microsoft | Apache-2.0 |
| Chrome DevTools MCP | Google | Apache-2.0 |

For the full inventory, MCP rationale, and troubleshooting, see
**[`SETUP.md`](SETUP.md)**.
