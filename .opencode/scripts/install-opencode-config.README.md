# OpenCode SOP — plug-and-play bootstrap (patch your opencode.json once)

> **Goal:** after running this once, the primary agent registers the
> context-mode plugin so `ctx_*` works in the main session. Subagents try
> `ctx_*` first, but inheritance is best-effort (verified 2026-11-27: primary
> proven, subagent fallback Read/Grep/Glob).
>
> **You do NOT patch this file.** You run the script. It patches your
> `opencode.json` (JSONC only when JSON is absent) in an **idempotent** way:
> re-running never duplicates keys or breaks existing config.
>
> Script: `.opencode/scripts/install-opencode-config.ps1`
>
> ```powershell
> powershell -NoProfile -ExecutionPolicy Bypass -File .opencode\scripts\install-opencode-config.ps1 -Project "C:\path\to\project"
> # or check what it would do, without writing:
> powershell -NoProfile -ExecutionPolicy Bypass -File .opencode\scripts\install-opencode-config.ps1 -Project "C:\path\to\project" -DryRun
> ```

## What the script does (exactly)

1. **Plugin entry (not MCP server)** — ensure `plugins: ["context-mode"]` exists
   in `opencode.json` (preferred) or `opencode.jsonc` when JSON is absent
   (`%USERPROFILE%\.config\opencode\`). If both already exist, it does nothing.
   Package install is done by `bootstrap-windows.ps1` (first-opencode-use npm
   cache), not by this script — this script only warns if the plugin is missing.

2. **ctx_* allowlist per subagent** — for these 4 agents:
   - `planner`
   - `explore`
   - `reviewer`
   - `ui-designer`

   If `agents.<name>.permissions` exists as an array, append:
   ```jsonc
   { "action": "ctx_*", "effect": "allow" }
   ```
   If `permissions` is missing, create it with that one rule.
   Old `permission.bash` object form (`{ "ctx_*": "allow" }`) is shell permission,
   NOT MCP tool permission - do not use it for ctx_*.

3. **Plugin entry (not MCP server)** - context-mode ships as a plugin:
   ```jsonc
   "plugins": ["context-mode"]
   ```
   It is NOT an entry under `mcp.servers`. This is the **actual fix** for
   "ctx_* unavailable in runtime" - SOP text alone cannot change runtime toolset.

4. **Backup** — before any write: `opencode.jsonc.bak.<yyyyMMddHHmmss>` in same dir.
   Never overwrite without backup.

5. **Changelog** - prints `[OK] patched agent planner: ctx_* allow` etc.
   or `[OK] already correct` per key.

## What it does NOT do

- Does NOT edit `.opencode/agents/*.md` permission blocks — those are the *mirror*
  source. The `opencode.json` is the runtime authority (JSONC only when JSON absent).
- Does NOT copy SOP files — that is `copy-to-project.ps1`.
- Does NOT change your model or auth.
- Does NOT install the context-mode package — that is `bootstrap-windows.ps1`.

## If context-mode plugin is not installed at all

Script detects absence and prints:
```
[FAIL] context-mode plugin not found on this machine.
       Run: bootstrap-windows.ps1  (installs rtk, rg, context-mode)
       Then re-run install-opencode-config.ps1
```
It never pretends tools exist.

## Manual equivalent (if you prefer not to run script)

Add to the file OpenCode reads at startup (`~/.config/opencode/opencode.jsonc`
or `<project>/opencode.jsonc`):

1. Plugin entry (context-mode ships as a plugin, not an MCP server):
   ```jsonc
   "plugins": ["context-mode"]
   ```
   (use whatever entry your machine already has; script normalizes only the flag)
2. Per agent (each of planner/explore/reviewer/ui-designer):
   ```jsonc
   "permissions": [
     { "action": "ctx_*", "effect": "allow" }
   ]
   ```

## Verify after patch

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .opencode\scripts\install-opencode-config.ps1 -Project "C:\path" -DryRun
# expect: [OK] plugins already includes context-mode, [OK] already allow ctx_* x4
```
Then restart OpenCode and test ctx_* in the PRIMARY session.
It should report `ctx_execute / ctx_batch` OK. Subagents fall back to
Read/Grep/Glob when ctx_* is unavailable — that is expected.
