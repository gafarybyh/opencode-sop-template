# Stack — Remix / React Router v7

## Verify (phase 5)

| Lint | Typecheck | Test | Build |
|---|---|---|---|
| `rtk npx eslint .` | `rtk npx tsc --noEmit` | `rtk npx vitest run` | `rtk npx react-router build` |

Remix v2 uses `rtk npx remix build`. Biome instead of ESLint: `rtk npx biome check .`.
Run the `package.json` test script when it exists; use vitest/jest only when it is
in `devDependencies`.

## Scaffold

`rtk npx create-react-router@latest` -> `app/` (`app/routes/`, `app/root.tsx`).
Remix v2: `rtk npx create-remix@latest` -> `app/routes/`. Routes are files, not a
custom router config.

## Anti-slop

- Load data in `loader` and mutate in `action`; never `useEffect` + `fetch`.
- Use `useLoaderData` / `useActionData`; keep server-only code out of the client bundle.
- Progressive enhancement first: `<Form>` works without JS before you add `useFetcher`.
- Validate at the boundary and return a typed error shape; no secrets in responses.
- Match the existing route/module layout and token conventions.
