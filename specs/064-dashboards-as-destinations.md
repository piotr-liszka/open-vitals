# Spec 064 — Dashboards as first-class destinations

- **Status:** Closed
- **Module:** `apps/web/src/modules/dashboards/`
- **Owner agent:** module-dev
- **Depends on:** 016 (configurable dashboards), 063 (sidebar redesign), 047 (global range)

## Context

Spec 016 already built most of a multi-dashboard system: many dashboards, each with widgets the user
adds, removes, reorders and resizes, persisted as one JSON document in the per-user settings bag.
What it never got was a way in. All of it hid behind a single `Panel` nav entry parked at the bottom
of `System` (spec 048 demoted it there), and switching dashboards meant finding a tab strip *inside*
that page. A dashboard you built and named could not be linked, bookmarked, or reached in one click —
so in practice nobody made a second one.

This spec makes each dashboard a real destination: its own nav entry under a `Panele` group directly
below `Start`, its own URL, and a create/rename/delete flow that lives where the dashboards are rather
than behind an edit mode. `Przegląd` stops being special — it is an ordinary dashboard that happens to
be the one a new account starts with, and it can be renamed or deleted like any other.

Two pieces of the old model go away rather than getting carried forward:

- **The tab strip**, because the sidebar is now the switcher. Keeping both would be two controls for
  one question, and the tab strip is the one that cannot be linked to.
- **`activeId`**, because with a URL per dashboard the active dashboard *is* the URL. It was state
  that could disagree with what the reader was looking at; now it cannot exist to disagree.

Reordering gains drag-and-drop, but the existing move buttons stay: a drag is not reachable from a
keyboard, and dropping the buttons would make reordering mouse-only.

## Requirements (acceptance criteria)

- [x] A `Panele` nav group sits directly below `Start`, above `Trening`
- [x] Every dashboard the user owns is one entry in that group, labelled with its own name
- [x] The group ends with a `Nowy panel` entry leading to the create page
- [x] Each dashboard has its own URL (`/dashboard/<id>`) that is linkable and bookmarkable
- [x] `/dashboard` redirects to the user's first dashboard; an unknown id is a 404, not a silent fallback
- [x] The old `Panel` entry is gone from the `System` group, and the in-page tab strip is gone
- [x] A dashboard can be created with a name, renamed in place, and deleted
- [x] Deleting asks for confirmation and names what will be lost; every other edit autosaves
- [x] The last dashboard cannot be deleted — a user is never left with no panel and no way to make one
- [x] Widgets reorder by drag-and-drop, and the keyboard move buttons still work
- [x] `Przegląd` is an ordinary dashboard: renameable, deletable, with no special-casing in the model
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

One endpoint, one shape. The layout is a single small JSON document, so every mutation — create,
rename, delete, reorder, resize, add/remove widget — is the same operation: *save this document*.
Adding a second endpoint per verb would be several ways to express one write.

```
POST /api/dashboards   req: DashboardConfig   res: 200 DashboardConfig (sanitized)   401 unauthenticated
GET  /dashboard        → 303 /dashboard/<first id>
GET  /dashboard/<id>   → 200 page | 404 unknown id
GET  /dashboard/new    → 200 create page
```

`sanitizeConfig` remains the trust boundary: unknown widget types, bad spans, junk names and duplicate
ids are normalised server-side before anything is stored or rendered. It also drops the legacy
`activeId` key on read, so configs written before this spec load without a migration.

## UI

- `NavLinks.svelte` — renders the `Panele` group from `page.data.dashboardNav`.
- `DashboardGrid.svelte` — loses the tab strip; gains DnD, in-place rename, delete confirmation.
- `DashboardCreate.svelte` (new) — the name-it-first create page.
- `ConfirmDialog.svelte` (new, `lib/ui`) — native `<dialog>`, focus-trapped by the platform. Added
  here because deletion is the first genuinely destructive action in the app; the workouts planner
  (spec 066) needs the same control.
- States: empty dashboard, single dashboard (delete disabled with a reason), drag hover, saving.

## Design / implementation notes

- **Nav data comes from the root layout**, not from each page: `+layout.server.ts` returns
  `dashboardNav` (id + name only), so `NavLinks` reads it from `page.data` and no page has to thread
  it. Loaded only for a signed-in Advanced-tier user — it is one settings read, skipped entirely for
  the landing page and Base tier.
- **`dashboardNavItems` is pure** (config in, nav items out) and unit-tested, so nav placement is a
  fact about a function.
- **Reordering is a pure `moveItem`** over the widget array; the DnD action only decides *from* and
  *to*. That keeps the reorder logic testable without synthesising drag events.
- **Create is a page, not a nav button.** The sidebar entry is an ordinary link, which keeps module
  logic out of `lib/ui` — and matters more than it sounds: the app sets
  `data-sveltekit-preload-data="hover"`, so a create-on-GET route would create a dashboard every time
  the pointer crossed the link.
- **`/dashboard` is a `+server.ts`, not a redirecting `+page.server.ts`** — matching `/analytics`,
  `/power` and `/running`. A route with a load but no component is not a page and SvelteKit 404s it.
  It answers 303 rather than the 308 those three use: which dashboard is "first" is user data that
  changes on reorder or delete, so it must never be cached as permanent.
- **The grid `{#key}`s on the dashboard id.** It forks the config into local editable state; without
  the key, navigating between panels would carry one dashboard's half-finished edit onto the next.

## Test plan

- **Unit:** `dashboardNavItems` places `Panele` directly after `Start` and appends the create entry;
  `moveItem` reorders and is a no-op at the ends; `sanitizeConfig` drops `activeId`, rejects unknown
  widget types, and never returns zero dashboards.
- **API integration (mock adapters):** POST rejects unauthenticated with 401; a round-trip preserves a
  reordered widget list; a config naming an unknown widget type comes back without it.
- **Route:** `/dashboard` redirects to the first dashboard; `/dashboard/<unknown>` is a 404.

## Closeout

- Commits: see `feat(dashboards): every dashboard is a destination (spec 064)`
- Verified in a running app (mock adapters): `/dashboard` → `/dashboard/main`; created `Plan startowy`
  from the create page and landed on `/dashboard/plan-startowy` with the entry in the sidebar; dragged
  a card from slot 1 to slot 3 with real `DragEvent`s (drag source faded, drop target outlined, order
  became `moveItem(0→2)`) and the new order survived a full reload; deleting asked first, named the
  three widgets at stake, then navigated to the remaining panel and repainted the sidebar; with one
  panel left the delete button is disabled and says why; `/dashboard/nie-ma-takiego` answers 404.

### Notes

- **Two bugs found by running it, not by the tests.** `/dashboard` 404'd as a redirect-only
  `+page.server.ts` (no component = not a page), and `ConfirmDialog` pinned to the top-left corner
  because the app's `* { margin: 0 }` reset overrides the UA stylesheet's `margin: auto` on
  `<dialog>`. Neither is visible to jsdom, which applies no stylesheets and does not route.
- **`.cell` and `.grid` are used by both this grid and `CoverageWidget`.** Harmless — Svelte scopes
  every rule — but it is why a DOM query for `.grid > .cell` finds seven elements on a page showing
  three widgets. Worth a rename if anyone touches those files.

- Follow-ups: none.
