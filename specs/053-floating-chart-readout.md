# Spec 053 — The stream read-out floats instead of shoving the charts down

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/activity-detail/` (+ `lib/ui/FloatingReadout.svelte`)
- **Owner agent:** ui-designer
- **Depends on:** 026, 035

## Context

On the activity detail page the "Przebieg" card (`ActivityStreamsPanel`) reads the hovered moment out
in a strip that lives in the panel **header**, above the chart stack. Idle it is one short hint line;
the instant the pointer touches a chart it becomes a large time + distance line **plus** one entry per
chart, which wraps across two or three rows. The strip only reserves `min-height: var(--space-10)`, so
the header grows and the whole chart stack jumps downward — out from under the cursor that caused it.
The read-out chases the pointer away, which is the opposite of what a crosshair read-out is for.

The fix is to take the active read-out out of document flow entirely: it becomes a floating bar pinned
to the bottom of the viewport, so the header (and therefore every chart) is exactly the same height
whether or not a moment is active.

## Requirements (acceptance criteria)

- [x] Hovering or pinning a moment causes **zero layout shift**: the panel header has the same height
      in the idle and active states, at every viewport width
- [x] The active read-out renders in a `position: fixed` bar pinned to the bottom of the viewport and
      horizontally centred — never in the header's flow
- [x] The idle hint stays in the header, on one constant-height slot (clamped so it can never grow
      the header on a narrow screen)
- [x] The floating bar carries the same content as the old strip: the active time, the distance when
      the lattice has one, and per-chart label + value + unit
- [x] The bar stays compact — its value list scrolls horizontally on overflow instead of wrapping
      taller
- [x] It appears on hover, stays while a sample is pinned, and disappears when neither is active, with
      a fade/slide-in transition that is suppressed under `prefers-reduced-motion: reduce`
- [x] The bar never takes the pointer (`pointer-events: none`), so it cannot interrupt hovering a
      chart underneath it
- [x] On phones it spans near full width with side gutters and clears `env(safe-area-inset-bottom)`;
      on desktop it is a centred bar with a sensible `max-width`
- [x] Legible in light **and** dark: elevated surface background, border, radius, shadow and blur all
      come from tokens
- [x] `aria-live="polite"` still announces the active moment (the header keeps the live region; the
      floating bar is `aria-hidden` so nothing is announced twice)
- [x] The bar is a shared `lib/ui` component (`FloatingReadout`), not bespoke panel markup
- [x] Chart behaviour, the shared crosshair, the gutter negotiation and `activity-charts.ts` are
      unchanged
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No endpoint or MCP tool changes. One new shared UI contract:

```ts
// lib/ui/FloatingReadout.svelte
export interface FloatingReadoutItem {
  key: string;
  label: string;
  value: string;
  unit?: string | undefined;
  color?: string | undefined;
}

interface Props {
  open: boolean;                    // render + animate in only while a moment is active
  lead: string;                     // the headline, e.g. the elapsed clock
  secondary?: string | undefined;   // optional second headline chip, e.g. "3,21 km"
  items: FloatingReadoutItem[];
}
```

## UI

- **`lib/ui/FloatingReadout.svelte`** (new): `position: fixed; bottom; left: 50%;
  translateX(-50%)`, `z-index: var(--z-toast)`, `--color-surface` at 92% + `backdrop-filter:
  blur(8px)` (the pattern `AppShell.topbar` already uses), `--color-border-strong`, `--radius-xl`,
  `--shadow-lg`, `pointer-events: none`. The item list is a single non-wrapping row with
  `overflow-x: auto`; the headline never scrolls away. Under 768px it becomes `left/right: var(--space-4)`
  with `transform: none` and `bottom: calc(var(--space-4) + env(safe-area-inset-bottom))`.
- **`ActivityStreamsPanel`**: the header keeps a fixed-height `.readout` slot holding either the
  `.hint` (idle) or a `.sr-only` sentence naming the active moment (active). The visible active
  read-out moves into `FloatingReadout`, keeping the `.at-time`, `.values`, `.v-label`, `.v-value`
  class names the existing tests assert on.

Both themes come from tokens; nothing is themed per-component.

## Design / implementation notes

- No ports/adapters involved — this is presentation only. No new dependency, no `Date.now()`, no fetch.
- `position: fixed` is safe here: no ancestor of the panel (`Card`, `AppShell.frame/.content`)
  establishes a containing block via `transform`/`filter`/`contain`, and `Card`'s `overflow: hidden`
  does not clip fixed descendants.
- Live-region correctness: an `aria-live` element must already be in the DOM when its content
  changes, so the region stays in the header (always rendered) and the floating bar — which mounts
  and unmounts — is `aria-hidden="true"`.
- The hint is clamped to two lines inside a `min-height: var(--space-10)` slot: two lines of
  `--text-xs` at `--leading-normal` is 36px < 40px, so the slot measures the same at every width and
  the swap to the (zero-height) `sr-only` announcement cannot move anything.
- Only `ActivityStreamsPanel` had this pattern — `TrendChart`/`BarChart` tooltips are absolutely
  positioned inside their own frames and never shifted the page, so nothing else needed the fix.

## Test plan

- **Unit (component):** `FloatingReadout.svelte.test.ts` — renders nothing while closed; renders the
  lead, the optional secondary, and one row per item with label/value/unit when open; is
  `aria-hidden`; carries no pointer events (class contract).
- **Component:** `ActivityStreamsPanel.svelte.test.ts` — existing assertions on `.hint`, `.values`,
  `.at-time` keep passing; **new**: the active read-out renders inside `.readout-float` and the
  header's `.readout` slot contains no `.values`/`.at` while active (i.e. it is out of header flow).
- **API integration (mock adapters):** unchanged `activity-detail.api.test.ts` stays green.

## Closeout

- Commits: <hashes/links — implementation complete on `claude/activity-charts-layout-2bd245`,
  `pnpm run verify` green (129 files / 1565 tests, 0 check errors, prettier clean, build ok)>
- Notes / follow-ups:
  - Status stays `Approved` until `qa-closer` verifies and closes it.
  - The bar is inert (`pointer-events: none`), so its `overflow-x: auto` value list cannot be scrolled
    by hand; on a very narrow phone with many streams the tail of the list is clipped rather than
    reachable. Growing taller was explicitly ruled out, and letting it take the pointer would
    reintroduce the bug it fixes.
  - Not added to `/styleguide`: a `position: fixed` overlay demo would hang over that whole page. If
    the component gains a second caller, a toggled demo there is worth it.
  - The bar centres on the **viewport**, not on the content column beside the desktop sidebar — the
    same anchoring `ToastContainer` uses, and it keeps the component free of AppShell assumptions.
