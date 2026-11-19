# Setup Guide - OpenCode SOP Template

The full setup guide: every step, every MCP decision, every troubleshooting
table.

> **This is the long version.** If you only want the short version - what this
> is and how to run it - read **`README.md`** next to this file.

Built for **opencode**, works with any agent that reads `AGENTS.md` +
`SKILL.md`. The SOP text is portable; the install scripts are Windows
PowerShell 5.1 only.

This file lives in the template root and is **not** copied into a project. It
describes how to set up a machine, so it belongs next to `Setup.bat`, not in the
project that the setup produces.

Project root after copying:

```
my-app/
+-- docs/          your documents
+-- src/ ...
+-- AGENTS.md      <- the only setup file at the root
+-- .gitignore     <- copied from the template, covers the generated files
+-- .opencode/     <- everything else
```

---

## Quick start — the flow at a glance

Two layers: the **machine layer** (once per PC, in `~/.config/opencode`) and the
**project layer** (the SOP, in `<project>/.opencode`). The `project-blueprint`
skill lives in the machine layer and is **never** copied into a project.

```powershell
Setup.bat machine               # once per PC: tools, MCP, global AGENTS.md, project-blueprint skill
Setup.bat setup "C:\dev\app"    # per project: machine layer + copy the SOP
```

### New project (greenfield)
1. `Setup.bat setup "C:\dev\my-app"` — machine layer + copy the SOP into the folder.
2. Replace `PROJECT_NAME` in `AGENTS.md`.
3. (Recommended) In opencode: `/project-blueprint` — writes the six planning docs
   under `docs/`.
4. `@develop`, then `/new-feature` or `/build-ui`. New code is scaffolded with the
   stack's official CLI (see the stack file's **Scaffold** section).

### Existing project (already has code)
1. `Setup.bat copy "C:\dev\existing-app"` — copies the SOP only, does not touch
   `src/`. If `.opencode/` already exists, re-run with `-Force`.
2. **Before `-Force`:** back up or merge your own `AGENTS.md` (it is overwritten);
   `.gitignore` is appended, not replaced.
3. Replace `PROJECT_NAME` in `AGENTS.md`.
4. Detect the stack (Phase 0b writes `.opencode/STACK.md`); nothing is scaffolded
   into an unknown folder.
5. `/project-blueprint` **inherits** existing `docs/` and conventions — it reads and
   extends, it does not overwrite silently.
6. `@develop`, then `/new-feature`.

### Cheat-sheet
| Goal | Command |
|---|---|
| Machine layer, once per PC | `Setup.bat machine` |
| New project (machine + SOP) | `Setup.bat setup "C:\dev\app"` |
| Copy the SOP only | `Setup.bat copy "C:\dev\app"` |
| Check everything is present | `Setup.bat status` |
| Generate the six planning docs | `/project-blueprint` (in opencode) |
| Start work under the SOP | `@develop`, then `/new-feature` |

The full step-by-step (tools, MCP, plugins, verification) is in the numbered steps
below. The daily procedure (Phase 0a–7) is in `.opencode/sops/DEVELOPMENT.md`.

---

## What is in here

The file list lives in **`README.md`** -> *What is in here*. In short:
`sops/` (procedures), `agents/` (subagents), `commands/` (slash commands),
`skills/` (four vendored skills), `instructions/ALWAYS-ON.md` (source of the
global rules), `plugins/graphify-auto-update.js` (local plugin), `mcp/` (why
those servers), `scripts/` (the install and check scripts).

## Why these tools

Chosen by star count, licence, recency, and whether they produce *verifiable*
output rather than opinions.

