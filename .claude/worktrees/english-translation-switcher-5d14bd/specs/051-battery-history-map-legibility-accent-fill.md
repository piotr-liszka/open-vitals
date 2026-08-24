# Spec 051 — Body Battery history on the condition card, a legible map, a brighter accent fill

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/insights/` (+ `lib/ui/LeafletMap.svelte`, `lib/styles/tokens.css`)
- **Owner agent:** ui-designer
- **Depends on:** 013, 015, 022, 047, 049

## Context

A second round of visual feedback on the running app, all of it about legibility:

1. **The "Regeneracja" card states Body Battery as one number** ("↓14 vs baza") with no way to see
   where it came from. The panel already computes a 30-day window for every recovery channel and
   throws the shape away — `ConditionMetric.series` (14 bare values, no dates) was never rendered by
   anything but a test.
2. **Every embedded map is barely readable.** `LeafletMap` loads CARTO's `dark_all` raster basemap
   unconditionally, while the app has both themes and opens in light for anyone whose system is light
   — so a near-black map sits inside a white card, and route thumbnails, the activity route and the
   GPS heatmap all read as dark smudges. The route colour is also `--lane-orange`, which is the
   *steps* data lane, not the product's accent; a route is not a metric series and should not borrow
   a lane hue.
3. **The primary button still reads as low contrast.** Spec 049 separated `--color-accent-fill` from
   accent *text* and settled on ink-on-magenta-500 (5.81:1) — passing, but visibly muddy. White on
   that same magenta is *worse* (3.41:1, fails AA), so the fix is to brighten the fill under the ink
   label rather than to invert it.

## Requirements (acceptance criteria)

- [x] The condition card shows Body Battery's recent history as a chart beside the readiness gauge
      and summary, on the same card — no second card, no new page
- [x] The chart carries dated points, so a gap in the data is a gap in the line rather than a
      silently shortened series
- [x] The card renders unchanged when Body Battery is absent from the snapshot (no empty frame)
- [x] `ConditionMetric` exposes one history field (`history: DayPoint[]`), replacing the undated,
      unused `series: number[]`
- [x] Maps use a basemap matching the active theme — light basemap on the light theme, dark on dark —
      falling back to light when no theme is set
- [x] Toggling the theme with a map on screen swaps that map's basemap and route colour in place,
      with no reload, and the watcher is torn down with the map
- [x] Routes, tracks and markers default to the product accent, not to a metric lane; no caller
      passes an explicit colour today, so this is a one-line default change
- [x] The map frame's own background follows the surface tokens rather than a hardcoded near-black
- [x] Filled accent controls carry their ink label at ≥ 7:1 in both themes (ink on magenta-400 =
      7.78:1, on the magenta-300 hover = 10.9:1); accent *text* keeps its per-theme grade
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No endpoint or MCP tool changes. One shape change inside the existing `GET /` loader payload
(`InsightsData.condition`):

```diff
 interface ConditionMetric {
   …
-  /** Recent non-null values, oldest→newest (sparkline material). */
-  series: number[];
+  /** Recent in-window points, oldest→newest, gaps kept as null (chart material). */
+  history: DayPoint[];
 }
```

`HISTORY_POINTS = 30` caps the tail so the payload cannot grow with the window.

## UI

`ConditionCard`, `LeafletMap`, tokens.

- **Battery chart.** A third hero column at ≥ 1040px (`gauge | summary | chart`); below that the
  chart drops to its own full-width row, and below 720px the hero stacks as before. It is a standard
  `TrendChart` in the Body Battery lane (cyan), 128px tall, axis labels on, y scale off — the card
  already prints the number, so the chart's job is the shape.
- **Map.** Tile URL picked from `document.documentElement.dataset.theme`: `light_all` on light,
  `dark_all` on dark. The polyline/marker default becomes `--color-accent`; `readAccent()` resolves
  that same variable, with the magenta hex as its SSR/jsdom fallback. The marker ring becomes
  `--color-surface` (it was a hardcoded white, which vanishes into a light basemap) and the frame
  background `--color-surface-2`.
- **Accent fill.** `--color-accent-fill` → magenta-400, `--color-accent-fill-hover` → magenta-300, in
  both themes. Inherited unchanged by `Button.primary`, `FilterChips` (selected) and `Toast`.

Light + dark both come from tokens; no per-component theming was added.

## Design / implementation notes

- `buildConditionMetric` already receives the full in-window `DayPoint[]`; `history` is its tail, so
  no extra fetch and no new server work — the same series the engine already pulled.
- The theme is *watched*, not read once: `ThemeToggle` rewrites `data-theme` on `<html>` in place, so
  a mounted map would otherwise keep the basemap of whichever theme it opened in. A `MutationObserver`
  scoped to that one attribute calls `TileLayer.setUrl` and redraws, which also re-resolves the accent
  and marker-ring tokens through `getComputedStyle`. It is disconnected in the same teardown that
  removes the map, and skipped entirely where `MutationObserver` is undefined.

## Test plan

- **Unit:** `insights.condition.test.ts` — `history` keeps dates, preserves interior gaps as null,
  and is capped at `HISTORY_POINTS`.
- **Component:** `ConditionCard.svelte.test.ts` — the Body Battery chart renders with an accessible
  name when the channel is present, and the card omits it (without leaving an empty block) when it is
  not.
- **API integration:** unchanged; the full suite runs green.

## Closeout

- Implementing commit: `dc013f5`
