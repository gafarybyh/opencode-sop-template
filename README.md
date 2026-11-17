# OpenCode Project Template

A portable `.opencode/` folder plus one `AGENTS.md`. Copy both into a project and
the agent knows how to build web apps without producing AI slop.

Built for **opencode 2.x**, works with any agent that reads `AGENTS.md` + `SKILL.md`.
The SOP text is portable; the install scripts are Windows PowerShell 5.1 only.

> **This file is the short version.** It covers what you need to get started and
> where things live. The full setup guide, every step, every MCP decision and
> the troubleshooting tables are in **`SETUP.md`**, next to this file. The two
> are deliberately different: this one answers "what is this and how do I run
> it", that one answers "how does every piece work and why".

---

## Quick start

Double-click `Setup.bat`. One menu does everything: install the machine
layer, copy the SOP into a project, check what is missing, or open the project
in opencode.

```powershell
Setup.bat                            # interactive menu
Setup.bat setup "C:\dev\my-app"    # full setup, no prompts
Setup.bat machine                   # machine layer only
Setup.bat copy "C:\dev\my-app"     # copy the SOP into a project
Setup.bat status                    # check what is present
```

The menu is a console UI, so it works over RDP and in terminals without a
desktop. When a desktop is available it opens a folder picker for the
destination.

The two halves can also run separately:

```powershell
# machine layer only (once per PC)
powershell -NoProfile -ExecutionPolicy Bypass -File ".\.opencode\scripts\bootstrap-windows.ps1"

# project copy only
powershell -NoProfile -ExecutionPolicy Bypass -File ".\.opencode\scripts\copy-to-project.ps1" -Destination "C:\path\to\new-project"
```

Replace `PROJECT_NAME` in `AGENTS.md` before the first real task.

---

## Layout after copying

```
my-app/
+-- docs/          your documents (PRD, STACK, features, ADR)
+-- src/ ...
+-- AGENTS.md      <- the only setup file at the root
+-- .gitignore     <- copied from the template, covers the generated files
+-- .opencode/     <- everything else
```

The template root itself:

```
opencode-template/
+-- Setup.bat          <- the one door; stays here, never copied
+-- AGENTS.md          <- the routing table that gets copied
+-- .gitignore         <- single source of truth, copied into projects
+-- README.md          <- this file
+-- .opencode/         <- the SOP: sops, agents, commands, skills, scripts
```

---

## What is in here

| Path | What it is |
|---|---|
| `Setup.bat` | One-door setup menu (lives in the template, not copied into projects) |
| `AGENTS.md` (project root) | Routing table and hard rules. opencode reads it automatically. |
| `.gitignore` | Single source of truth for what must never be committed. Copied into every project. |
| `.opencode/sops/` | Five procedures + `stacks/` (one file per stack) + `context/TROUBLESHOOTING.md` |
| `.opencode/agents/` | `develop`, `ui-designer`, `reviewer`, `planner` subagents |
| `.opencode/commands/` | `/stack`, `/new-feature`, `/ship`, `/build-ui`, `/ui-audit`, `/i-have-adhd` |
| `.opencode/skills/hallmark` | Anti-slop design skill with a deterministic linter (`sloplint.mjs`) |
| `.opencode/skills/refactoring-ui` | 151-rule design rulebook distilled from *Refactoring UI* |
| `.opencode/skills/design-taste` | Ban catalogue, motion, interaction states, OKLCH colour |
| `.opencode/skills/i-have-adhd` | Output shaping for a reader with ADHD |
| `.opencode/instructions/ALWAYS-ON.md` | Source for the global always-on file (`~/.config/opencode/AGENTS.md`) |
| `.opencode/plugins/graphify-auto-update.js` | Runs `graphify update .` after edits (debounced, flushed on idle) |
| `.opencode/mcp/` | Why these MCP servers, the config snippet, install steps |
| `.opencode/scripts/` | `bootstrap-windows.ps1`, `check-setup.ps1`, `check-template.ps1`, `copy-to-project.ps1`, `install-skills.ps1`, `lib-jsonc.ps1`, `setup-menu.ps1` |

---

## Two AGENTS.md files

opencode loads both, in this order:

| File | Scope | Content |
|---|---|---|
| `~/.config/opencode/AGENTS.md` | every session, every project | machine-wide always-on rules: ADHD output style, `graphify update .` after edits, context-mode, `rtk` prefix, PowerShell without `&&` |
| `<project>/AGENTS.md` | this project only | routing table, precedence, load order, hard rules, definition of done |

They are combined, not overridden. The global file is a copy of
`.opencode/instructions/ALWAYS-ON.md`; `bootstrap-windows.ps1` and
`copy-to-project.ps1` both write it, and `check-setup.ps1` verifies it.

---

## What runs where

Two layers, split so each piece of data lives in exactly one place - no
definition is kept twice, which keeps the context small.