| Tool | Choice | Reason |
|---|---|---|
| Anti-slop design | **Hallmark** (46k?, MIT) | Only one that ships a deterministic linter (`sloplint.mjs`, 16 floor gates + tiered reflex gates) and renders in a real browser at 8 widths. OpenCode-aware. |
| Design rulebook | **refactoring-ui** (358?) | 151 traceable rules, Step-0 stack detection, maps directly onto Tailwind scales. Diagnostic, not a generator. |
| Design craft | **design-taste** (90?) | Merges impeccable + emilkowalski + taste-skill. The sharpest concrete ban catalogue. |
| Output style | **i-have-adhd** | Answer-first output. |
| Browser verify | **Playwright CLI** (Microsoft) | Interaction and screenshots without a human, and far cheaper in context than a browser MCP. |
| Perf/a11y verify | **Chrome DevTools MCP** (Google) | LCP, CLS, console, a11y tree. |
| Library docs | **`ctx_index` + Tavily** | No docs MCP. Project `docs/` first, then official library docs fetched on demand. |

Rejected, with reasons: `oil-ui` (content in Mandarin), `superdesign` (needs an
account), `wghobson/agents` (heavy duplicate of the local agents), `mcp-chrome`
(overlaps the Playwright CLI). Full reasoning in `.opencode/mcp/README.md`.

---

## What runs where

Two layers, split so each piece of data lives in exactly one place — no
definition is kept twice, which keeps the context small.

- **Per project** — the SOP itself: `sops/`, `agents/`, `commands/`, `skills/`,
  `instructions/`, `plugins/graphify-auto-update.js`, and `AGENTS.md`. Carried by
  `copy-to-project.ps1`.
- **Per machine (global, `~/.config/opencode`)** — the MCP servers, the package
  plugins, the global `AGENTS.md`, and the `SHELL` env var. Installed once by
  `bootstrap-windows.ps1`.

MCP servers and package plugins are deliberately **not** copied into the project:
one machine-wide definition serves every project. To add an MCP server, edit the
global config, not the template.

### The two graphify plugins are not duplicates

Both belong to graphify, but they do different jobs and **both must stay**:

| Plugin | Where | Hook | Job |
|---|---|---|---|
| `graphify.js` | global `~/.config/opencode/plugins/` | `execute.before` | Prepends a reminder to the first shell command of a session: query the graph instead of grepping raw files. |
| `graphify-auto-update.js` | project `.opencode/plugins/` | `execute.after` + `session.idle` | Runs `graphify update .` after edits (debounced 1.5 s, flushed on session idle). |

They do not conflict and are not loaded twice: opencode discovers every
`.opencode/plugins/` directory separately, and the global plugin's id carries
its own path (`graphify-<hash>`) precisely so two copies never raise
"Duplicate plugin ID". The project plugin no-ops unless the project has
`graphify-out/graph.json`.

Removing the global one loses the reminder; removing the project one leaves the
graph stale after every edit — worse than having no graph at all.

