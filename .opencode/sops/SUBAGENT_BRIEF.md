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
CTX: <AVAILABLE | UNAVAILABLE — reason | N/A — file to Edit>
```

## ctx_* status (mitigasi spawn runtime)

- Subagents **must** emit the `CTX:` line. `UNAVAILABLE` beats silent fallback.
- `UNAVAILABLE` + second tool needed → degrade primary: heavy analysis moves
  to the primary via `ctx_execute(file: path)` (sandbox derive, print answer
  only). Subagent answers from the derived result with Read/Grep/Glob only.
- Proof of presence: `ctx_execute` exists-check `true` + `ctx_batch` PASS +
  `ctx_search` hit, recorded in `Evidence:` before any raw dump.
- If a subagent lacks `ctx_*`, the primary **never** counts `CTX: UNAVAILABLE`
  as PASS — it means fallback ran, verification of large output did not.
- Escalate when `ctx_*` is missing twice in a row: primary runs `ctx_batch`
  itself and passes the derived facts in the brief (≤5 lines, numbers only).

## Hard bans for every subagent

- Never invent a token, color, component, or file outside `scope` in the brief.
- Never change a file outside `scope`. Read-only when the brief says audit.
- **Context-mode is always on for the primary.** Use `ctx_execute` / `ctx_batch` /
  `ctx_search` for every read and analysis — even on short questions. Only two
  exemptions: a file you are about to `Edit` (exact bytes) and a file under
  ~100 lines you need in full. **Subagents are best-effort:** try `ctx_*` first,
  but if it is unavailable in the spawn runtime, say so once, use `Read` /
  `Grep` / `Glob`, and say so in the evidence line. Never dump raw file contents
  into the chat when a sandbox call could derive the answer. **Goodhart-first:**
  when a subagent returns `CTX: UNAVAILABLE` the primary re-derives the heavy
  answer itself via `ctx_execute(file: path)` and passes only the derived facts
  in the brief — never ask the subagent to dump or analyze large output.
  Emit the `CTX:` token in every return (see above); `UNAVAILABLE` is a
  machine-checkable token, not a vibe.
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
