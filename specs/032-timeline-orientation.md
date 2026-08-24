# Spec 032 — Timeline: pion / poziom, z zapamiętanym układem

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/timeline/` (+ `apps/web/src/lib/ui/pref.ts`)
- **Owner agent:** module-dev
- **Depends on:** 001 (design system), 018 (local dates), 022 (start-page timeline)

## Context

Spec 022 built the start-page timeline as **one vertical rail**, newest-first, with a separate "Co
dalej" section underneath. That reads well on a phone and for scanning the last two days, but it
hides the thing a timeline is best at: **time as an axis**. Twelve days of events push the planned
half below the fold, and nothing on screen says "here is today, here is behind me, here is ahead".

This spec adds a **second layout of the same data** — a horizontal time axis that runs
chronologically left → right (oldest → `dziś` → planned), scrolls horizontally, and puts one day per
column. Neither layout is "the right one": the vertical rail is better for reading detail, the
horizontal axis better for seeing shape and span. So the reader picks, with a segmented control in
the card header, and **the choice is remembered in `localStorage`** — a per-device view preference,
not user data, so it deliberately does not go to the server (no round-trip, no DB column, works
before hydration finishes).

## Requirements (acceptance criteria)

- [x] `TimelineView` renders the same `TimelineData` in two layouts: `vertical` (spec 022's rail,
      newest-first) and `horizontal` (a scrollable time axis, oldest-first).
- [x] A `SegmentedControl` in the card header switches layouts (`Pion` / `Poziom`), labelled for
      assistive tech; no other control on the card changes behaviour between layouts.
- [x] The choice persists in `localStorage` under `gb-timeline-orientation` and is restored on the
      next visit. An unreadable / absent / garbage value falls back to `vertical` — never throws
      (private mode, storage disabled, SSR).
- [x] The preference is read **after mount**, so the server-rendered markup and the first client
      render agree (no hydration mismatch); the switch to a stored `horizontal` happens in the same
      frame as mount.
- [x] Horizontal layout is **one continuous axis**: past day-columns in chronological order
      (oldest → newest), a `dziś` tick, then the planned window on the right. Same event set, same
      importance ranking, same expander — only the geometry differs.
- [x] The horizontal track scrolls with the wheel/trackpad, with a keyboard-focusable scroll
      container (`tabindex="0"`, `role="group"`, an `aria-label`), scroll-snapped columns and faded
      edges that signal "there is more". On mount it starts scrolled to **today**, not to the
      oldest day.
- [x] The truthful planned states from spec 022 survive in both layouts: `not_synced` / `empty` /
      `ok` still produce three different, true messages. **Nothing is fabricated to fill a column.**
- [x] A day with no events is **not** a column in the horizontal axis (the timeline stays an event
      stream, not a calendar grid — spec 022's thesis) but the day gap is visible in the labels.
- [x] `lib/ui/pref.ts` is a shared, injectable-storage helper (`readEnumPref`, `writePref`) so any
      future view preference reuses it instead of touching `localStorage` inline.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new endpoint, no server change. `loadTimeline` and `TimelineData` are untouched — this is a
presentation-only change over the payload the start page already loads.

```
lib/ui/pref.ts
  readEnumPref<T extends string>(key, allowed: readonly T[], fallback: T, storage?): T
  writePref(key, value: string, storage?): void        // both swallow storage errors

modules/timeline/timeline.types.ts
  TimelineOrientation = 'vertical' | 'horizontal'
  TIMELINE_ORIENTATIONS: readonly TimelineOrientation[]
  TIMELINE_ORIENTATION_KEY = 'gb-timeline-orientation'
```

## UI

- `Card` (header `actions` snippet) + `SegmentedControl` + `Button` (expander) + `Icon`.
- `TimelineEventRow` gains `layout: 'rail' | 'column'`: same content, node/padding geometry differs.
- Horizontal track: CSS grid of fixed-width columns (`subgrid` rows) in an `overflow-x: auto` scroller
  with `scroll-snap-type: x proximity`, a hairline axis drawn across the columns, and `mask-image`
  fades applied only to an edge that actually hides track.
- States: not-connected / consent-off / no-data / empty-window / planned-not-synced — all unchanged
  in vertical, rendered as a compact dashed column in horizontal.
- Light + dark via tokens only (`--color-grid`, `--color-border`, `--lane-*`, `--space-*`).

## Design / implementation notes

- Orientation is component state (`$state`), not a URL param: it is a device-level view preference,
  and putting it in the URL would make every shared link carry someone else's layout.
- `onMount` (not `$effect`) does the read, so SSR output is always the `vertical` default.
- The horizontal axis reuses the exact `groups` derivation and simply reverses it — one source of
  truth for grouping, so the two layouts can never disagree about which events are shown.
- Initial scroll-to-today runs after the columns are in the DOM (`onMount` + a `$effect` guarded on
  orientation), and is a no-op when the track is not overflowing.

## Test plan

- **Unit (`lib/ui/pref.test.ts`, node):** returns the fallback for a missing/garbage value, returns a
  stored allowed value, writes through, and swallows a throwing `Storage` (quota/private mode) on
  both read and write.
- **Component (`TimelineView.svelte.test.ts`, jsdom):** the segmented control is present and
  labelled; clicking `Poziom` renders the horizontal track (and marks the container); the choice is
  written to `localStorage`; a pre-seeded `localStorage` renders horizontally on mount; the
  horizontal day order is chronological (oldest first) while vertical stays newest-first; the
  expander and the planned states still work in horizontal; a garbage stored value renders vertical.
- **API integration:** unchanged — no server surface in this spec.

## Closeout

- Commits: `f2d66b4` — feat: timeline pion/poziom + profil biegacza (specs 032-033)
- Notes / follow-ups:
  - When planned workouts start syncing (spec 024), the horizontal axis already has a right-hand half
    to render them in — no layout work needed.
  - The edge fades are toggled from the scroll position (`fade-start` / `fade-end`), and the inset is
    `scroll-padding-inline` on the scroller + `padding-inline` on the track: plain padding rests a
    snapped first column at 20 px, which would make "there is more to the left" permanently true.
  - The columns use CSS `subgrid` so the day heads and the axis hairline align across columns whatever
    a column's height. Chrome 117+/Safari 16+/Firefox 71+.
