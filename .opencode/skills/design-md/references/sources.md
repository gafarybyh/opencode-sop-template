# Where DESIGN.md values come from

Reference for the `design-md` skill. How to gather tokens and prose without inventing
them. Pick the highest available source; degrade honestly.

## Source order (use the first that exists)

1. **Existing `tokens.css` / `:root` / Tailwind theme** - the real source of truth once
   the app is scaffolded. Read the values, then reference them with `@tokens.css` in
   prose instead of restating them in the front matter. Do not duplicate.
2. **`docs/DESIGN_BRIEF.md`** - the project's design direction (mood, palette direction,
   typography intent, constraints). This is the primary source before any code exists.
   Translate its direction into concrete tokens and prose; keep its constraints
   (WCAG AA, touch targets, breakpoints).
3. **`docs/PRD.md` / `docs/TRD.md`** - scope, localization, performance and
   accessibility constraints that shape the system (e.g. Bahasa Indonesia copy,
   LCP target, responsive range).
4. **A Figma export** (only if the user supplies one): `design_tokens.json`, a Figma
   variables export, or a screenshot set. Map to the token groups; keep hex -> token.
   Do not require Figma API access - if there is no export, skip this source.
5. **A short interview** - ask only for the BLOCKING gaps (see SKILL.md question
   tiers), each with a recommendation and 1-2 alternatives.

Never invent a value when a lower source is missing - mark it `TBD` with the question.

## Mapping DESIGN_BRIEF -> DESIGN.md

- Brief "palette direction" (e.g. white/cream base, dark navy text, warm terracotta
  accent) -> `colors` roles: `neutral` (canvas), `on-surface` (ink), `primary`
  (accent), plus `on-*` pairs. Compute AA contrast for every text pair.
- Brief "typography" (e.g. clean geometric sans, system fonts OK) -> `typography`
  scale; if it says system fonts, use a system stack, do not add a webfont.
- Brief constraints (touch >= 44px, 320-1440px, WCAG AA) -> Layout + prose rules.
- Brief "mood / tone" and audience -> Overview and Voice & Content prose (write it as a
  specific world, not adjectives).
- Brief open questions (brand assets, logo, final palette) -> keep as `TBD` in prose
  and list them as OPTIONAL open questions; never invent a logo or brand colour.

## Extracting from existing tokens.css

- Map CSS custom properties to token groups: `--color-*` -> `colors`, `--font-*` ->
  `typography.fontFamily`, `--radius-*` -> `rounded`, `--space-*` -> `spacing`,
  `--duration-*` / `--ease-*` -> `motion`.
- If values are already authoritative in `tokens.css`, prefer `@tokens.css` over
  copying them into front matter (one source of truth).
- Note any token that exists in CSS but has no design rationale - ask, do not invent the
  "why".

## Writing the prose (the part that matters)

- Lead the Overview with one specific reference (a real object/scene), not a stack of
  adjectives ("modern, clean, premium" evokes nothing).
- Per colour role, state its job and its restriction ("accent appears only on the
  primary action, never on body copy").
- State contrast compliance with the computed ratios, not a claim.
- Keep Do's and Don'ts short and intentional; if it grows long, the Overview is too
  vague - tighten it instead.

## Quality bar before handing back

- Tokens are internally consistent (every component reference resolves; no orphaned
  tokens; typography present).
- All text/background pairs pass AA (ratios stated).
- Prose explains intent and rules, not a second copy of the numbers.
- No invented content; every `TBD` carries its question.
- Linter run (or manual equivalent) and reported.
