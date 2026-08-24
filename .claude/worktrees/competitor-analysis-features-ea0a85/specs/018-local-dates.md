# Spec 018 — Local dates everywhere (shared date helper + version stamp)

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/date.ts` (shared) + call sites in `modules/metrics-dashboard`,
  `modules/insights`, `modules/analytics`, `modules/dashboards`, `modules/activities`,
  `modules/consent`, `modules/sync`, `lib/mcp`, `lib/ui/AppShell.svelte`
- **Owner agent:** module-dev
- **Depends on:** 010 (metrics dashboard), 013 (insights), 015 (local store), 016 (widgets)

## Context

The sidebar version stamp rendered the build instant as a raw UTC ISO slice with a literal ` UTC`
suffix, so the user (UTC+1/+2) never saw their own local time. Pulling that thread exposed a bigger
problem: there was **no shared date helper at all**. Four conventions coexisted — string-slicing,
`toLocaleDateString('pl-PL')`, a local-midnight `new Date('YYYY-MM-DDT00:00:00')` parse, and
`toISOString().slice(0,10)` — with Polish month tables hand-rolled in four different components.

Worse, **"today" was computed in UTC everywhere**. For a UTC+2 user, between local midnight and 02:00
the app's "today" was still *yesterday*: the dashboard asked Garmin for the wrong day and every
trend/week window was shifted. Garmin itself reports day-keyed data in the wearer's **local** zone, so
a UTC day key was simply the wrong convention for this data. This spec introduces one timezone-explicit
date module, migrates the read paths to it, and fixes the version stamp.

## Requirements (acceptance criteria)

- [x] `apps/web/src/lib/date.ts` is the single source of truth for day-key arithmetic and Polish
      formatting; it is pure (clock + timezone are arguments, never `Date.now()`/`process.env`).
- [x] Day maths operates on `YYYY-MM-DD` strings via integer civil-date arithmetic — it never
      round-trips through `toISOString()`, so it cannot drift by a timezone.
- [x] Formatting uses `Intl` with `pl-PL`; the four hand-rolled month tables at the migrated call
      sites are deleted and the rendered strings are unchanged (`3 sie`, `3 sierpnia`, `3.08.2026`).
- [x] "Today" resolves in the configured app timezone, not UTC — verified by a test at 22:30Z, which
      is already the next local day in Warsaw.
- [x] The timezone convention is **app-scoped** (`APP_TIMEZONE`, default `Europe/Warsaw`) and is
      documented below, in `AGENTS.md` §11, `.env.example` and both prod compose files.
- [x] The version stamp shows **local** time with no `UTC` label, plus the short commit SHA, and is
      SSR-safe (no hydration mismatch).
- [x] Unit + API-integration tests pass (no e2e).
- [x] Built only from `lib/ui` components + design tokens (the new `.build-sha` span uses
      `--text-xs`, `--color-text-subtle`, `--font-mono`).
- [x] No secrets logged or committed.

## API contract

No new HTTP endpoint. Response shapes are unchanged; the **values** of existing date fields now
resolve in the app timezone instead of UTC:

```
GET  /            (loadDashboard)  res.date            YYYY-MM-DD — local today (was UTC today)
GET  /analytics   (loadAnalytics)  res.start/res.end   local 30-day window
GET  /insights    (loadInsights)   res.start/res.end   local N-day window
GET  /api/insights?window=…        res.start/res.end   local N-day window
GET  /dashboard   (loadWidgetData) weeklyVolume[].week / metricSeries[].date — local
MCP  get_insights / get_readiness  start/end           local (was raw system UTC)
```

`lib/date.ts` API (the contract everything else imports):

```ts
type DayKey = string;                        // 'YYYY-MM-DD'
const DEFAULT_TIME_ZONE = 'Europe/Warsaw';
interface NowSource { now(): Date }          // structural shape of Clock (no $lib/server import)

// validation / conversion
isDayKey(v: unknown): v is DayKey            // rejects 2026-02-30
parseDayKey(v: string): { year; month; day } // throws InvalidDayKeyError
toDayKey(v: string): DayKey                  // ISO instant OR 'YYYY-MM-DD HH:MM:SS' wall clock

// arithmetic (pure integer civil-date maths)
addDays(key, n) · daysBetween(from, to) · compareDays(a, b) · minDay(a, b) · maxDay(a, b)
dayOfWeek(key)  // 0 = Monday
startOfWeek(key) · dayRange(start, end) · lastDays(end, count)

// instant → day key (timezone-explicit)
dayKeyOf(instant: Date, tz?)  · todayKey(clock: NowSource, tz?)  · daysAgoKey(clock, offset, tz?)

// formatting (pl-PL via Intl)
formatDay(key, style?)      // 'short' 3 sie · 'shortYear' 3 sie 2026 · 'long' 3 sierpnia ·
                            // 'longYear' · 'numeric' 3.08.2026 · 'dayMonth' 03.08 · 'weekday' · 'iso'
formatInstant(v, style?, tz?)  // 'time' 16:05 · 'timeSeconds' · 'date' 3 sie 2026 · 'numeric' ·
                               // 'dateTime' 3 sie 2026, 16:05 — '' for unparseable input
