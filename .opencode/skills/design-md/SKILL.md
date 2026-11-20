---
name: design-md
description: "Author and maintain a DESIGN.md design-system file for coding agents, in the Google DESIGN.md format (design tokens as YAML + prose rationale across 10 canonical sections: Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Motion & Micro-interaction, Voice & Content Strategy, Components, Do's and Don'ts). Use when the user wants to create, extract, document, or update a design system / design tokens / style guide for agents to build UI from; asks for a DESIGN.md or design.md; or says 'buat DESIGN.md', 'bikin design system', 'design tokens untuk agent', 'dokumentasikan desain', 'design system file'. Writes docs/DESIGN.md and verifies it with the @google/design.md linter. Not for writing app UI code itself (use hallmark / refactoring-ui / design-taste for building)."
metadata:
  version: "1.0.0"
  category: "design"
---

# design-md

Turn a project's visual identity into one portable `docs/DESIGN.md` that coding
agents read before building UI, so every screen shares one system instead of
guessing. This skill produces the DESIGN.md file only - it does not build app code.

The format is the **Google DESIGN.md specification**: design tokens embedded as YAML
(front matter or interleaved ```yaml blocks) plus human-readable prose. Tokens give
exact values; prose tells agents *why* those values exist and how to apply them.
**Prose is the most important part** - a clear intent description beats a dump of
values.

## Output location (always)

- Write `docs/DESIGN.md` in the project. One file, one source of truth for the design
  system.
- **Never** write or edit `.opencode/sops/DESIGN_LAW.md` - that file is the project's
  anti-slop SOP (rules), not the design system (values). Different file, different
  job. If they ever disagree, the SOP wins.
- **Never overwrite silently.** If `docs/DESIGN.md` (or a root `DESIGN.md` /
  `design.md`) already exists, read it and extend/refresh it; ask before replacing.
- The project SOP (`.opencode/sops/CONTEXT.md`, section 3b) names `docs/DESIGN.md`
  as the locked design system. Write it there; a root `design.md` is only
  Hallmark's legacy fallback, so never create a second one.
- **One system, one source of values.** `docs/DESIGN.md` is the single system document
  every builder reads (Hallmark's pre-flight checks it). Once the app exists,
  `tokens.css` is the single source of the *values*: reference it with `@tokens.css`
  and map Hallmark's role names onto the token roles (`primary` -> `--color-accent`,
  `neutral`/`surface` -> `--color-paper`, `on-surface` -> `--color-ink`, `outline` ->
  `--color-rule`) instead of restating hex values. Never keep a second root `design.md`.

## When to use / not use

Use when the user wants to create, extract, document, or update a design system /
tokens / style guide for agents; asks for a DESIGN.md; or a UI build needs a locked
system to share across pages.

Do not use to build the UI itself - that is `hallmark` (new pages), `refactoring-ui`
(existing UI / diagnostics), `design-taste` (taste + anti-slop). This skill only
writes the design-system document those builds then read.

## The format in one glance

Two layers in one file:

1. **Tokens** (machine-readable YAML): `colors`, `typography`, `rounded`, `spacing`,
   `motion`, `components`. Each component references tokens with `{group.name}`
   (e.g. `backgroundColor: "{colors.primary}"`).
2. **Prose** (markdown, the focus): one section per topic, in this canonical order:

```
Overview -> Colors -> Typography -> Layout -> Elevation & Depth -> Shapes
-> Motion & Micro-interaction -> Voice & Content Strategy -> Components -> Do's and Don'ts
```

Full token schema, per-section intent, the contrast rule, and the unknown-content /
`@`-reference behavior live in `references/design-md-spec.md`. Read it before writing.

## Workflow

1. **Ground first.** Read what exists: `docs/DESIGN_BRIEF.md` (direction),
   `docs/PRD.md` (scope), any `tokens.css` / Tailwind config / `:root` tokens, an app
   scaffold, and any existing `docs/DESIGN.md`. Extend, never clobber. If a root
   `design.md` (Hallmark's locked file) exists, note it and keep this file in `docs/`.
2. **Gather the source** (see `references/sources.md`). Decide where values come from:
   DESIGN_BRIEF, existing tokens.css, a Figma export, screenshots, or a short
   interview. Classify every unknown as **BLOCKING** or **OPTIONAL** (see below) and
   ask through the interactive question tool with a recommendation first.
3. **Draft the tokens.** Pick `colors`, `typography`, `rounded`, `spacing`, `motion`,
   `components`. Every text/background pair must meet WCAG 2.2 AA (>= 4.5:1) - compute
   the ratio, do not eyeball it. Keep one accent; reserve `error` for errors only.
4. **Write the prose**, one section per canonical heading, in order. Explain intent
   and rules, not just restate values. Ground every claim in a real source; mark
   unknowns `TBD` with the question (never invent a metric, logo, testimonial, or
   colour rationale).
5. **Set the token source of truth.** If the project has (or will have) `tokens.css`,
   reference it with `@tokens.css` in prose and do not restate those values in the
   front matter (avoid two sources). Before any scaffold exists, the front matter is
   the source of truth.
6. **Verify before done** (see Verification). Fix every failure or record an accepted
   WAIVED reason.
7. **Report.** Path written, the verification table, and the open questions still open
   (with a recommended answer each).

## Question tiers (BLOCKING vs OPTIONAL)

- **BLOCKING** - changes the structure of the system: brand accent hue, whether a
  custom webfont is allowed, light-only vs light+dark, the core type family, and the
  primary action colour. Ask before writing the affected tokens and **wait**; do not
  guess these.
- **OPTIONAL** - everything else (secondary accents, exact spacing steps, badge
  radius, copy tone). Take the Design Brief's direction as the default and record it;
  never block.
- **Always offer a recommendation.** For every question, lead with the option you
  recommend plus one line of why (grounded in the Brief / existing tokens), then 1-2
  alternatives, so the user can accept in one word.
- **Ask through the interactive question tool** when the harness provides one
  (recommended option first, marked `(Recommended)`; batch up to 5). Fall back to a
  numbered text list otherwise.

## Verification (gate)

Run these before reporting done; output `Check | PASS/FAIL/WAIVED | Evidence`.

- **Linter (preferred):** run `@google/design.md`. Fix every error; resolve or waive
  every warning (contrast-ratio, orphaned-tokens, missing-typography, section-order,
  unknown-key, token-like-ignored). Note: `motion:` is valid in the upstream spec but
  published linter 0.4.0 predates it and reports `token-like-ignored` - either keep the
  timing in the `## Motion & Micro-interaction` prose, or keep the `motion:` block and
  waive that one warning with this reason. If the linter cannot run, say so and do the
  manual checks below - do not claim a lint pass you did not run.
  - **Run it with npx, no manual install:**
    `npx -y --package=@google/design.md designmd lint docs/DESIGN.md`.
  - **Windows quirk:** the package's first bin is named `design.md`, so plain
    `npx @google/design.md` (or a `.bin/design.md` shim) can be opened by the OS markdown
    viewer and silently do nothing. Use the second bin alias `designmd` (no dot), as
    above. Fallback if npx misbehaves: `npm i @google/design.md` in a temp dir, then
    `node node_modules/@google/design.md/dist/index.js lint docs/DESIGN.md`.
- **ASCII only**, saved UTF-8 without BOM (no smart quotes, dashes, arrows).
- **Front matter parses** as YAML; top-level keys are only from the schema (plus
  deliberate, valid extensions).
- **Every `{token}` reference resolves** to a defined token (0 broken refs).
- **Section order** matches the 10 canonical headings exactly.
- **Contrast:** every text/background pair >= 4.5:1 (state the computed ratios).
- **Token-only:** no literal hex colour or `font-family` in the prose - all through
  tokens (matches the project design floor).
- **Single source of truth:** token values are not duplicated between front matter and
  a `@tokens.css` reference.

## Rules

- **Prose over values.** The document explains intent; tokens are context, not
  rendering instructions.
- **No invented content.** No fake colours rationale, metrics, logos, or testimonials.
  Unknowns are `TBD` with the question - except BLOCKING ones, which must be answered.
- **Token-only, AA contrast.** Never a literal value past the token block; never a
  text/background pair below 4.5:1.
- **Do not touch the SOP or Hallmark.** This skill writes `docs/DESIGN.md` only.
- **ASCII only, no mojibake.** Write `->`, `-`, `>=`, `<=`, `x`, `...` for symbols.
