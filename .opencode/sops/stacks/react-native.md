# Stack — React Native / Expo

## Verify (phase 5)

| Lint | Typecheck | Test | Build |
|---|---|---|---|
| `rtk npx eslint .` | `rtk npx tsc --noEmit` | `rtk npx jest` | `rtk npx expo export` |

Expo uses `rtk npx jest-expo`. Bare RN (no Expo) builds via `eas build` or native
tooling — record `N/A build: <reason>` if the toolchain is absent. A missing tool
is a gap, not a pass: record `N/A <check>: <reason>`.

## Visual gate (phase 6) — web-only checks do NOT apply

This is a native app, not a web page: **`sloplint --render`, the four-viewport
screenshot, and LCP/CLS are `N/A`** here (they assume a browser + DOM). Do not force
them. Replace with a mobile-appropriate check, or waive it with a stated reason:

- Screenshot the running app on a device/emulator (or Expo web preview) at phone and
  tablet widths; attach the files.
- Check touch targets (≥44pt), safe-area insets, and both light/dark themes.

## Anti-slop

- Layout with `StyleSheet` / NativeWind — never web CSS assumptions (`px` floats,
  `position: fixed`, hover states).
- `SafeAreaView` / `useSafeAreaInsets` for notch and home-indicator areas.
- `Platform.OS` for platform branches; never reference `window`/`document`.
- Navigation through the router (React Navigation / Expo Router); never manual
  screen state.
- `FlatList` / `FlashList` for lists, not `map` inside `ScrollView` for long data.
- Respect the existing theme/token layer; no hard-coded colors in components.