resolveBrowserTimeZone(): string | undefined   // client-only; never call during SSR
```

## UI

- `lib/ui/AppShell.svelte` — version stamp: `<time datetime="{UTC instant}">` renders
  `formatInstant(__BUILD_TIME__, 'dateTime', zone)` plus a `.build-sha` span. Tokens only.
- Migrated consumers keep their existing components (`Card`, `StatTile`, `TrendChart`, `BarChart`,
  `Badge`, …) and only swap their date formatting for `formatDay`/`formatInstant`. No visual change
  is intended — the rendered strings are byte-identical to the previous hand-rolled ones.
- Light/dark unaffected (no new colors beyond existing tokens).

## Design / implementation notes

**Timezone convention: app-scoped `APP_TIMEZONE`, default `Europe/Warsaw`.**
Why not per-user: there is no timezone column on `users` and no settings surface for one, and this is
a self-hosted single-household deployment; inventing a user-scoped setting would mean a migration, a
settings UI and a per-request lookup for zero benefit today. Why not "the server's zone": the app runs
in a Docker container that is UTC, which is exactly the bug. Why not "the browser's zone": server-side
loaders must resolve "today" before any client code runs. `Config.appTimeZone` is validated at boot
(an unknown IANA name throws) and injected into the handlers; `lib/date.ts` falls back to
`DEFAULT_TIME_ZONE` so client-side components render identically without shipping config to the
browser. **Upgrading to per-user later** = add a `timezone` column, resolve it in `hooks.server.ts`,
and pass it as the existing `timeZone` dep — no call-site changes.

**Ports & adapters.** Handlers take `timeZone?: string` alongside the injected `Clock`; the thin
routes pass `container.config.appTimeZone`. MCP tools gained an optional `ToolContext { clock,
timeZone }` third argument (default: system clock + app timezone), so `insightsForWindow` no longer
reads the system date directly — `entry.ts` passes the container's clock and config.

**SSR safety of the version stamp.** The bundle keeps `__BUILD_TIME__` as a UTC ISO instant. The first
render formats it in the *fixed* app timezone, so server and client emit identical text and hydration
cannot mismatch; a `$effect` (client-only) then re-formats it in the browser's own zone, which only
matters when travelling. `__BUILD_SHA__` comes from `git rev-parse --short HEAD` in `vite.config.ts`,
wrapped in try/catch — a missing `.git` yields `''` and never fails a build.

**Edge cases.** `toDayKey` throws on garbage; `dashboard-data.ts` guards `startTimeLocal` with
`isDayKey` and skips a malformed row rather than blanking the widget. `formatInstant` returns `''`
for an unparseable instant. `formatDay` pins the key to UTC midnight and formats in UTC, so it cannot
drift a day.

## Test plan

- **Unit (`lib/date.test.ts`, 23 tests):** day-key validation incl. `2026-02-30`/leap years; add/
  subtract across month, year and leap boundaries; `daysBetween`/`compare`/`min`/`max`; ISO weekday +
  `startOfWeek`; ranges; instant→day key at 22:30Z in Warsaw (summer *and* winter offsets) and in two
  extreme zones; every Polish month abbreviation matches the old hand-rolled table; instant styles.
- **API integration (mock adapters):** `loadDashboard` asks Garmin for the *local* day and anchors the
  7-day window on it (and honours an injected `UTC`); `loadAnalytics` / `loadInsights` window
  start+end; `loadWidgetData` bucket + metric-window dates and the app-timezone default; a malformed
  `startTimeLocal` is skipped.
- **MCP tools:** `get_insights` start/end with an injected `ToolContext` for Warsaw vs UTC, plus a
  no-context fallback call.
- **Config:** `APP_TIMEZONE` default, override, and rejection of an unknown zone.
- **Component:** `AppShell.svelte.test.ts` — the stamp is localised, has no `UTC` label, keeps the
  exact UTC instant in `datetime=`, and surfaces the commit.
- **Sidecar (pytest):** N/A.

## Closeout

- Commits: <pending — handed to qa-closer>
- Notes / follow-ups: **files still on the old convention** (deliberately out of scope; other agents
  were editing them concurrently). Each should move to `$lib/date`:
  - `lib/server/sync/engine.ts:71–78` — `dayString`/day-delta/day-diff on UTC instants; **the sync
    engine's window boundaries are still UTC**, so a sync started just after local midnight fetches
    one day short. Highest-value follow-up.
  - `modules/training/training.api.ts:76` — `clock.now().toISOString().slice(0, 10)`.
  - `modules/running/running.api.ts:59` — same.
  - `modules/training/TrainingView.svelte:50`, `modules/power/PowerView.svelte:17`,
    `routes/styleguide/+page.svelte:70` — hand-rolled Polish month tables (`MONTHS`/`MONTHS_PL`).
  - `modules/running/RunningView.svelte:27` — `new Date('…T00:00:00Z')` week formatting.
  - `lib/server/analytics/running-profile.ts:68–77`, `lib/server/analytics/training-load.ts:163–168`
    — Monday snapping / day arithmetic via `Date`.
  - `lib/server/store/memory.ts:23–27`, `lib/server/store/pg.ts:67,97–102` — day enumeration.
  - `lib/server/garmin/mock-adapter.ts:15–18` (`eachDate`), `lib/server/garmin/dev-mock.ts:237`
    (`new Date().toISOString()` default day), `lib/server/garmin/http-adapter.ts:342`.
  - `lib/server/integrations/sync.ts:36–41`, `integrations/withings.ts:68,119`,
    `integrations/withings.mock.ts:30–32`.
  - `modules/healthcheck/ConnectionCard.svelte:61` — `new Date(...).toLocaleString('pl-PL')`
    (SSR/browser can disagree).
  - `routes/+page.svelte:25` — `toLocaleTimeString('pl-PL', …)` for the "Zaktualizowano" label.
  - `modules/activity-detail/**` — not audited; owned by another agent during this change.
- Not done here: a per-user timezone setting (see rationale above).
