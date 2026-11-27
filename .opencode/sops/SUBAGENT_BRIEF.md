# SOP — Subagent Brief (light output standard)

Subagents do NOT read the full SOP. They read this file (added to the brief as
one line) plus the 5-line brief from the primary. The brief answers "what to
do"; this file answers "how to return it".

## Return format (raw evidence only)

Always return in this shape. No verdict, no PASS/FAIL claim, no "looks good".

```
Direction / summary: <one sentence, if applicable>
Tokens: <added | none> — list names only
Files changed: <paths, or "none">
Evidence: <commands run with exit codes, screenshot paths, numbers>
Inconsistencies: <path:line — issue, or "none">
Waivers: <none, or reason>
```

## Hard bans for every subagent

- Never invent a token, color, component, or file outside `scope` in the brief.
- Never change a file outside `scope`. Read-only when the brief says audit.
- **Context-mode is always on for the primary.** Use `ctx_execute` / `ctx_batch` /
  `ctx_search` for every read and analysis — even on short questions. Only two
  exemptions: a file you are about to `Edit` (exact bytes) and a file under
  ~100 lines you need in full. **Subagents are best-effort:** try `ctx_*` first,
  but if it is unavailable in the spawn runtime, say so once, use `Read` /
  `Grep` / `Glob`, and say so in the evidence line. Never dump raw file contents
  into the chat when a sandbox call could derive the answer.
- Never start Phase 5/6 (build, test, screenshots, dev server) unless the
  brief says this is your job. The primary owns verification evidence.
- Never claim a gate passed. Report the command and its exit code; the
  primary decides `VERIFY:`.
- If the brief is missing a line (scope, tokens, or class), return
  `BRIEF-INCOMPLETE: <missing>` and stop. Do not guess.

## Why this exists

A fresh-context subagent without a standard invents structure and tokens,
which the primary then has to reject. This 1-file standard makes every spawn
return comparable evidence, so the primary can accept or send back fast.
