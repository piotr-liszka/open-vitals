# Spec 088 — Analiza i Plan treningowy: dwie sekcje zamiast jednego paska

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/training/` + `apps/web/src/lib/nav.ts`
- **Owner agent:** module-dev
- **Depends on:** 025 (training section + SubNav), 037 (volume), 048 (nav grouping), 060 (goals), 063 (sidebar), 066 (planner)

## Context

The training tab bar reads as one row of seven peers — `Przegląd · Objętość · Rower 221 · Bieg 654 ·
Marsz 50 · Plan treningowy · Cele` — but they are not peers. Five of them are an analysis of what has
already happened; two are where the athlete decides what happens next. `trainingTabs` already knows
this: it pushes `PLAN` and `GOALS` last with the comment *"the only tabs that are not an analysis of
what has already happened"*. The bar states the ordering and not the distinction.

Split it at the sidebar instead. **Analiza** and **Plan treningowy** become two entries under
`Trening`, each owning its own tab set. Nothing about what the pages do changes, and no URL moves.

## Requirements (acceptance criteria)

### Sidebar

- [x] The `Trening` group holds three entries: **Analiza** (`/training`), **Plan treningowy**
      (`/training/plan`), **Aktywności** (`/activities`). The single `Trening` entry is gone.
- [x] Both new entries carry a distinct icon from the shared set — the sidebar's collapsed state is
      icons only, so two entries sharing a glyph would be indistinguishable there.
- [x] Active-link matching picks the **longest** matching `href`. Today `isActive` is
      `path === href || path.startsWith(href + '/')`, so on `/training/plan` both `Analiza` and
      `Plan treningowy` would light up. Longest-match is a general rule and needs no per-item config.

### Tabs

- [x] `/training`, `/training/volume`, `/training/ride|run|walk` show the **Analiza** tabs:
      `Przegląd · Objętość · Rower · Bieg · Marsz` — per-sport tabs still only for families the
      athlete actually has, and `Objętość` still only once there is any activity at all.
- [x] `/training/plan` and `/training/goals` show the **Plan treningowy** tabs: `Plan · Cele`. Both
      unconditional, for the reason the current code already gives — they are not reports on what
      happened, and an empty account is exactly the one with a first session and a first race to enter.
- [x] The layout picks the tab set from the pathname; `+layout.server.ts` keeps loading sport counts
      only for the set that needs them.
- [x] `trainingTitle` reflects the owning section: `Analiza · Objętość`, `Plan treningowy · Cele`,
      and the bare section name on each section's own root.

### Not changing

- [x] **No URL moves.** `/training/plan` and `/training/goals` keep their paths, so no redirect is
      needed and no bookmark breaks. The legacy Polish redirects (`bieg`, `rower`, `marsz`,
      `objetosc`, `cele`) keep working exactly as they do now.
- [x] The `?range=` carry-over across tabs and to range-aware sidebar destinations is unchanged.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

None. This is navigation only — no endpoint, no payload change.

## UI

`NavLinks` (sidebar) and `SubNav` (tab bar), both unchanged as components apart from the
longest-match rule in `NavLinks`. Light + dark via tokens.

## Design / implementation notes

- `trainingTabs` splits into two builders in `training-nav.ts`, and one resolver maps a pathname to
  the section that owns it. Keep the resolver total: an unknown `/training/*` path falls back to
  Analiza rather than rendering an empty bar.
- Labels: `Analiza` and `Plan treningowy` go through the catalogs. `Cele` and `Plan treningowy` are
  currently hardcoded Polish in `training-nav.ts`; move them into `pl.ts`/`en.ts` while touching them.
- The tab inside the plan section is labelled `Plan`, not `Plan treningowy` — repeating the section's
  own name as its first tab reads as a broken breadcrumb.

## Test plan

- **Unit:** the pathname resolver maps every `/training/*` route to the right section, including the
  unknown-path fallback; the Analiza builder still hides sports with a zero count and still gates
  `Objętość` on a non-zero total; the Plan builder is unconditional.
- **Unit:** `isActive` longest-match — `/training/plan` activates `Plan treningowy` and NOT `Analiza`;
  `/training/run` activates `Analiza`; `/` still only activates `Start`.
- **Component:** `NavLinks` marks exactly one item `aria-current="page"` for each of `/training`,
  `/training/run`, `/training/plan`, `/training/goals`.
- **Server load:** `+layout.server.ts` returns the plan tab set on `/training/plan` and the analysis
  set on `/training/run`.

## Closeout

- Commits: this change.
- Icons: `activity` for Analiza (measurement of what happened), `calendar` for Plan treningowy (what
  is going to). `flame` is freed. `nav.test.ts` already enforced "never two destinations on one
  glyph"; that rule is load-bearing now that these two sit side by side in the collapsed sidebar.
- **Longest-match alone was not enough, and `owns` is the exception it needed.** `/training/goals` is
  the plan section's second tab but lives outside `/training/plan`, so pure longest-match handed it
  to `/training` — the sidebar would have said `Analiza` on a page whose tab bar said `Plan · Cele`.
  `NavItem.owns` lets an entry claim such a path, and a claim is scored by ITS OWN length so it can
  never outrank a genuinely deeper entry.
- **Bug found and fixed in passing:** `+layout.svelte` built `const tabs = data.tabs.map(withRange…)`
  and then passed `items={data.tabs}` to `SubNav`, so the `?range=` carry-over across training tabs
  (spec 047) had never actually worked. It does now. `SubNav` compares paths only, so `aria-current`
  is unaffected.
- The whole sidebar moved onto the message catalog rather than just the two new entries. The
  `nav.*` keys had existed since spec 076 with nothing reading them — which is how a translated app
  ships an untranslatable sidebar — and adding a parallel mechanism for two items would have
  duplicated every label. Dashboard-supplied items still carry their user-chosen names verbatim.
- `trainingTabs()` is gone, replaced by `analysisTabs()` + `planTabs()` and the total
  `trainingSection(pathname)` resolver. `loadTrainingTabs` only reads `store.listSports` for the
  analysis set — asserted by a counting mock, since the plan section has nothing to gate.
- Follow-ups: none outstanding.
