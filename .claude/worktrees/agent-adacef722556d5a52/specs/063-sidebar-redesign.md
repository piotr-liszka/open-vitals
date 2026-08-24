# Spec 063 — Sidebar redesign: icons, chrome headings, three-state collapse

- **Status:** Closed
- **Module:** `apps/web/src/lib/ui/` + `apps/web/src/lib/nav.ts`
- **Owner agent:** ui-designer
- **Depends on:** 048 (navigation consolidation), 022 (icon set), 032 (view preferences)

## Context

The sidebar's group headings (`Trening`, `Zdrowie`, `System`, spec 048) are styled as small uppercase
text sitting in the same vertical rhythm as the links beneath them, with the same left inset. A reader
scanning the column sees seven text runs and cannot tell which three are targets and which four are
labels — so the headings read as links that do nothing when clicked. Grouping that has to be *decoded*
is worse than no grouping, because the reader pays attention for nothing.

Two changes fix it together. **Icons** give every real destination a mark the headings do not have, so
"has an icon" becomes the visual predicate for "is clickable" — a distinction that survives at a glance
and does not depend on reading the words. **Chrome treatment** — a hairline rule, tighter type, no
hover response — moves the headings out of the link vocabulary entirely.

The same redesign is where the sidebar gains a **three-state collapse** (full → icons → hidden). At
248px the sidebar costs a fifth of a 1280px laptop screen, and the charts this app is mostly made of
want that width back. Icon-only keeps navigation one click away at 68px; hidden gives the content
everything. The nav icons sit at the **same x-position in both visible states**, so collapsing slides
the labels away rather than re-laying-out the column — the eye keeps its anchor.

## Requirements (acceptance criteria)

- [x] Every primary nav item renders an icon from the shared set (`$lib/ui/icons`); no nav item is text-only
- [x] Group headings are visually chrome: hairline rule, no hover/active response, not focusable
- [x] The active item is marked by an accent rail plus the existing soft background, not colour alone
- [x] Sidebar has three states — `expanded` (icons + text), `icons` (icons only), `hidden`
- [x] A single toggle in the sidebar brand row cycles the states; its accessible name announces the state it will move TO
- [x] When the sidebar is `hidden`, a toggle appears at the far left of the topbar and restores it
- [x] Nav icons occupy the identical x-offset in `expanded` and `icons` (verified by a unit test on the shared inset token)
- [x] In `icons`, every label stays in the accessibility tree (visually hidden, not `display: none`) and each item carries a `title` tooltip
- [x] The chosen state persists per device via `$lib/ui/pref` and is applied before first paint (no flash)
- [x] Below 768px the sidebar stays the existing drawer; collapse states do not apply there
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

N/A — no endpoint. The preference is device-local (`localStorage`, spec 032 rules: opinions about
pixels only, never user data).

```
localStorage['gb-sidebar'] ∈ { 'expanded' | 'icons' | 'hidden' }   default 'expanded'
document.documentElement.dataset.sidebar = <same>                  applied pre-paint in app.html
```

## UI

- `NavLinks.svelte` — icons per item, headings as chrome, accent rail on active.
- `AppShell.svelte` — reads the state, sizes the sidebar, hosts both toggles.
- `SidebarToggle.svelte` (new, `lib/ui`) — the cycling control; presentational, state passed in.
- `Icon.svelte` / `icons.ts` — seven new glyphs: `home`, `grid`, `list`, `database`, `settings`,
  `panel-left`, `plus`. Drawn on the same 24×24 grid with the same construction rules as spec 022.
- States: expanded / icons / hidden; mobile drawer unchanged. Light + dark via tokens only.

## Design / implementation notes

- **The shared inset is a token.** `--nav-inset` is the single number that puts a nav icon and the
  brand-row toggle glyph at the same x. `--sidebar-width-icons` is *derived* from it in the
  stylesheet, so the two states cannot drift apart by editing one of them.
- **Pre-paint application** mirrors the existing theme bootstrap in `app.html`: the collapsed width is
  a layout change, so applying it after hydration would visibly reflow the whole page.
- **All three states are CSS keyed on `html[data-sidebar]`** — one mechanism, not two. `--sidebar-width`
  is redefined per state on the root, and both the sidebar's width and the frame's margin already read
  it, so the layout needs no component logic at all. `NavLinks` takes no `labels` prop for the same
  reason: a prop only arrives at hydration, and the width has to be right on the first frame anyway.
  The `$state` in `AppShell` exists solely to label the toggle and persist the choice.
- `sidebarStates` / `nextSidebarState` are pure and unit-tested, so the cycle order is a fact about a
  function rather than a fact about a click handler.

## Test plan

- **Unit:** `nextSidebarState` cycles expanded → icons → hidden → expanded; every `NAV_ITEMS` entry has
  an icon and that icon exists in `ICON_NAMES`; new glyphs render real path/circle elements.
- **Component (jsdom):** headings are not links and have no `href`; in `icons` state labels remain in
  the a11y tree; the toggle's `aria-label` names the next state; the topbar toggle only exists while hidden.
- **API integration:** N/A (no handler touched).

## Closeout

- Commits: see `feat(ui): sidebar redesign — icons, chrome headings, three-state collapse (spec 063)`
- Verified in a running app (mock adapters): nav icons measure at exactly 24px from the sidebar edge
  in BOTH `expanded` and `icons`; `hidden` removes the sidebar from the a11y tree entirely and the
  topbar toggle restores it; the state survives a full page load with no reflow; the mobile drawer
  still opens to a full 248px with all seven links while a desktop `hidden` preference is stored.

### Two things this spec fixed that it did not set out to fix

1. **The CSP was blocking `app.html`'s inline bootstrap — and had been all along.** `kit.csp` sets
   `script-src 'self'` plus a per-response nonce, and SvelteKit only hashes the bootstrap *it*
   injects. The hand-written block carried no nonce, so it was refused on every page load. The
   pre-existing **theme** script was therefore dead too: `data-theme="light"` hard-coded on `<html>`
   was doing the whole job, which is why a dark-mode user got a light flash on every navigation and
   nobody had traced it. Fixed with `nonce="%sveltekit.nonce%"`. This is why nothing in this repo may
   be prerendered without revisiting it (`mode: 'auto'` switches to hashes there).
2. **Ten of eleven pages were passing an identical `nav` snippet.** `AppShell` now renders `NavLinks`
   itself from an `advanced` prop; the snippet survives as an escape hatch that only `/styleguide`
   uses. Ten imports and ten snippets deleted, and the collapse state never has to be threaded
   through a page to reach the nav.

- Follow-ups: none.
