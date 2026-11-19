# Stack — Angular

## Verify (phase 5)

| Lint | Typecheck | Test | Build |
|---|---|---|---|
| `rtk npx ng lint` | built in (`ng build`) | `rtk npx ng test --watch=false` | `rtk npx ng build` |

A missing tool is a gap, not a pass: record `N/A <check>: <reason>`.

## Anti-slop

- Standalone components + signals by default; do not add new NgModules.
- `ChangeDetectionStrategy.OnPush` on every new component.
- Templates read observables with the `async` pipe; never a manual `.subscribe()`
  that leaks.
- No direct DOM manipulation: use bindings, `Renderer2`, or template refs.
- Respect the existing token/theme and component conventions; no silent migration
  to a new pattern.
