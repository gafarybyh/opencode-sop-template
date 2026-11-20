# Stack — Backend testing strategy (any server-side stack)

The UI gates (G4/G5/G6) cannot see a server. A backend needs its own evidence,
and "the API works" must be an exit code, not an assertion. This file is the
shared contract; the stack file (node-api / python / go / rust) supplies the
exact commands.

## The one-command gate

`node .opencode/scripts/qa-api.mjs --dir <backend-dir>` — the backend's G2+G3
equivalent of `qa-gate`. It:

1. runs the project's tests and requires **0 failures, > 0 tests**;
2. runs coverage and enforces a **line-coverage floor** (default 70%, TRD target);
3. boots the **real HTTP server** on an ephemeral port and hits a declared
   **smoke contract** (`qa-api.config.json`) over a real socket — status codes
   must match, including the 401/404 paths;
4. scans shipped source for **hardcoded secrets** (test fixtures are skipped).

Exit `0`/`1`/`3` like `qa-gate`. A missing test runner, a server that never
becomes ready, or a smoke check that cannot run is **INCOMPLETE (3)** — never a
silent PASS. It writes `.opencode/api-status.json` (with a `srcHash`), and the
pre-commit hook blocks a stale/missing backend gate when `qa-api.config.json`
exists — the same enforcement the UI gets from `gate-status.json`.

`qa-api.config.json` lives in the backend dir:

```json
{
  "start": ["node", "src/index.mjs"],
  "readyPath": "/api/products",
  "coverageMin": 70,
  "smoke": [
    { "method": "GET", "path": "/api/products", "expect": 200 },
    { "method": "GET", "path": "/api/admin/products", "expect": 401 }
  ]
}
```

## What a backend change must prove (G2 + G3)

- [ ] Build / typecheck / lint pass (stack file **Verify**).
- [ ] **Unit tests** for pure logic (validation, totals, state transitions).
- [ ] **Integration tests** that hit the real HTTP surface (not mocks of your own
      handler): happy path, invalid input (400), unknown resource (404), and
      auth-required (401) for every protected route.
- [ ] **Coverage** ≥ the TRD target on business logic (default 70% line).
- [ ] **Migration** applies cleanly to an empty DB and is reversible (see below).
- [ ] No hardcoded secret; config read from env/settings.

## Database & migrations

- One migration per change; never edit an applied migration. Forward-only is
  fine if the stack does not support down-migrations — say so.
- A schema change ships with: the migration, the seed update if needed, and a
  test that exercises the new column/constraint (CHECK, FK, unique).
- Prove it: apply migrations to a fresh DB in the test run, then run the suite
  against it. `qa-api` boots the server against a throwaway DB, so a broken
  migration fails the gate.
- The schema in `docs/BACKEND_SCHEMA.md` is authoritative. A code-vs-doc
  mismatch is a review question — report it, do not silently "fix" one side.

### Engine note (honest)

This template's reference slice (`_sop-test-toko/server/`) runs on **`node:sqlite`
(built-in, Node ≥ 22.5)** as a *runnable stand-in* for the documented
**PostgreSQL 16**. SQLite exercises the same HTTP + SQL + constraint logic without
requiring a Postgres server or Docker. It is not a Postgres substitute for
production: no real connection pooling, `ILIKE` vs `LIKE`, enum types, or
`timestamptz`. When the real stack is available, swap the driver and re-run
`qa-api` against Postgres; the gate contract is unchanged.

## Supply chain

Run before shipping when dependencies changed (Gate 2):

- `npm audit --audit-level=high` / `pnpm audit --audit-level high`
- `pip-audit` (Python), `govulncheck ./...` (Go), `cargo audit` (Rust)
- No new dependency for a few lines of code; if added, it is pinned and audited.
