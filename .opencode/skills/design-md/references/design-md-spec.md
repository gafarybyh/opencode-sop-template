# DESIGN.md format - condensed spec

Reference for the `design-md` skill. Condensed from the Google DESIGN.md
specification (github.com/google-labs-code/design.md, `docs/spec.md`). If the two
differ, the upstream spec wins.

## File shape

A DESIGN.md is YAML tokens + markdown prose. Tokens may be embedded two ways, and both
may appear together:

1. **YAML front matter** - starts with a line `---`, ends with `---`, at the top.
   Put document metadata (`version`, `name`) and the main token groups here.
2. **Interleaved ```yaml blocks** - fenced YAML placed inside the relevant prose
   section (e.g. a `colors:` block inside `## Colors`).

Prose is the focus: it explains *why* the values exist and how to apply them. Tokens
are context and are not rendering instructions.

## Token groups (schema)

```yaml
version: alpha            # optional metadata
name: <project name>
colors:                   # any valid CSS colour: hex, named, rgb(), hsl(), oklch(), color-mix()
  primary: "#B24A2E"
  on-primary: "#FFFFFF"
  # role names recommended: primary, on-primary, secondary, on-secondary,
  # tertiary, neutral, surface, on-surface, on-surface-variant, outline,
  # error, on-error, and container variants
typography:               # each entry is a named style
  body-md:
    fontFamily: <string>
    fontSize: 16px        # Dimension: px | em | rem
    fontWeight: 400       # number (bare or quoted)
    lineHeight: 24px      # Dimension OR unitless number (multiplier)
    letterSpacing: 0px    # Dimension
    # also: fontFeature, fontVariation (strings)
rounded:                  # Dimension values
  sm: 4px
  md: 8px
  full: 9999px
spacing:                  # Dimension values
  base: 8px
  md: 16px
motion:                   # each entry: duration, delay, timingFunction
  state-change:
    duration: 150ms       # Duration: ms suffix
    timingFunction: ease-in-out   # linear | ease | ease-in | ease-out | ease-in-out | steps() | cubic-bezier()
components:               # each entry references tokens with {group.name}
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
    height: 44px          # also: size, width
```

Component sub-token names: `backgroundColor`, `textColor`, `typography`, `rounded`,
`padding`, `size`, `height`, `width`. Unknown component properties are accepted with a
warning.

## Section order (canonical - the linter checks this)

1. Overview (alias: "Brand & Style")
2. Colors
3. Typography
4. Layout (alias: "Layout & Spacing")
5. Elevation & Depth (alias: "Elevation")
6. Shapes
7. Motion & Micro-interaction (aliases: "Motion & Micro-interactions", "Motion")
8. Voice & Content Strategy
9. Components
10. Do's and Don'ts

Sections must be `##` headings with these names, in this order. A wrong or out-of-order
heading is a linter warning (`section-order`).

### What each section should say

- **Overview** - the design's world in prose: who it is for, the feel, one specific
  reference (a real object/scene beats a list of adjectives). This is the most
  load-bearing section.
- **Colors** - the palette logic and each role's job; name the single accent and its
  restriction; state that text/background pairs pass AA.
- **Typography** - families, the scale, and the reading feel; which style is for what.
- **Layout** - grid, breakpoints, spacing scale, whitespace philosophy, touch targets.
- **Elevation & Depth** - how layers are separated (tone vs shadow), shadow character,
  hover lift rules.
- **Shapes** - the radius language and how it scales with element size.
- **Motion & Micro-interaction** - what moves, why, duration/easing, reduced-motion
  fallback.
- **Voice & Content Strategy** - tone, example copy, what is never claimed (no invented
  proof).
- **Components** - how each tokenized component is used and its states; prose, not a
  second token dump.
- **Do's and Don'ts** - a short, intentional list. A long rambling list means the
  Overview was too vague.

## Contrast rule

Every text/background pair (each `textColor`/`backgroundColor`, and body text on each
surface) must meet **WCAG 2.2 AA: >= 4.5:1** for normal text (>= 3:1 for large text
only if justified). Compute the ratio; do not eyeball. The linter checks
`backgroundColor`/`textColor` pairs and warns `contrast-ratio` below 4.5:1.

Contrast helper (sRGB relative luminance):

```
L(c) = 0.2126*R + 0.7152*G + 0.0722*B, where each channel is linearised:
       c/255 <= 0.03928 ? (c/255)/12.92 : ((c/255+0.055)/1.055)^2.4
ratio = (max(L1,L2)+0.05) / (min(L1,L2)+0.05)
```

## External references (`@path`)

Prose may point at external files with an inline code span matching `@<path>[#fragment]`
(e.g. `@tokens.css`, `@components/button.html#primary`). Path resolves from the
directory containing DESIGN.md. Use `@tokens.css` when the app's `tokens.css` is the
source of truth, so values are not duplicated. A leading `/` or a path escaping the
DESIGN.md directory is an error; a missing target is a warning.

## Unknown content (why extensions are safe)

- Unknown section heading -> preserve, do not error (e.g. `## Iconography`).
- Unknown token name -> accept if the value is valid.
- Unknown component property -> accept with a warning.
- Duplicate section heading, or duplicate top-level YAML key -> error, reject the file.

This is why project-specific extension sections (e.g. `## Controls`, `## Exports`) do
not break the linter.

## Linter (verification)

```
npx -y --package=@google/design.md designmd lint docs/DESIGN.md   # errors + warnings + infos as JSON
npx -y --package=@google/design.md designmd diff OLD.md NEW.md    # compare two versions
npx -y --package=@google/design.md designmd spec                  # print the spec
```

Windows: the package's first bin is named `design.md`, so `npx @google/design.md` can be
opened by the OS markdown viewer and silently do nothing. Use the second bin alias
`designmd` (no dot), as above. Fallback: `npm i @google/design.md` in a temp dir, then
`node node_modules/@google/design.md/dist/index.js lint docs/DESIGN.md`.

Warning types to expect: `contrast-ratio`, `orphaned-tokens` (token defined but never
referenced), `missing-typography` (colors but no typography), `section-order`,
`unknown-key`, `token-like-ignored`. Fix errors; resolve or waive warnings.

> Version note: the upstream spec defines a `motion:` token group, but published linter
> `@google/design.md` 0.4.0 predates it and reports it as `token-like-ignored`. If you
> keep a `motion:` block, waive that single warning with this reason; otherwise keep the
> timing details in the `## Motion & Micro-interaction` prose and omit the token block.
