# Stack — Node API (Express / Fastify / NestJS / Hono)

## Verify (phase 5)

| Lint | Typecheck | Test | Build |
|---|---|---|---|
| `rtk npx eslint .` | `rtk npx tsc --noEmit` | `rtk npx vitest run` | `rtk npm run build` |

NestJS: `rtk npx nest build`. Biome instead of ESLint: `rtk npx biome check .`.
Run the `package.json` test script when it exists; use vitest/jest only when it is
in `devDependencies`. A missing tool is a gap, not a pass: record `N/A <check>: <reason>`.

## Anti-slop

- Validate every request at the boundary (schema or guard); never trust input.
- One central error handler; no `res.status(500)` scattered per route.
- `async` route handlers must catch rejections (Express 4 does not); never leave a
  dangling promise.
- No secrets in code, logs, or error responses; read them from the settings layer.
- No N+1: batch or join at the data layer, not in a loop over rows.
- Match the existing router/module layout and error-shape; no new dependency for a
  small utility.
