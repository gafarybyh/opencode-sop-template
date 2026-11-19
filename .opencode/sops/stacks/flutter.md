# Stack — Flutter (Dart)

## Verify (phase 5)

| Lint | Typecheck | Test | Build |
|---|---|---|---|
| `rtk flutter analyze` | built in (`analyze`) | `rtk flutter test` | `rtk flutter build apk` |

`flutter analyze` covers typecheck. A build needs the platform toolchain (Android
SDK / Xcode); if it is absent, record `N/A build: <reason>` — a gap, not a pass.
Pure-Dart (non-Flutter) packages: `rtk dart analyze` / `rtk dart test`.

## Scaffold

`rtk flutter create <name>` -> `lib/` (`main.dart`), `test/`, `android/`, `ios/`.
Screens live in `lib/` by feature; do not add a second entry point.

## Visual gate (phase 6) — web-only checks do NOT apply

This is a native app: **`sloplint --render`, the four-viewport screenshot, and
LCP/CLS are `N/A`** (they assume a browser + DOM). Do not force them. Replace with a
mobile-appropriate check, or waive it with a stated reason:

- Screenshot the running app on a device/emulator at phone and tablet sizes; attach
  the files.
- Check touch targets (≥48dp), `SafeArea`, and both light/dark themes.

## Anti-slop

- Colors/typography from `ThemeData` (or the project's token layer), never hard-coded
  `Color(0x...)` in widgets.
- `const` constructors and `const` widgets wherever possible; avoid needless rebuilds.
- `SafeArea` around screen content; respect notches and system bars.
- Lists via `ListView.builder` / `SliverList`, not a `Column` of eagerly built children.
- `flutter_lints` on; do not suppress analyzer warnings to "make it pass".