- **Per project** - the SOP itself: `sops/`, `agents/`, `commands/`, `skills/`,
  `instructions/`, `plugins/graphify-auto-update.js`, `AGENTS.md`, and the
  `.gitignore`. Carried by `copy-to-project.ps1`.
- **Per machine (global, `~/.config/opencode`)** - the MCP servers, the package
  plugins, the global `AGENTS.md`, and the `SHELL` env var. Installed once by
  `bootstrap-windows.ps1`.

MCP servers and package plugins are deliberately **not** copied into the project:
one machine-wide definition serves every project. To add an MCP server, edit the
global config, not the template.

**Pick the agent, the SOP does not pick itself.** opencode's default agent is
`build`, not `develop`. In every new session either type `@develop` or press Tab
and select one of `develop` / `ui-designer` / `reviewer` / `planner`. Commands
`/stack`, `/new-feature`, `/ship` already route to `develop` or `ui-designer`;
an un-routed session is just `build` with the SOP in context, nothing more.

| Layer | Lives in | Carried by `copy-to-project.ps1`? | Installed by |
|---|---|---|---|
| SOPs, agents, commands, skills, instructions | `.opencode/` | yes | copy |
| `AGENTS.md` | project root | yes | copy |
| `.gitignore` | project root | yes | copy (missing rules are appended) |
| Local plugin `graphify-auto-update.js` | `.opencode/plugins/` | yes | copy |
| Node, Git, Chrome, uv | machine | no | `bootstrap-windows.ps1` |
| `opencode`, `rtk`, `graphify` | machine | no | `bootstrap-windows.ps1` |
| Plugins: `context-mode` | `~/.config/opencode/` | **no (global by design)** | `bootstrap-windows.ps1` |
| Plugin `graphify.js` (reminder hook) | `~/.config/opencode/plugins/` | **no (global by design)** | `graphify install` |
| MCP: `chrome-devtools`, optional `tavily` | `~/.config/opencode/` | **no (global by design)** | `bootstrap-windows.ps1` |
| CLI + skill: `playwright-cli` | machine + `~/.config/opencode/skills/` | **no (global by design)** | `bootstrap-windows.ps1` |
| `SHELL` env var (context-mode) | user environment | no | `bootstrap-windows.ps1` |
| Skills `design-taste`, `hallmark`, `i-have-adhd`, `refactoring-ui` | `<project>/.opencode/skills/` | yes | `copy-to-project.ps1` |
| Skills `graphify`, `playwright-cli` (tool owned) | `~/.config/opencode/skills/` | **no (global by design)** | the tools themselves |

The two graphify plugins are **not** duplicates and both must stay. The global
one (`graphify.js`) prepends a reminder to the first shell command - query the
graph instead of grepping. The project one (`graphify-auto-update.js`) runs
`graphify update .` after edits. opencode discovers each `.opencode/plugins/`
directory separately and the global plugin's id carries its own path, so there
is no double-load and no id clash. Full explanation in
`SETUP.md` -> **The two graphify plugins are not duplicates**.

---

## Plugin API note (opencode 2.x)

`.opencode/plugins/graphify-auto-update.js` targets the **opencode 2.x** plugin API:
it default-exports `{ id, setup(ctx) }` and registers hooks through
`ctx.tool.hook("execute.after", ...)` and `ctx.event.subscribe(...)`.

It imports **no** opencode package on purpose - a plain file in
`.opencode/plugins/` cannot resolve `@opencode/plugin`, so the definition is
exported as a plain object. Do not add `import { Plugin } from "@opencode/plugin"`
to a local plugin file; it will fail to load with
`Plugin must export a default definition with an id and an effect or setup function`.

The `.opencode/` folder has **no** `package.json` and **no** `node_modules`: the
plugin needs no dependencies, so nothing has to be installed per project.

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
plugin failed to load - check the log with `opencode debug paths log`).

Note: the first `opencode` call after a copy may print `No plugins found` because the
config watcher has not scanned the new folder yet. Run the command a second time.

---

## What to gitignore

The template ships one `.gitignore` in its root. `copy-to-project.ps1` copies it
into the target project, so a fresh project starts with the right rules and no
manual step. If the project already has a `.gitignore`, only the missing entries
are appended - your rules are never removed or reordered.

Commit the whole `.opencode/` if the team should share the SOP. Never commit the
detected stack, dependencies, or build output:

```
node_modules/
.opencode/STACK.md
.opencode/node_modules/
graphify-out/
```

---

## The rules that make it not-slop

1. **`docs/` first, detect second.** Read the project documents, then detect the
   stack. Never assume either.
2. **One source of truth per fact.** If it is in `docs/`, do not duplicate it in
   code comments. If it is in the SOP, do not repeat it in `AGENTS.md`.
3. **Verify in a real browser.** A screenshot is evidence. A passing test is
   evidence. "Looks right" is not.
4. **No AI slop.** Gradients on flat surfaces, emoji as icons, rounded-everything,
   five shadows, hero section on every page. The skills say what not to do.
