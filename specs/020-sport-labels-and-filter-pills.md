# Spec 020 — Shared sport labels + collapsible filter pills

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/sport-labels.ts`, `apps/web/src/lib/ui/FilterChips.svelte`,
  `apps/web/src/modules/activities/`, `apps/web/src/modules/heatmap/`, `apps/web/src/modules/activity-detail/`,
  `apps/web/src/modules/dashboards/widgets/`
- **Owner agent:** module-dev
- **Depends on:** 015 (local data store), 001 (design system)

## Context

User feedback on Aktywności/Heatmap: several sports render untranslated (`indoor_cardio`, `indoor_cycling`,
`indoor_rowing`, `inline_skating`), and the sport filter row shows every sport the user has ever recorded
alphabetically, which is a wall of pills. Root cause: there is no i18n layer and no shared sport dictionary —
the same partial `SPORT_LABELS` map was copy-pasted into six components with four different key sets and two
different fallbacks, so unknown keys leaked raw English (or raw `snake_case` on the heatmap), and `swimming` /
`lap_swimming` both mapped to "Pływanie", rendering two identical chips. This spec introduces one shared,
client-safe sport dictionary and one shared collapsible chip row.

## Requirements (acceptance criteria)

- [x] `lib/sport-labels.ts` is the single source of truth: Polish `label` + `group` per Garmin `typeKey`,
      modelled on `lib/metric-labels.ts`
- [x] Covers every key the six copy-pasted maps had, plus `indoor_cardio`, `indoor_cycling`, `indoor_rowing`,
      `inline_skating` and a wider sweep of Garmin type keys (~90 entries)
- [x] Indoor/outdoor variants stay distinct (`indoor_cycling` → "Rower stacjonarny", `treadmill_running` →
      "Bieżnia", `lap_swimming` → "Pływanie (basen)", `open_water_swimming` → "Pływanie (wody otwarte)") so the
      chip row can never show two identical labels
- [x] `sportLabel(key)` never returns a raw `snake_case` key — unknown keys are humanised + capitalised
- [x] `sportGroup(key)` returns `run | ride | swim | walk | strength | other`; `training.api.ts` and
      `running.api.ts` use it instead of their own local sets, with identical behaviour for the keys they listed
- [x] All six local `SPORT_LABELS` maps are deleted and import from `lib/sport-labels.ts`
- [x] Sport facets are ordered by **frequency** and carry counts (`LocalStore.listSports` → `SportCount[]`),
      in both the pg adapter and the in-memory fake
- [x] Activities + Heatmap show the 5 most frequent sports and collapse the rest behind `+ N więcej`
- [x] A selected sport outside the top 5 stays visible while collapsed
- [x] The expander is a real `<button>`, keyboard reachable, with `aria-expanded`
- [x] The chip row is a shared `lib/ui` component (`FilterChips.svelte`), exported from `lib/ui/index.ts`
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens (if UI)
- [x] No secrets logged or committed

## API contract

No new HTTP endpoint. Two existing loader contracts change shape (facets gain counts + frequency order):

```ts
// lib/server/store/types.ts (PORT)
interface SportCount { readonly sport: string; readonly count: number }
listSports(userId: string): Promise<SportCount[]>   // was Promise<string[]>; most frequent first, ties by key asc

// modules/activities/activities.types.ts
interface ActivitiesFacets { sports: SportCount[]; total: number; totalDistanceM: number; totalDurationS: number }

