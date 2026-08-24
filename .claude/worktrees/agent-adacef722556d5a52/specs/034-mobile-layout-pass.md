# Spec 034 — Mobile: drawer above the maps, chrome that fits a phone

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/ui/` (tokens, AppShell, LeafletMap, RadarChart, ToastContainer) +
  narrow-screen fixes in `modules/landing`, `modules/activities`, `modules/analytics`, `modules/sync`
  <!-- The other module grids (training, walking, insights, metrics-dashboard, dashboards, heatmap)
       were checked at 375px and already collapse correctly; they are deliberately untouched. -->
- **Owner agent:** ui-designer
- **Depends on:** 001 (design system), 015 (LeafletMap), 027 (sidebar freshness), 031 (readout fit)

## Context

The app is used from a phone at least as often as from a desk, and the shell was never audited at
375 px. Three things are actually broken rather than merely tight:

1. **Leaflet escapes its card.** `LeafletMap` never establishes a stacking context, so Leaflet's own
   panes (z-index 200–800) and controls resolve against the *root* stacking context and paint over
   the app chrome — which sits at 20/25/30. Open the drawer on Aktywności or Mapa ciepła and the
   route thumbnails, their sport badges and the attribution strip sit **on top of** the drawer and
   its scrim. `ActivityCard` had already worked around this locally (`.sport { z-index: 400 }`),
   which is the same bug seen from the inside.
2. **The drawer is a one-way door.** Tapping a nav link navigates but leaves the drawer open over
   the page it just loaded, there is no Escape, and the page behind it scrolls under the finger.
   Off-canvas nav also stays in the tab order and the a11y tree while hidden.
3. **Chrome and data grids assume desktop width.** The landing top bar wraps its two nav links onto
   two lines each; the shell's brand row overflows its fixed 60 px height once the tier badge sits
   beside the wordmark; `--space-6` gutters on both sides cost 48 px of a 375 px screen; and a
   handful of module grids keep 2–5 rigid columns down to the narrowest phone (`ActivityCard`'s
   stats row clips "PRZEWYŻSZENIE" off the card edge).

This spec fixes the stacking bug at its source, makes the drawer behave like a drawer, and does one
narrow-screen pass over the chrome and the rigid grids. Desktop is left alone except where the audit
turned up a defect that was never width-specific: `ActivityCard`'s stat labels were clipped at 1280
too (by 17 px), and the rider radar's axis labels were clipped at every width — both are fixed for
all widths rather than patched below a breakpoint.

## Requirements (acceptance criteria)

- [x] `tokens.css` owns a **stacking scale** (`--z-content`, `--z-sticky`, `--z-scrim`, `--z-drawer`,
      `--z-toast`) documented as the single source of truth, with the chrome layers above Leaflet's
      own 200–800 range. `AppShell` and `ToastContainer` use the tokens, no bare numbers.
- [x] `LeafletMap` establishes `isolation: isolate`, so no Leaflet pane, control or attribution can
      paint outside its own card — on any page, at any width. `ActivityCard`'s `z-index: 400`
      workaround drops to `var(--z-content)` and the sport badge still sits over the map.
- [x] Opening the drawer and tapping a nav link **closes the drawer** (SvelteKit client navigation
      included); `Escape` closes it; the scrim still closes it.
- [x] While the drawer is open on a narrow screen the page behind it does not scroll.
- [x] When the drawer is closed on a narrow screen the sidebar is `inert` — not focusable, not in
      the a11y tree — and it is fully interactive again when open and on wide screens.
- [x] The drawer never exceeds the viewport (`min(--sidebar-width, 86vw)`) and its brand row keeps
      the wordmark on one line beside the tier badge without overflowing `--topbar-height`.
- [x] At ≤768 px the shell's top bar and content gutters step down (`--space-4`), the page title
      truncates with an ellipsis instead of wrapping the bar taller, and the content respects
      `env(safe-area-inset-*)` on notched phones.
- [x] The landing top bar fits 375 px: brand on one line, nav links not wrapping mid-label (the two
      section links step out below 560 px, leaving theme + sign-in reachable).
- [x] No page in `NAV_ITEMS` scrolls horizontally at 375 px and no label is clipped. Fixed on the
      way: `/analytics`'s tier badge overflowed the viewport beside the heading (now wraps);
      `/dane`'s phase rows dropped their status pill onto a stretched third row (now placed beside
      the name); `ActivityCard`'s stats grid is sized off its longest label instead of a fixed three
      columns.
- [x] `RadarChart` reserves its label gutter from the labels it was actually given, so a caller
      cannot clip its own axes (cycling's "WYTRZYMAŁOŚĆ (60 MIN)" ran off the box at every width).
- [x] Unit tests pass (no e2e): `AppShell.svelte.test.ts` covers open, scrim, close-on-nav, Escape,
      scroll-lock and `inert`; `LeafletMap.styles.test.ts` guards the isolation rule; `RadarChart`
      covers the auto-sized gutter.
- [x] Built only from `lib/ui` components + design tokens; no raw hex, no magic px outside the
      documented breakpoints.
- [x] No secrets logged or committed.

## API contract

None — presentation only, no endpoint, MCP tool or contract type changes.

## UI

- **AppShell (narrow, ≤768 px):** drawer at `min(248px, 86vw)` over a scrim; brand row one line;
  top bar and content gutters at `--space-4`; title truncated; safe-area padding. Drawer closes on
  nav, Escape and scrim tap; body scroll locked while open; sidebar `inert` while closed.
- **Landing (≤560 px):** the top bar keeps brand + theme toggle + "Zaloguj się"; "Jak to działa" and
  "Hostuj u siebie" move out of the bar (both remain reachable — they are anchors to sections
  further down the same page, and the hero's ghost CTA links to `#self-host`).