The global plugin is installed by `graphify install` (the CLI's own doing), not
by this template. The template only ships the project-scoped one.

**Pick the agent, the SOP does not pick itself.** opencode's default agent is
`build`, not `develop`. Only `develop` is a **primary** agent, so it is the only
project agent Tab cycles to; type `@develop` or press Tab to switch to it. The
other three (`ui-designer`, `planner`, `reviewer`) are **subagents** — they run
when a command routes to them or when `develop` delegates, not via Tab. Commands
`/stack`, `/new-feature`, `/ship` route to `develop`; `/build-ui` and `/ui-audit`
route to the `ui-designer` subagent. An un-routed session is just `build` with the
SOP in context, nothing more.

| Layer | Lives in | Carried by `copy-to-project.ps1`? | Installed by |
|---|---|---|---|
| SOPs, agents, commands, skills, instructions | `.opencode/` | yes | copy |
| `AGENTS.md` | project root | yes | copy |
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
| Skill `project-blueprint` (template-owned, global) | `~/.config/opencode/skills/` | **no (global by design)** | `bootstrap-windows.ps1` (from `.opencode/global-skills/`) |

The vendored skills stay project-local on purpose. Every agent and command
references them by a project relative path, for example
`.opencode/skills/hallmark/scripts/sloplint.mjs`, and that file is executed
directly. A global copy cannot satisfy a relative path, so it would be a
duplicate that is never used. If an older setup left copies in
`~/.config/opencode/skills/`, `bootstrap-windows.ps1` and
`copy-to-project.ps1` remove them.

The `project-blueprint` skill (the six-document planning generator) is the one
template-owned skill that is **global**, not project-local. It carries no
project-relative paths, so a single global copy serves every project. Its source
lives in `.opencode/global-skills/project-blueprint/`; `bootstrap-windows.ps1`
installs it into `~/.config/opencode/skills/`, and `copy-to-project.ps1`
deliberately excludes `global-skills/` so it never lands in a project. You then call
it with `/project-blueprint` in any project; it writes its output under `docs/`.

The agents and commands referenced across the SOPs are provided locally rather
than by a plugin: `develop` (primary), `planner`, `reviewer`, `ui-designer`
(subagents), and `/new-feature`, `/build-ui`, `/ui-audit`, `/ship`, `/stack`
(commands).

If one of them is missing, `AGENTS.md` degraded-mode rules apply: substitute the
local agent or `/command`, say it once, keep working.

---

## The global AGENTS.md

opencode loads two `AGENTS.md` files, in this order:

| File | Scope | Content |
|---|---|---|
| `~/.config/opencode/AGENTS.md` | every session, every project | machine-wide always-on rules: ADHD output style, `graphify update .` after edits, context-mode, `rtk` prefix, PowerShell without `&&` |
| `<project>/AGENTS.md` | this project only | routing table, precedence, load order, hard rules, definition of done |

They are combined, not overridden: the global file comes first, the project file
second, and the agent applies the precedence listed in the project file.

The global file is a copy of `.opencode/instructions/ALWAYS-ON.md`.
`bootstrap-windows.ps1` and `copy-to-project.ps1` both write it, and
`check-setup.ps1` verifies it is present. Edit the project copy, then re-run
either script to refresh the machine layer.

A relative `"instructions"` entry in the global config does **not** work:
opencode resolves instruction paths against the workspace, not the config
directory, so the file is silently skipped. Use the global `AGENTS.md`.

---

## The full inventory

What this setup runs, in one place. Nothing here is a guess — every row is a
file or a config entry that exists.

### Plugins

| Plugin | Layer | What it does |
|---|---|---|
| `graphify.js` | global | Reminder hook: prefer `graphify query` over grep |
| `graphify-auto-update.js` | project | Runs `graphify update .` after edits |
| `context-mode` | global package | `ctx_*` tools, shell interception, output filtering |

### MCP servers

| Server | Layer | Tools | Purpose |
|---|---|---|---|
| `chrome-devtools` | global | 33 | console, network, a11y tree, perf trace, LCP/CLS, Lighthouse, screenshot |
| `tavily` | global, optional | — | find the official docs URL when it is unknown |

No Playwright MCP on purpose: it injects a large tool schema and accessibility
snapshot into every turn. Browser interaction runs through the CLI instead.

### CLI (not MCP)

| Tool | Purpose |
|---|---|
| `playwright-cli` | open, click, fill, snapshot, resize, screenshot, console, network, routes |
| `rtk` | token-filtering shell wrapper |
| `graphify` | build and query the codebase knowledge graph |

### Skills

| Skill | Layer | Purpose |
|---|---|---|
| `hallmark` | project | Anti-slop design + `sloplint.mjs` linter (16 floor gates) |
| `refactoring-ui` | project | 151-rule design rulebook |
| `design-taste` | project | Ban catalogue, motion, interaction states, OKLCH colour |
| `i-have-adhd` | project | Answer-first output shaping |
| `graphify` | global | Graph query conventions (from `graphify install`) |
| `playwright-cli` | global | Browser CLI usage guide (from `playwright-cli install --skills`) |

### Subagents and commands (project)

| Subagent | Job |
|---|---|
| `develop` | Primary implementation agent |
| `planner` | Spec and tracer-bullet tickets |
| `reviewer` | Code and security review, high-confidence findings only |
| `ui-designer` | Visual direction and design system |

| Command | Job |
|---|---|
| `/stack` | Detect and record the stack |
| `/new-feature` | Multi-file feature workflow |
| `/ship` | Take a feature to done, with the gate table |
| `/build-ui` | New page or redesign (Hallmark) |
| `/ui-audit` | Existing UI that looks off |
| `/i-have-adhd` | Output style switch |

---

# FRESH WINDOWS — install from scratch

Everything below is PowerShell 5.1, top to bottom. Expect 20-40 minutes on a
clean machine, mostly downloads.

## Fast path - one script

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .opencode\scripts\bootstrap-windows.ps1
```

Or double-click `Setup.bat` in the template root for the interactive menu.

It runs Steps 1-6: base tools, opencode, rtk, graphify (including its
global plugin), the global always-on `AGENTS.md`, plugin + MCP config merge,
the `SHELL` variable, Playwright chromium, then it removes any stale global
copies of the vendored skills, optionally copies the SOP into a project, and
finally runs `check-setup.ps1`. Safe to re-run; every config file gets a
timestamped backup first.

Useful flags: `-DryRun`, `-TavilyKey "tvly-..."`, `-SkipBrowsers`, `-SkipSkills`,
`-SkipProject`, `-Project "C:\dev\my-app"`, `-Force`.

### Setup.bat - the interactive menu

`Setup.bat` (template root) is a console menu over the same scripts. It never
installs anything itself; every action calls `bootstrap-windows.ps1`,
`copy-to-project.ps1` or `check-setup.ps1`.

| Menu | Does |
|---|---|
| 1. Setup lengkap | machine layer + copy the SOP into the chosen folder |
| 2. Machine layer saja | install the per-PC layer only |
| 3. Salin SOP ke project | copy the SOP only |
| 4. Cek status | what is present, what is missing |
| 5. Sinkronkan ulang | re-apply the global rules, skills and config |
| 6. Buka project di opencode | start opencode in the target folder |
| 7. Preview | dry-run of the full setup |

Same actions from a terminal, without the menu:

```powershell
Setup.bat setup "C:\dev\my-app"    # full setup
Setup.bat machine                   # machine layer only
Setup.bat copy "C:\dev\my-app"     # copy the SOP into a project
Setup.bat status                    # check only
```

The destination is chosen with a Windows folder picker when a desktop is
available, or typed by hand. The picker is skipped automatically when stdin is
redirected, so the menu never hangs in a pipe or a CI run.

### Zero to a working project in one command

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .opencode\scripts\bootstrap-windows.ps1 -Project "C:\dev\my-app"
```

That installs the machine layer and lays the SOP down in the target folder. Then:

```powershell
cd C:\dev\my-app
opencode
```

Inside the session: `/stack` writes `.opencode/STACK.md`, and you replace
`PROJECT_NAME` in `AGENTS.md`.

On a machine with nothing installed yet, verify the template without failing on
the missing global layer:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .opencode\scripts\check-setup.ps1 -FirstRun
```

The manual steps below stay the reference for what the script does.

## Step 1 — Base tools

```powershell
# Node LTS (includes npm)
winget install OpenJS.NodeJS.LTS

# Git
winget install Git.Git

# Chrome (needed by chrome-devtools MCP)
winget install Google.Chrome
```

Close and reopen PowerShell so PATH refreshes. Verify:

```powershell
node --version    # >= 18
npm --version     # >= 9
git --version
```

## Step 2 — opencode

```powershell
npm i -g opencode-ai
opencode --version
```

## Step 3 — rtk (token-saving shell filter)

Install the release binary, then confirm it is on PATH:

```powershell
rtk --version
```

If `rtk` is not found, place `rtk.exe` in a folder on PATH (for example
`$env:LOCALAPPDATA\Programs\rtk`) and reopen PowerShell.

rtk is optional: every SOP command works without it, you just lose 60-90% of the
context savings.

## Step 4 — graphify (codebase knowledge graph)

```powershell
# needs uv or pipx; uv is recommended
winget install astral-sh.uv
uv tool install graphifyy
uv tool update-shell
```

Reopen PowerShell, then:

```powershell
graphify --version
```

In a project, build a graph once:

```powershell
graphify .
```

## Step 5 — opencode plugins

Edit `C:\Users\<you>\.config\opencode\opencode.json` (create it if missing):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "context-mode"
  ]
}
```

Install the plugin package:

```powershell
cd $env:USERPROFILE\.config\opencode
npm init -y
npm i context-mode
```

`context-mode` needs the package in that folder. Restart opencode. Blocked
constructs (`curl`, `wget`, inline HTTP) and the context-mode tools should now
be active.

The two steps above are optional: opencode resolves a package plugin from its
own npm cache at `~/.cache/opencode/npm/<package>@latest` and downloads it on
first use. `bootstrap-windows.ps1` only declares the plugin and removes copies
that opencode never loads.
`opencode-power-pack` was retired on 2026-11-16: the local SOP, subagents, and
commands already cover its skills, so the plugin was redundant overhead.

### Step 5b — Point context-mode at a real shell (Windows, required)

On Windows, context-mode picks `pwsh` first. The `pwsh.exe` that ships as a
Microsoft Store alias is a 0-byte stub, so every `ctx_batch` call fails
with `Executable not found in $PATH: "pwsh"` even though PowerShell 7 is
installed. Pin it explicitly:

```powershell
[Environment]::SetEnvironmentVariable(
  'SHELL',
  "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe",
  'User')
```

context-mode honours `SHELL` when the basename is allowlisted
(`bash|sh|zsh|dash|pwsh|powershell|cmd`) and the file exists. Restart opencode
afterwards. `check-setup.ps1` verifies this.

Alternative: `winget install --id Microsoft.PowerShell` installs a real
`pwsh.exe` under `C:\Program Files\PowerShell\7` and the variable is not needed.

## Step 6 — MCP servers

Follow `.opencode/mcp/INSTALL.md`. Summary:

1. Back up `opencode.json`.
2. Merge the `"mcp"` block from `.opencode/mcp/opencode-snippet.jsonc`.
3. `npm install -g @playwright/cli@latest`, then `playwright-cli install-browser`
   and `playwright-cli install --skills agents --global`.
4. Warm the server once (`npx -y chrome-devtools-mcp@latest --help`).
5. Restart opencode, ask it to list MCP tools.

The block declares `chrome-devtools` only. Browser interaction runs through the
Playwright CLI, not a browser MCP: the CLI keeps large tool schemas and
accessibility snapshots out of the model context.

**Security note:** a Tavily remote MCP (used by some provider configs) stores its
API key in plaintext in `opencode.jsonc`. Move it to an environment variable
(`"Bearer {env:TAVILY_API_KEY}"`) — this repo leaves that decision to you.

## Step 7 — Install this SOP folder

Copy this whole `SETUP OPENCODE` folder somewhere permanent, for example
`C:\Users\Administrator\Desktop\SETUP OPENCODE`. Then verify:

```powershell
powershell -NoProfile -File "C:\Users\Administrator\Desktop\SETUP OPENCODE\.opencode\scripts\check-setup.ps1"
```

Every line should be `[OK]`. `[WARN]` items are optional (rtk, graphify,
browser cache). `[FAIL]` must be fixed before proceeding.

Then run the template smoke test: layout, JSONC merge, agent/command
frontmatter, and a real copy into a temp folder.

```powershell
powershell -NoProfile -File "C:\Users\Administrator\Desktop\SETUP OPENCODE\.opencode\scripts\check-template.ps1"
```

## Step 8 - the skills stay project-local (no action needed)

The vendored skills (`hallmark`, `refactoring-ui`, `design-taste`,
`i-have-adhd`) are **not** installed globally. They are copied into each
project's `.opencode/skills/` by `copy-to-project.ps1`.

That is deliberate. Every agent and command in this SOP references the skills
by a project relative path, for example
`.opencode/skills/hallmark/scripts/sloplint.mjs`, and that file is executed
directly. A global copy cannot satisfy a relative path, so it would be a
duplicate that is never used.

The only global skills are the ones owned by the tools themselves:
`graphify` (from `graphify install`) and `playwright-cli` (from
`playwright-cli install --skills agents --global`).

If an older setup left copies in `~/.config/opencode/skills/`, both
`bootstrap-windows.ps1` and `copy-to-project.ps1` remove them.

To list what is vendored in the template:

```powershell
powershell -NoProfile -File ".opencode\scripts\install-skills.ps1" -List
```

To install them into a project by hand:

```powershell
powershell -NoProfile -File ".opencode\scripts\install-skills.ps1" -Project "C:\path\to\app"
```

## Step 9 — Make ADHD, graphify, and context-mode always-on

Copy the always-on rules to the one global file opencode auto-loads, and the
auto-update plugin:

```powershell
New-Item -ItemType Directory "$env:USERPROFILE\.config\opencode\plugins" -Force
Copy-Item ".opencode\instructions\ALWAYS-ON.md" "$env:USERPROFILE\.config\opencode\AGENTS.md"
Copy-Item ".opencode\plugins\graphify-auto-update.js" "$env:USERPROFILE\.config\opencode\plugins\graphify-auto-update.js"
```

`bootstrap-windows.ps1` does this for you, and `check-setup.ps1` verifies it.

**Why `~/.config/opencode/AGENTS.md` and not an `instructions` entry.**
opencode auto-loads the global `AGENTS.md` in every session. A relative
`"instructions": ["instructions/ALWAYS-ON.md"]` entry in the global config
does **not** work: opencode resolves relative instruction paths against the
workspace, and the global config directory is not on that search path, so the
file is silently skipped. Put the rules in the global `AGENTS.md` instead.

Optional, in `~/.config/opencode/opencode.json`:

```json
"compaction": { "auto": true, "prune": true }
```

Restart opencode. The global file shapes every response, the plugin runs
`graphify update .` after each edit/write, and `compaction.prune` drops stale
tool output to save tokens. Say "stop adhd mode" in session to disable the
output style, as the file itself documents.

## Step 10 — First real project

```powershell
mkdir C:\dev\my-app
cd C:\dev\my-app
# scaffold your stack however you prefer (next/nuxt/vite/...)
powershell -NoProfile -File ".\.opencode\scripts\copy-to-project.ps1" -Destination "C:\dev\my-app"
```

Then in opencode, inside that project:

```
/stack        -> writes .opencode/STACK.md
```

Edit `AGENTS.md` in the project and replace `PROJECT_NAME`.

Verify the agent behaves:

```
/ship  build a settings page with a profile form, a toggle for dark mode, and an empty state
```

Expected: stack detected, plan, implementation, `sloplint` clean, screenshots at
320/768/1440, a11y and perf numbers, review, handoff block.

---

# Project documents: `docs/`

The agent reads `docs/` **before anything else** (Phase 0a). Contents vary per
project — never assume filenames. Put whatever you have in there; the agent
lists the folder and reads the files that map to the task.

A layout that works well:

```
my-app/
+-- docs/                    your documents (agent reads these first)
    +-- PRD.md               requirements, goals, non-goals
    +-- STACK.md             framework, versions, package manager
    +-- features/            one file per feature + acceptance criteria
    +-- adr/                 decisions and their rationale
+-- DESIGN.md                locked design system (optional; overrides Hallmark themes)
+-- AGENTS.md                routing table  <- must be at the root
+-- .opencode/               everything agent-related
    +-- sops/ (incl. stacks/, context/) agents/ commands/ skills/ instructions/ mcp/ scripts/
    +-- README.md            this guide
    +-- STACK.md             written by /stack
+-- src/
```

The project root stays clean: **only `AGENTS.md`** from this setup lives at the
root. Everything else is inside `.opencode/`. `docs/` is yours.

Precedence the agent applies:

| Source | Authority |
|---|---|
| `docs/` | Highest — intent and decisions. Beats upstream docs and assumptions. |
| Existing code | High — real conventions to match. |
| Official library docs | Medium — how the API works at that version. |
| Model memory | Lowest — must be verified before use. |

Rules that follow from this:

- The requirement is quoted from a document before code is written.
- If code and a document disagree, the conflict is reported, not silently
  resolved.
- Documents are never edited unless you ask.
- If `docs/` is absent, the agent says so once and continues.

Library documentation is **not** an MCP. When an API needs checking, the agent
fetches the official docs page into the knowledge base:

```
ctx_index(url: "<official docs URL>", source: "docs-<lib>")
ctx_search(queries: [...], source: "docs-<lib>")
```

If the URL is unknown it searches with `tavily` first. An unverified third-party
API call must not be written — if docs cannot be fetched, the agent says so and
stops. Full procedure: `.opencode/sops/CONTEXT.md` ? **External library documentation**.

---

# Daily use (per project)

| Situation | Command |
|---|---|
| New session, unsure of stack | `/stack` |
| Multi-file feature | `/new-feature` |
| Take a feature to done | `/ship` |
| New page / landing / redesign | `/build-ui` |
| Something looks off but you cannot name it | `/ui-audit` |
| Output is ADHD by default | `/i-have-adhd` reloads the full ruleset |
| One-file fix | Just ask; quality gate still applies |

## Install into a project

```powershell
powershell -NoProfile -File "C:\Users\Administrator\Desktop\SETUP OPENCODE\.opencode\scripts\copy-to-project.ps1" -Destination "<project>"
```

Produces in `<project>`:

```
AGENTS.md          <- root, opencode auto-reads it
.opencode/         <- sops, agents, commands, skills, instructions, mcp, scripts, README
```

The setup travels with the project, is commit-able, and needs no global state.
Skills are always copied: the SOP calls `.opencode/skills/hallmark/scripts/sloplint.mjs`
by path, so a copy without them would break every UI gate. `-Force` replaces the
template-owned folders and preserves `.opencode/STACK.md`, `plans/`, and custom files.

## What to gitignore

The template ships one `.gitignore` in its root. `copy-to-project.ps1` copies it
into the target project, so a fresh project starts with the right rules and no
manual step.

If the project already has a `.gitignore`, only the entries that are missing get
appended. Your own rules are never removed or reordered, and an entry you
already have is not duplicated.

Commit the whole `.opencode/` if the team should share the SOP. Never commit the
detected stack, dependencies, or build output:

```
node_modules/
.opencode/STACK.md
.opencode/node_modules/
graphify-out/
```

---

# The rules that make it not-slop

1. **`docs/` first, detect second.** Read the project documents, then detect the
   stack. Never assume either.
2. **Three design layers.** Hallmark floor (16 non-waivable items) ? refactoring-ui
   (151 rules) ? design-taste (concrete bans). Lower number wins on conflict.
3. **Evidence or it did not happen.** `sloplint` exit code, screenshot paths,
   LCP/CLS numbers, a11y count. "Looks good" is not accepted.
4. **Small diffs, one concern.** Polish is a gate, not a ticket.
5. **No invented content.** No fake metrics, testimonials, logos, or images.
6. **Answer first.** No preamble, no recap, concrete time estimates.

Full text: `.opencode/sops/DESIGN.md`, `.opencode/sops/QUALITY_GATE.md`.

---

# Troubleshooting

| Symptom | Fix |
|---|---|
| Fresh PC: `check-setup` red on MCP / SHELL / opencode.json | Expected before the global layer. Run `check-setup.ps1 -FirstRun`, then `bootstrap-windows.ps1` |
| Skill named in the SOP does not exist | It must sit in the project at `.opencode/skills/<name>/SKILL.md`. Run `install-skills.ps1 -List` to see what is vendored |
| `rtk` not found | Put `rtk.exe` on PATH, reopen terminal, or run `bootstrap-windows.ps1` |
| `ctx_batch` fails: `Executable not found in $PATH: "pwsh"` | Step 5b: set `SHELL` to `powershell.exe`, restart opencode |
| `rtk find` says `does not support compound predicates` | Drop `-not` / `-exec`; scope the path instead |
| `rtk find` prints `0 for '*'` | Wrong cwd or empty folder. Retry with an absolute path; `0` is not proof a file is missing |
| `rtk ls` fails: `Binary 'ls' not found` | `rtk ls` needs Git's `usr\bin` on PATH. Use `rtk find <path> -maxdepth 1` — always works |
| `rtk rg` fails: `Binary 'rg' not found on PATH` | Install ripgrep and add it to PATH: `winget install BurntSushi.ripgrep.MSVC` |
| `rtk grep <pattern> <dir>` says `Is a directory` | GNU grep is not recursive. Use `rtk rg <pattern> <dir>` |
| `rtk tree` says `Too many parameters` | `rtk tree` proxies the Windows `tree.exe`. Use `rtk find <path> -maxdepth 2` |
| `rtk find .` floods with `node_modules` | Scope the path: `rtk find src -name *.md`, or add `-maxdepth 2` |
| Agent does not follow the SOP | opencode's default agent is `build`, not `develop`. Type `@develop` (the only primary project agent; Tab switches to it) |
| `rtk find -name '*.md'` finds nothing | Remove the quotes: `-name *.md` |
| `rtk json pyproject.toml` says `is not a JSON file` | Use `rtk read pyproject.toml` |
| MCP tools missing in opencode | Run `npx -y chrome-devtools-mcp@latest --help`; check opencode log |
| `playwright-cli` not found | `npm install -g @playwright/cli@latest`, then reopen the terminal |
| `playwright-cli` skill not picked up | `playwright-cli install --skills agents --global`, then copy `~\.agents\skills\playwright-cli` to `~\.config\opencode\skills\` |
| `sloplint` exits 2 | No `.html` found. For a dev server use a URL, or export HTML first |
| `sloplint --render` cannot find Chrome | Install Chrome, or accept the static tier only and record the waiver |
| Skill not discovered | Skills must sit in the project at `.opencode/skills/<name>/SKILL.md`; run `install-skills.ps1 -List` |
| Agent assumes Next.js in a Vue repo | `/stack` first; check `.opencode/STACK.md` exists |
| `ctx_doctor` says `No plugin array found in opencode.json or opencode.jsonc` | Cosmetic. The doctor reads `opencode.jsonc` first and stops; opencode itself merges `.json` + `.jsonc`, so context-mode loads. Confirm with `opencode debug config` and look at `plugin` |

---

# Credits

| Project | Author | Licence |
|---|---|---|
| Hallmark | Nutlope / Together AI | MIT |
| refactoring-ui skill | edisonmbli | see `.opencode/skills/refactoring-ui/` |
| design-taste | h3nryprod01 | MIT AND Apache-2.0 |
| i-have-adhd | ayghri | MIT |
| context-mode | mksglu | MIT |
| graphify | Graphify-Labs | see package |
| Playwright CLI | Microsoft | Apache-2.0 |
| Chrome DevTools MCP | Google | Apache-2.0 |
