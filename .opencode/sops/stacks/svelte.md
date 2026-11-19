# Stack — Svelte / SvelteKit

## Verify (phase 5)

| Lint | Typecheck | Test | Build |
|---|---|---|---|
| `rtk npx eslint .` | `rtk npx svelte-check` | `rtk npx vitest run` | `rtk npm run build` |

Biome instead of ESLint: `rtk npx biome check .`. Run the `package.json` test
script when it exists; use vitest/jest only when it is in `devDependencies`.

## Scaffold

`rtk npx sv create` (SvelteKit) -> `src/routes/`, `src/lib/`, `static/`. Routes
are `+page.svelte` / `+page.server.ts`; do not add a second router.

## Anti-slop

- Svelte 5 runes (`$state`, `$derived`, `$effect`); never mix with legacy
  `export let` in the same component.
- Load in `+page.server.ts` / `+layout.server.ts`.
- Match the project's existing token and component conventions.
