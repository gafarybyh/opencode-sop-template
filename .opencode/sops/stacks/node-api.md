# Stack — Node API (Express / Fastify / NestJS / Hono)

## Verify (phase 5)

| Lint | Typecheck | Test | Build |
|---|---|---|---|
| `rtk npx eslint .` | `rtk npx tsc --noEmit` | `rtk npx vitest run` | `rtk npm run build` |

NestJS: `rtk npx nest build`. Biome instead of ESLint: `rtk npx biome check .`.
Run the `package.json` test script when it exists; use vitest/jest only when it is
in `devDependencies`. A missing tool is a gap, not a pass: record `N/A <check>: <reason>`.

**Coverage + integration + supply chain (when logic/DB changed):**

| Coverage | Integration | Dependency audit | Migration |
|---|---|---|---|
| `rtk npx vitest run --coverage` | boot the server, hit real routes | `rtk npm audit --audit-level=high` | apply to a fresh DB in the test run |

Zero-dependency projects (a small API with no framework) may use `node --test
--experimental-test-coverage` instead of vitest — see `stacks/_backend.md`.

## One-command backend gate

When the backend has a `qa-api.config.json` (it must, see `stacks/_backend.md`), run:

```bash
node .opencode/scripts/qa-api.mjs --dir <backend-dir>
```

It must print PASS (exit 0): tests pass, coverage ≥ floor, smoke endpoints match,
no hardcoded secrets. This is the backend's G2+G3 evidence; the pre-commit hook
blocks a stale backend gate. Details: `stacks/_backend.md`.

## Scaffold (greenfield only)

- **Never hand-roll a project skeleton.** Scaffold with the framework's official CLI: Express/Fastify — `npm create` the official generator; NestJS — `npx nest@latest new <name>`; Hono — `npm create hono@latest`. The CLI produces the canonical base layout.
- If no official generator fits, state so and stop — do not invent `src/features/`.
- Backend root carries `qa-api.config.json` from the first commit (starter: `stacks/_backend.md`).

## Anti-slop

- Validate every request at the boundary (schema or guard); never trust input.
- One central error handler; no `res.status(500)` scattered per route.
- `async` route handlers must catch rejections (Express 4 does not); never leave a
  dangling promise.
- No secrets in code, logs, or error responses; read them from the settings layer.
- No N+1: batch or join at the data layer, not in a loop over rows.
- Server recomputes money totals from stored prices; never trust a client price.
- Write multi-row mutations in a transaction (BEGIN/COMMIT/ROLLBACK).
- Match the existing router/module layout and error-shape; no new dependency for a
  small utility.
