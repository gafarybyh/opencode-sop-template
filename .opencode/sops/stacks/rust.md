# Stack — Rust

## Verify (phase 5)

| Lint | Typecheck | Test | Build |
|---|---|---|---|
| `rtk cargo clippy` | built in | `rtk cargo test` | `rtk cargo build` |

A missing tool is a gap, not a pass: record `N/A <check>: <reason>`.

## Scaffold (greenfield only)

- **Never hand-roll a project skeleton.** Scaffold with the official CLI: `cargo new <name>` (binary) or `cargo new --lib <name>`. The CLI produces the canonical base layout.

## Anti-slop

- No `unwrap()` / `expect()` on request-path input; propagate errors.
- Validate at the boundary. No secrets in logs.
- Match the existing module layout and error type.
- No new crate for a small utility; write the few lines.
