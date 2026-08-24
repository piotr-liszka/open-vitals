# Spec 029 — StatTile readouts that never overflow the tile

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/ui/` (StatTile)
- **Owner agent:** ui-designer
- **Depends on:** 001 (design system)

## Context

`StatTile` renders its value at `--readout-xl` (up to 48 px) with `white-space: nowrap`. That is right for
`11 238` but breaks for long strings: on `/training/marsz` the **Czas** tile shows `6 h 52 min` in a
`minmax(160px, 1fr)` grid cell — roughly 260 px of text in ~145 px of usable width — so the number
spills past the tile border and over its neighbour. Every duration tile in the app (marsz, rower, bieg,
`Ostatnie N tygodni`, activity detail) has the same defect; only the value's length decides whether a
given tile happens to look broken.

The fix belongs in the shared component, not in each caller's formatter: the readout step should follow
the length of what is actually being displayed, with the tile boundary as a hard clip of last resort.

## Requirements (acceptance criteria)

- [x] A long readout (e.g. `6 h 52 min`, `1 234 567`) **stays inside the tile** at every breakpoint —
      no horizontal overflow, no overlap with the neighbouring tile.
- [x] Short readouts keep today's hero size (`--readout-xl`) — the visual language does not change for
      the common case.
- [x] The step-down is deterministic and unit-tested (pure function over the display string), not
      eyeballed per page.
- [x] The unit suffix (`km`, `bpm`, `/km`) follows the readout down, so pairing stays balanced.
- [x] The tile is a hard boundary: even an absurd value clips at the tile edge instead of escaping it.
- [x] Unit tests pass (no e2e)
- [x] Tokens only — no new raw px/hex in `StatTile`
- [x] No secrets logged or committed

## API contract

N/A (shared UI component). New pure helper:

```
lib/ui/readout-fit.ts
  readoutStep(value: string | number, unit?: string): 'xl' | 'lg' | 'md' | 'sm'
```

Thresholds by rendered length: ≤5 → `xl`, ≤7 → `lg`, ≤9 → `md`, else `sm`
(mapping onto the existing `--readout-xl|lg|md|sm` tokens). A unit counts at 0.45 of a character,
since it renders at roughly 40% of the readout size but still shares the line.

## UI

- `StatTile.svelte` sets `--tile-readout` / `--tile-unit` from `readoutStep(value)` and the readout uses
  those instead of hardcoding `--readout-xl` / `--readout-unit`.
- `.readout` gets `overflow: hidden` as the boundary guard; `min-width: 0` stays.
- No change to layout, spacing, colour or the delta/sparkline slots. Light + dark unaffected (tokens).
- Styleguide gains a long-value example so the behaviour is visible where the system is documented.

## Design / implementation notes

- Length is measured on the **rendered** string (`String(value)`), so `Intl`-formatted thin spaces and
  `h`/`min` suffixes all count — this is what determines the width in practice.
- Purely presentational: no caller changes, so every existing tile (walking, training, activity detail,
  dashboards, `/dane`) is fixed at once.
- Deliberately not container queries: the tile's width comes from grids that differ per page, and a
  length-based step is deterministic, SSR-stable and testable. The `overflow: hidden` guard covers the
  residual case of a very narrow column.

## Test plan

- **Unit:** `readoutStep` boundaries (`'42'` → xl, `'11 238'` → lg at 6 chars, `'6 h 52 min'` → sm,
  numeric input, empty string).
- **Component:** `StatTile` with a long value renders the `sm` step (asserted via the inline custom
  property / class) and a short value keeps `xl`; existing StatTile tests stay green.

## Closeout

- Commits: `e2fecf8` — feat: sync freshness in the sidebar, honest start-page trends, tile-safe readouts (specs 027-029)
- Notes / follow-ups: Thresholds are length-based (5/7/9 chars, unit weighted at 0.45) rather than measured — chosen
  against the narrowest tile column in the app. If a future layout goes narrower than
  `minmax(160px, 1fr)`, revisit the budget rather than the `overflow: hidden` guard.