// modules/heatmap/heatmap.types.ts
interface HeatmapData { …; sports: SportCount[]; years: number[]; sport: string | null; year: number | null }
```

```ts
// lib/sport-labels.ts (client-safe)
type SportGroup = "run" | "ride" | "swim" | "walk" | "strength" | "other";
interface SportMeta {
  key: string;
  label: string;
  group: SportGroup;
}
const SPORT_LABELS: readonly SportMeta[];
function sportLabel(key: string): string; // Polish label, humanised fallback
function sportMeta(key: string): SportMeta | undefined;
function sportGroup(key: string): SportGroup; // unknown → 'other'
function humanizeSportKey(key: string): string;
```

```svelte
<!-- lib/ui/FilterChips.svelte -->
options: FilterChipOption[]        // { value, label } — caller supplies the order
value: string | null               // null selects the "all" chip
onSelect: (value: string | null) => void
ariaLabel: string
allLabel?: string | null = 'Wszystkie'   // null hides the "all" chip
maxVisible?: number = 5
expandLabel?: (hidden: number) => string = (n) => `+ ${n} więcej`
collapseLabel?: string = 'Mniej'
```

## UI

- New shared `lib/ui/FilterChips.svelte`: wrapping pill row, `role="group"` + `aria-label`, `aria-pressed` per
  chip, dashed "more" chip with `aria-expanded`, `:focus-visible` ring. Tokens only (`--color-surface`,
  `--color-border`, `--color-accent`, `--color-on-accent`, `--radius-full`, `--space-*`, `--text-sm`,
  `--focus-ring`) — light + dark come free. It replaces the bespoke `.chips/.chip` CSS previously inlined in
  `ActivitiesView.svelte` and `HeatmapView.svelte` (which also used a non-existent `--color-text-on-accent`
  token with a raw `#fff` fallback).
- `ActivitiesView`: sport chips → `FilterChips` (top 5 + expander). `HeatmapView`: sport chips → `FilterChips`
  (top 5), year chips → `FilterChips` (`maxVisible={8}`).
- Labels everywhere (`ActivityCard`, `ActivityDetail`, `ActivityTypesWidget`, `RecentActivitiesWidget`) now come
  from `sportLabel()`.
- States: empty facet list → only the "Wszystkie" chip; ≤5 sports → no expander; selected-but-hidden sport is
  pulled into the visible head.

## Design / implementation notes

- `lib/sport-labels.ts` sits outside `$lib/server` (same rule as `metric-labels.ts`) so components and handlers
  share it; it is pure data + pure functions, nothing injected.
- Ports & adapters: only the `LocalStore` port changed (`listSports` return type). Both adapters updated — pg
  (`GROUP BY sport ORDER BY count DESC, sport ASC`) and the in-memory fake (same ordering) — so tests stay
  hermetic. No handler gained a direct dependency.
- Frequency ordering is computed in SQL, not in the handler, so the chip order is stable and cheap.
- The heatmap sport facet stays unfiltered by year (unchanged behaviour); only its shape and order changed.
- `training.api.ts` / `running.api.ts` dropped their local `CYCLING`/`RUNNING` sets for `sportGroup()`. Every key
  they listed keeps its previous family; extra keys (e.g. `bmx`, `ultra_run`) now match too, which is the intent.

## Test plan

- **Unit:** `lib/sport-labels.test.ts` — unique keys, the previously-mapped labels, the four reported untranslated
  keys, distinctness of indoor/outdoor variants, humanised fallback (never `snake_case`), group mapping, and the
  exact cycling/running families `training.api`/`running.api` relied on.
- **Unit (UI):** `lib/ui/FilterChips.svelte.test.ts` — group labelling, `aria-pressed`, `onSelect` (value + null),
  expand/collapse via a real button with `aria-expanded`, selected-outside-head stays visible, no expander when
  everything fits, custom `maxVisible`/`allLabel`/`expandLabel`, hidden "all" chip.
- **API integration (mock adapters):** `activities.api.test.ts` + `heatmap.api.test.ts` assert
  `facets.sports` / `sports` as `[{ sport, count }]` most-frequent-first; `store/memory.test.ts` asserts the
  adapter contract.

## Closeout

- Commits: _pending — handed off to `qa-closer`_
- Notes / follow-ups:
  - `pnpm run lint` (`prettier --check .`) is red across ~107 pre-existing `src/` files at HEAD; this change adds
    no new offenders (its new files are Prettier-clean). A repo-wide `pnpm run format` is a separate chore.
  - No i18n framework was introduced — the app is Polish-only and `sport-labels.ts` mirrors `metric-labels.ts`.
    If a second language is ever needed, these two modules are the seam.
