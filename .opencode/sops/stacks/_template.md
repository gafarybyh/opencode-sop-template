# `.opencode/STACK.md` template

Copy this into `.opencode/STACK.md` and fill it. One short file per project.

```markdown
# Stack

- Framework: <next|nuxt|sveltekit|astro|vite-react|vite-vue|remix|angular|react-native|expo|flutter|plain-html|fastapi|django|express|fastify|nestjs|hono|go|rust>
- Language: <ts|js|py|go|rs|dart>
- Package manager: <pnpm|npm|yarn|bun|pip|uv|poetry|go|cargo|pub>
- Styling: <tailwind-v4|tailwind-v3|css-modules|styled|vanilla|nativewind|stylesheet|flutter-theme|none>
- Component library: <shadcn|radix|mui|antd|chakra|react-native|flutter-material|none>
- Design tokens: <css-vars|tailwind-theme|tokens.json|theme-data|none>
- Dark mode: <class|media|none|planned>
- State/data: <react-query|zustand|pinia|redux|trpc|provider|none>
- Test: <vitest|jest|jest-expo|playwright|pytest|go test|cargo test|flutter test|none>
- Lint/format: <eslint|biome|ruff|go-vet|golangci-lint|clippy|ng-lint|flutter-analyze>
- Typecheck: <tsc|vue-tsc|svelte-check|mypy|null|flutter-analyze>
- Build: <command>
- Dev server: <command> on <port>
```

If `docs/STACK.md` exists it is authoritative; `.opencode/STACK.md` records what
the code actually contains. Report differences; never overwrite either silently.