- **Module fixes:** `AnalyticsView`'s header wraps instead of pushing the tier badge off-screen;
  `DataView`'s phase rows place name + status on one row with the summary under it; `ActivityCard`'s
  stats use `repeat(auto-fit, minmax(7rem, 1fr))` — three across where the longest label fits, two
  where it doesn't.

## Test plan

- `AppShell.svelte.test.ts` — drawer opens on the menu button; closes on scrim click, on a nav
  destination being tapped, and on `Escape`; body scroll is locked only while open; the sidebar is
  `inert` while closed and not while open; widening the viewport drops an open drawer. `matchMedia`
  is stubbed, since jsdom has none.
- `LeafletMap.styles.test.ts` — asserts the `isolation: isolate` rule at source level (mounting the
  component would boot Leaflet to check one declaration jsdom cannot resolve anyway).
- `RadarChart.svelte.test.ts` — a long-label axis set widens the viewBox and stays inside it; an
  explicit `labelSpace` still wins.
- Existing suites stay green: `pnpm run verify` (917 tests, svelte-check clean, lint, build).
- Manual at 375 px, in the browser: every route in `NAV_ITEMS` plus `/training/{rower,bieg}` — no
  horizontal scroll anywhere, and the drawer now covers the route thumbnails on Aktywności.

## Notes / follow-ups

- Breakpoints stay raw px (`768` shell, `640` grids, `560` landing bar, `860` landing hero) because
  custom properties cannot be used in `@media`; a future spec could move them to a build-time SCSS
  map or container queries. The set used here is now documented in this spec. `AppShell` mirrors the
  768 px value in JS (`MOBILE_QUERY`) — the one place the two can drift.
- The stacking scale in `tokens.css` was written for this spec but landed in commit `48fc9fb` (the
  product rename), which was committed from a parallel session while this work was in progress.
- Known nit, deliberately left: on the landing hero's fixture tile, "TĘTNO SPOCZYNKOWE" still breaks
  mid-word at 375 px. That is spec 031's documented floor — below 0.72 of the label token the word
  wraps rather than shrinking further — and re-tuning it belongs with 031, not here.
- `TrainingOverview` keeps one full-width tile per row below 520 px (spec 025's choice). It costs a
  lot of vertical space on a phone; worth revisiting as a product call, not a bug fix.
