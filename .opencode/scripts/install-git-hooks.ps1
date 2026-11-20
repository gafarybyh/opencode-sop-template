# install-git-hooks.ps1 — wire the qa-gate pre-commit hook into this repo.
#
# Idempotent: safe to run more than once. Only sets core.hooksPath and writes
# the hook if it is absent or differs. Run once after copying the template into
# a project (or from SETUP). To remove: `git config --unset core.hooksPath`.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .opencode\scripts\install-git-hooks.ps1

$ErrorActionPreference = 'Stop'
$scriptsDir = $PSScriptRoot
$root = Split-Path -Parent (Split-Path -Parent $scriptsDir)   # <root>/.opencode/scripts -> <root>

if (-not (Test-Path (Join-Path $root '.git'))) {
  Write-Host "No .git at $root - skipping (not a git repo, or run from the project root)." -ForegroundColor Yellow
  exit 0
}

$hookDir = Join-Path $root '.githooks'
New-Item -ItemType Directory -Path $hookDir -Force | Out-Null

$hookPath = Join-Path $hookDir 'pre-commit'

# Build the sh hook from an array (avoids here-string parsing quirks in PS 5.1)
# and write it with LF endings - a CRLF shebang breaks /bin/sh.
$hookLines = @(
  '#!/bin/sh',
  '# Installed by .opencode/scripts/install-git-hooks.ps1 - do not edit by hand.',
  '# Blocks a commit that touches UI without a fresh clean qa-gate run.',
  'node .opencode/scripts/precommit-gate.mjs || exit 1'
)
$hookBody = ($hookLines -join "`n") + "`n"

$write = $true
if (Test-Path $hookPath) {
  $existing = [System.IO.File]::ReadAllText($hookPath)
  if ($existing -eq $hookBody) { $write = $false }
}
if ($write) {
  [System.IO.File]::WriteAllText($hookPath, $hookBody, (New-Object System.Text.ASCIIEncoding))
  Write-Host "wrote $hookPath"
} else {
  Write-Host "hook already up to date: $hookPath"
}

git -C $root config core.hooksPath .githooks
Write-Host "set core.hooksPath = .githooks" -ForegroundColor Green
Write-Host "Done. The pre-commit hook now requires a clean qa-gate on UI changes."
Write-Host "Disable with: git config --unset core.hooksPath"
