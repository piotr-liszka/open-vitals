# DESIGN.md — OpenVitals

> Durable visual system, recorded from the built product (not intention). The single source of
> truth in code is `apps/web/src/lib/styles/tokens.css` + the `lib/ui` components; this file
> documents what those encode so agents stay on-brand. Mode: **Operate**.

## Atmosphere
A personal **race-telemetry instrument** for your own body data — athletic, energetic, precise.
Ink chassis, a single signal-magenta signature, and per-metric "lane" colors. Big tabular numerals
are the hero; hairline grids and crisp corners read as an instrument, not a generic admin panel.
Deliberately avoids the near-black + neon-glow fitness cliché: color is flat and confident, depth
comes from real offset+blur shadows, never glowing edges.

## Color
Semantic tokens are theme-aware; primitives are internal to `tokens.css`.

- **Signature accent** `--color-accent`: signal magenta (`#ff2f9e` dark / `#ec0d84` light) — hue ~328°, the one wide gap the metric lanes leave open, so the accent never reads as a data series. Controls
  are **ink-on-magenta** (`--color-on-accent` = near-black) — bold and AA-legible.
- **Chassis** — dark: `--color-bg` ink `#070a0f`, surfaces `#0c1119`/`#111825`. Light: cool
  `#e7ecf1` bg, white surfaces. Hairline `--color-grid` for instrument rules.
- **Metric lanes** (`--lane-*`, one per channel): orange=steps, red=resting HR, cyan=body battery,
  indigo=sleep, green=HRV, amber=stress, sky=SpO2, teal=respiration, violet=body comp, lime=calories.
- **State**: success green, warning amber, danger red/rose, info sky — each with a `*-soft` fill.
- Strategy: **Restrained + committed accent** (neutrals + one signature + coded data), right for Operate.

## Typography
- Workhorse system stack (`--font-sans`, Inter → system-ui); self-hosted-safe for an offline LAN app.
- **Numerals are the hero**: readouts use `--text-4xl`/`--font-black` + `--tracking-tight` +
  `font-feature-settings: var(--numeric)` (tabular) so digits align and don't jitter.
- **A readout is capped twice** (specs 029 + 031): by its own length (long strings start a step down) and
  by the width of the box it sits in — `StatTile` is an inline-size container, so a hero number in a 118px
  activity-hero column shrinks to fit instead of overlapping its unit. Tokens only ever set the ceiling.
- Labels: micro uppercase, `--tracking-widest`, muted — instrument caps. A long single word
  (`PRZEWYŻSZENIE`) shrinks with the tile down to 0.72 × `--text-xs` before it is allowed to wrap.
- Scale steps `--text-xs … --text-5xl`; weights 400–800.

## Space, shape, motion
- 4px spacing scale (`--space-*`). Crisp radii (`--radius-sm 5px … --radius-xl 20px`).
- Shadows carry offset+blur at three elevations; focus is a 3px accent ring.
- Motion: snappy `--ease-out` (expo-ish), `--transition-fast|base|slow`; buttons dip on press;
  sparklines draw. One purposeful moment per element, never scattered — respects reduced-motion.

## Components (`lib/ui`)
`StatTile` (tabular hero value + lane accent + delta with health-aware color + optional sparkline),
`Sparkline` + `TrendChart` (pure-SVG line/area, lane-colored, accessible, responsive — TrendChart scales to
life-time series), `Card`, `Button` (ink-on-magenta primary / secondary / ghost / danger), `Badge` (status
pill + dot), `SegmentedControl` (accessible radiogroup range picker — 7D/30D/90D/1Y), `Toggle` (the switch
every integration card is built from), `AppShell` (rail + hairline instrument chrome), `Banner`,
`Field`/`Input`, `Table`, `Skeleton`, `Spinner`, `Toast`, `ThemeToggle`.

## Landing signature (spec 014)
The Persuade surface leads with the instrument identity, not a generic SaaS hero: an eyebrow tag
("● TELEMETRIA TWOJEGO CIAŁA"), a headline whose payoff line ("podłączone do AI.") is set in signal-accent,
and a faint **telemetry-grid backdrop** (hairline `--color-grid` grid + a soft accent glow, radial-masked to
fade) behind a floating live-preview card of the real lane-colored tiles. Verified in light, dark, and mobile.

## Settings: one card per integration (spec 071)
There is no tier and no `TierBadge` — the instrument is always live, and the chrome carries the wordmark
alone. Settings is a single column of integration cards (Garmin, MCP, Strava, Withings). Each card reads
**status first, switches second**, separated by a hairline: what this integration is, whether it is
connected, then the `Toggle` rows that decide what it does. A switch never lives away from the thing it
switches, and a state that is off is shown dimmed and labelled rather than hidden.

## Themes
Light + dark via `:root[data-theme]`, toggled by `ThemeToggle`. Both are first-class and were
verified against the craft floor (contrast ≥4.5:1 body text, real depth, legible numerals).

## Direction contract
Recorded in `apps/web/src/routes/+layout.svelte` (survives the build as an HTML comment). World
pinned by the user (athletic/energetic); the concept-seed roll was skipped per that pin.
