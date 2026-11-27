# install-opencode-config.ps1 - the plug-and-play bootstrap patch.
#
# Purpose: patch opencode.json idempotently: backup first,
# never duplicate a key, never overwrite a correct config.
# context-mode ships as a plugin (npm i -g context-mode), NOT an MCP server.
# Primary agent ctx_* load is proven; subagent ctx_* inheritance is best-effort.
# After running, restart OpenCode, then test ctx_* in the primary session.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File install-opencode-config.ps1 -Project "C:\path\to\project"
#   powershell -NoProfile -ExecutionPolicy Bypass -File install-opencode-config.ps1 -Project "C:\path\to\project" -DryRun
#   powershell -NoProfile -ExecutionPolicy Bypass -File install-opencode-config.ps1 -Project "C:\path\to\project" -Config "C:\custom\opencode.jsonc"
#
# Exit: 0 = patched or already correct. 1 = config parse error / missing tooling.
# ASCII only.
param(
  [string]$Project = '',
  [string]$Config = '',
  [switch]$DryRun
)

$ErrorActionPreference = 'Continue'

function Ok($m)   { Write-Host "[OK]   $m" -ForegroundColor Green }
function Info($m) { Write-Host "       $m" -ForegroundColor DarkGray }
function Warn($m) { Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Die($m)  { Write-Host "[FAIL] $m" -ForegroundColor Red }

function Get-ProjectRoot {
  param([string]$Path)
  if ($Path -and (Test-Path $Path)) { return (Resolve-Path $Path).Path }
  return (Get-Location).Path
}

function Get-ConfigPath {
  param([string]$Override, [string]$Proj)
  if ($Override) { return $Override }
  $userHome = $env:USERPROFILE
  if (-not $userHome) { $userHome = $HOME }
  if (-not $userHome) { $userHome = [Environment]::GetFolderPath('UserProfile') }
  # IMPORTANT: OpenCode loads "plugins" from opencode.json, not opencode.jsonc.
  # If both exist in a folder, the JSON file wins for the plugin array.
  # So the preferred target is opencode.json (the file plugins actually live in).
  # JSONC is only used when JSON does not exist.
  $candidates = @(
    (Join-Path $userHome '.config\opencode\opencode.json'),
    (Join-Path $userHome '.config\opencode\opencode.jsonc'),
    (Join-Path $Proj 'opencode.json'),
    (Join-Path $Proj 'opencode.jsonc')
  )
  foreach ($p in $candidates) { if ($p -and (Test-Path $p)) { return $p } }
  return (Join-Path $userHome '.config\opencode\opencode.json')
}

function Read-JsonSafe {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return $null }
  $raw = Get-Content $Path -Raw
  # Strip comments and trailing commas for compat with JSONC (very small parser).
  $stripped = $raw -replace '(?m)^\s*//.*$','' -replace '(?m)^\s*/\*.*?\*/','' `
                     -replace ',\s*([}\]])', '$1'
  try { return ($stripped | ConvertFrom-Json) } catch {
    Write-Host "[FAIL] $Path is not parseable JSON/JSONC: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
  }
}

function Test-ApiOk {
  param([string]$Cmd)
  if (-not (Get-Command $Cmd -ErrorAction SilentlyContinue)) { return $false }
  return $true
}

$proj = Get-ProjectRoot -Path $Project
$cfgPath = Get-ConfigPath -Override $Config -Proj $proj

Write-Host "  install-opencode-config" -ForegroundColor Cyan
Write-Host "  project : $proj"
Write-Host "  config  : $cfgPath"
if ($DryRun) { Info 'dry-run: no files written' }

# ---- prerequisite: context-mode plugin present on this machine ----------------
$ctxDir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs\context-mode'
$pluginPresent = $false
foreach ($p in @(
  "$env:USERPROFILE\.config\opencode\opencode.jsonc",
  "$env:USERPROFILE\.config\opencode\opencode.json",
  (Join-Path $proj 'opencode.jsonc'),
  (Join-Path $proj 'opencode.json')
)) {
  if (Test-Path $p) {
    $r = Get-Content $p -Raw
    if ($r -match 'context-mode') { $pluginPresent = $true }
  }
}
# Always attempt the patch: the script needs to exist to help a machine that
# does not have the plugin yet - we warn but do not abort, so the allowlist and
# mcp.allowSubagents are still written and the next bootstrap will install the
# plugin. Aborting here would make the plug-and-play flow a dead end for the
# exact user it is designed for.
if ($pluginPresent -or (Test-ApiOk 'ctx') -or (Test-ApiOk 'ctx_execute')) {
  Ok 'context-mode plugin reference found in config (tool inheritance check below)'
} else {
  Warn 'context-mode plugin not found yet.'
  Info '  Run bootstrap-windows.ps1 first (installs rtk, rg, context-mode),'
  Info '  then re-run install-opencode-config.ps1. Patching allowlist anyway.'
}

# ---- phase 1: load or create config -----------------------------------------
$cfg = Read-JsonSafe -Path $cfgPath
$created = $false
if (-not $cfg) {
  $cfg = [pscustomobject]@{}
  $created = $true
  Info "no config at $cfgPath - creating starter"
}

# backup
if (-not $created -and -not $DryRun) {
  $bak = $cfgPath + '.bak.' + (Get-Date -Format 'yyyyMMddHHmmss')
  Copy-Item $cfgPath $bak -Force
  Ok "backup -> $bak"
}

# ---- phase 2: plugins array + mcp cleanup ---------------------------------
# context-mode ships as a plugin, not an MCP server. It must be listed in
# "plugins" so the plugin loader registers ctx_* tools in the primary session.
# Subagent inheritance is best-effort. It is NOT an entry under mcp.servers.
if (-not $cfg.plugins) { $cfg | Add-Member -NotePropertyName 'plugins' -NotePropertyValue @() -Force }
if ($cfg.plugins -is [string]) { $cfg.plugins = @($cfg.plugins) }
$hasPlugin = $false
foreach ($p in $cfg.plugins) { if ($p -eq 'context-mode') { $hasPlugin = $true } }
if ($hasPlugin) {
  Ok 'plugins already includes context-mode'
} else {
  if (-not $DryRun) { $cfg.plugins += 'context-mode' }
  Ok 'plugins + context-mode'
}
# cleanup: remove a wrong mcp.servers.context-mode entry and the invented allowSubagents.
if ($cfg.mcp -and $cfg.mcp.servers -and $cfg.mcp.servers.'context-mode') {
  if (-not $DryRun) { $cfg.mcp.servers.PSObject.Properties.Remove('context-mode') }
  Ok 'removed wrong mcp.servers.context-mode (context-mode is a plugin, not an MCP server)'
}
if ($cfg.mcp -and $cfg.mcp.allowSubagents) {
  if (-not $DryRun) { $cfg.mcp.PSObject.Properties.Remove('allowSubagents') }
  Ok 'removed invented mcp.allowSubagents (not an OpenCode field)'
}
# cleanup: an empty mcp.servers object is legal but noisy; drop it so the file
# does not read like an MCP-server config for context-mode.
if ($cfg.mcp -and $cfg.mcp.servers -and ($cfg.mcp.servers.PSObject.Properties.Count -eq 0)) {
  if (-not $DryRun) { $cfg.mcp.PSObject.Properties.Remove('servers') }
  Ok 'removed empty mcp.servers (keeps config honest: context-mode is a plugin)'
}

# dedup guard: if a sibling opencode.json and opencode.jsonc both exist,
# opencode.json wins for the plugins array, so the JSON must hold the entry.
# (This script patches $cfgPath only. After running, wipe a stray
# `plugins: []` from the other file if it exists.)
$otherCfg = $cfgPath -replace '\.jsonc$','.json'
if ($otherCfg -ne $cfgPath -and (Test-Path $otherCfg)) {
  $otherRaw = Get-Content $otherCfg -Raw
  $otherJson = $otherRaw | ConvertFrom-Json
  if ($otherJson.plugins -is [System.Array] -and $otherJson.plugins.Count -eq 0) {
    if (-not $DryRun) {
      $otherJson.plugins = @('context-mode')
      [System.IO.File]::WriteAllText($otherCfg, ($otherJson | ConvertTo-Json -Depth 12), [System.Text.UTF8Encoding]::new($false))
    }
    Ok "sibling $otherCfg had empty plugins -> set to ['context-mode']"
  } elseif ($otherJson.plugins -match 'context-mode') {
    Ok "sibling $otherCfg already lists context-mode"
  }
}

# ---- phase 3: per-agent shell ctx_* allow ----------------------------------
# For plugin-registered tools, the action is the tool name itself
# (ctx_execute / ctx_batch / ctx_search), not a shell command. OpenCode
# matches MCP/plugin tool names as "<server>_<tool>"; plugin tools register
# under their own name. The correct permission entry is:
#   { action: "ctx_*", effect: "allow" }  (wildcard covers all ctx tools)
$subagents = @('planner','explore','reviewer','ui-designer')
if (-not $cfg.agents) { $cfg | Add-Member -NotePropertyName 'agents' -NotePropertyValue ([pscustomobject]@{}) -Force }

function Test-PermsAllowCtx {
  param($Agent)
  if (-not $Agent.permissions) { return $false }
  foreach ($p in $Agent.permissions) {
    if ($p.action -eq 'ctx_*' -and $p.effect -eq 'allow') { return $true }
  }
  return $false
}

foreach ($name in $subagents) {
  $agent = $cfg.agents.$name
  if (-not $agent) {
    if (-not $DryRun) {
      $cfg.agents | Add-Member -NotePropertyName $name -NotePropertyValue ([pscustomobject]@{
        permissions = @([pscustomobject]@{ action = 'ctx_*'; effect = 'allow' })
      }) -Force
    }
    Ok "agents.$name created with ctx_* allow"
    continue
  }
  # cleanup: remove a stale permission.bash.ctx_* entry from an earlier draft.
  if ($agent.permission -and $agent.permission.bash -and $agent.permission.bash.PSObject.Properties['ctx_*']) {
    if (-not $DryRun) { $agent.permission.bash.PSObject.Properties.Remove('ctx_*') }
    Ok "agents.$name removed stale permission.bash.ctx_* (shell permission, not MCP)"
  }
  # cleanup: remove a stale context-mode_* action (wrong server name).
  if ($agent.permissions) {
    $newPerms = @()
    $changed = $false
    foreach ($p in $agent.permissions) {
      if ($p.action -eq 'context-mode_*') { $changed = $true }
      else { $newPerms += $p }
    }
    if ($changed) {
      if (-not $DryRun) { $agent.permissions = $newPerms }
      Ok "agents.$name removed stale context-mode_* action"
    }
  }
  if (Test-PermsAllowCtx -Agent $agent) {
    Ok "agents.$name permissions already allow ctx_*"
    continue
  }
  if (-not $agent.permissions) {
    if (-not $DryRun) {
      $agent | Add-Member -NotePropertyName 'permissions' -NotePropertyValue @([pscustomobject]@{ action = 'ctx_*'; effect = 'allow' }) -Force
    }
    Ok "agents.$name permissions created (ctx_* allow)"
    continue
  }
  if (-not $DryRun) {
    $newPerm = [pscustomobject]@{ action = 'ctx_*'; effect = 'allow' }
    $agent.permissions += $newPerm
  }
  Ok "agents.$name permissions append ctx_* allow"
}

# ---- phase 4: write ----------------------------------------------------------
if (-not $DryRun) {
  $json = $cfg | ConvertTo-Json -Depth 12
  [System.IO.File]::WriteAllText($cfgPath, $json, [System.Text.UTF8Encoding]::new($false))
  Ok "written: $cfgPath"
} else {
  Info 'dry-run: would write config above'
  Ok 'dry-run complete'
}

Write-Host ''
Write-Host '  Next: restart OpenCode, spawn one subagent.' -ForegroundColor Cyan
Write-Host '  It should use ctx_execute/ctx_batch, not "ctx_* unavailable".' -ForegroundColor Cyan
exit 0
