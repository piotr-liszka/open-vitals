# Spec 054 — All-time best efforts (cross-activity leaderboard)

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/best-efforts/` (+ `lib/server/sync/best-efforts.ts`, `lib/server/store/*`)
- **Owner agent:** module-dev
- **Depends on:** 015 (local store + sync engine), 018 (running page), 023 (stored streams), 040 (`bestEfforts()` engine)

## Context

Spec 040 finds the fastest 1 km / 5 km / … **inside one activity** and shows it on that activity's page.
Nothing ranks those efforts against each other, so the athlete cannot see "my fastest 5 km ever, and the
two behind it" — the Strava *Best Efforts* card. The running page does carry a "Rekordy życiowe" list,
but it is built from `personalBests()`, which **projects at even pace over a whole run**: a 15 km run's
"5 km record" is `duration × (5/15)`. That is not a record, it is arithmetic — a hard 5 km buried in a
long run is invisible and a steady long run invents a PR it never ran.

Spec 040's own closeout names the fix: "a stored per-activity efforts table populated at sync time, not a
page-load computation". This spec builds that table, populates it during sync, backfills already-synced
history, and replaces the projection card with a real all-time leaderboard.

## Requirements (acceptance criteria)

- [x] A `synced_activity_best_efforts` table stores one row per (user, activity, distance key) with the
      effort's duration, measured distance, pace, in-activity start offset, sample count, plus the
      activity's sport and **local start day**. Created through the existing `migrate()` statement list in
      `lib/server/db/index.ts` (idempotent `CREATE TABLE IF NOT EXISTS`), not a new migration system.
- [x] The table is indexed for the leaderboard read: "fastest N for a user + distance key".
- [x] Efforts are derived at **sync time** from the streams already stored, reusing `bestEfforts()`
      unchanged, for **pace sports** only (`run` + `walk` families).
- [x] Writing efforts for an activity is **idempotent**: re-syncing replaces that activity's rows rather
      than appending, and a repeated sync tick produces byte-identical rows.
- [x] Already-synced activities are backfilled by a **bounded, resumable** pass driven by the existing
      sync tick: capped work per run, progress recorded per activity (never one giant transaction),
      counted in the run detail and logged through the injected logger.
- [x] The backfill also runs on a tick whose upstream probe found **nothing changed** — it is local-only
      work (no Garmin calls), so a quiet account still finishes its backfill.
- [x] Re-fetching an activity's streams invalidates its stored efforts, so a repaired stream re-derives.
- [x] `LocalStore` gains read/write ports for efforts, implemented in **both** the pg adapter and the
      in-memory fake with identical semantics.
- [x] The leaderboard read returns the top **N = 3** efforts per distance key, fastest first, each joined
      to its activity (id, name, sport, local day) so a row can link to it.
- [x] Every effort query is scoped to the authenticated `userId`; one user can never see another's
      efforts (asserted by a test).
- [x] A `modules/best-efforts/` slice exposes the leaderboard through a pure handler
      (`loadBestEfforts(deps, request)`) over injected deps, with the ranking logic pure and unit-tested.
- [x] `/training/bieg` renders a Best Efforts card: one section per distance the athlete actually has,
      rows ranked 1..3, rank 1 visually distinct and labelled `PR`, lower ranks dimmer; each row shows the
      local date and the time and links to its activity.
- [x] The projection-based "Rekordy życiowe" card is **removed** from `/training/bieg`.
- [x] The rank/medal indicator is a shared `lib/ui` component (`RankMedal`), not bespoke markup.
- [x] Polish copy; dates via `$lib/date` helpers (never a raw `Date` in view or handler).
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new HTTP endpoint — the running page loader calls the module handler directly, like every other
training page. Contracts live in `modules/best-efforts/best-efforts.types.ts`:

```ts
loadBestEfforts(
  deps: { store: BestEffortsStore },              // LocalStore port, injected
  req:  { userId: string; group?: SportGroup; topN?: number }
): Promise<BestEffortsData>

BestEffortsData = {
  distances: BestEffortDistance[];   // only distances with at least one effort, shortest first
  topN: number;                      // 3
  hasData: boolean;
}
BestEffortDistance = { key, label, metres, entries: BestEffortEntry[] }
BestEffortEntry   = { rank, activityId, activityName, sport, day, durationS, paceSecPerKm, actualM }
```

Store port (`lib/server/store/types.ts`):

```ts
putActivityBestEfforts(userId, input: ActivityBestEfforts): Promise<void>;   // replace + stamp version
listBestEffortVersions(userId): Promise<Map<string, number>>;               // activityId → stamped version
listTopBestEfforts(userId, { limit, sports? }): Promise<RankedBestEffort[]>;
```

## UI

`BestEffortsCard.svelte` built from `Card` + the new `lib/ui/RankMedal` + tokens. One section per
distance inside a responsive grid; each row is an `<a>` to `/activities/<id>` carrying the medal, the
time, the pace and the local date. Rank 1 is emphasised (gold tone, `PR` label, bold time), ranks 2–3 are
muted. States: empty (nothing synced / nothing derived yet) explains where efforts come from; light and
dark both come from tokens; the rows are links so focus states and keyboard traversal are free.

## Design / implementation notes

- **Ports & adapters.** The handler takes only the store port; the sync work takes `LocalStore` + the
  injected `Logger`. No `fetch`, `Date.now()`, `process.env` anywhere in the slice.
- **Derivation** lives in `lib/server/sync/best-efforts.ts`: `deriveBestEfforts(streams)` builds the time
  and distance axes with the same helpers the charts use and calls `bestEfforts()` — whose signature is
  untouched. Those two helpers (`elapsedSeconds`, `cumulativeDistance`, plus `streamLength`) moved from
  `modules/activity-detail/activity-charts.ts` into `lib/analytics/stream-axes.ts` so `lib/server` can use
  them without reaching into another module (AGENTS.md §5); the old module re-exports them, so nothing
  else changed.
- **Freshness marker.** `synced_activity_streams` gains an `efforts_v` column: the version of the
  derivation that produced the stored efforts for that activity (`NULL`/0 = never derived). This mirrors
  `STREAMS_SCHEMA_VERSION` exactly — the sync re-derives anything stamped lower, so changing
  `EFFORT_DISTANCES` is a version bump rather than a manual re-sync. Writing streams resets it to `NULL`,
  which is what makes a repaired stream re-derive. Keeping the marker on the stream row (rather than a
  sentinel effort row) also means an activity that legitimately yields **no** efforts is marked done and
  never retried.
- **Backfill shape.** Candidates = pace-sport activities that *have* a stream row stamped below the
  current version, newest first. Each is one `getStreams` + one `putActivityBestEfforts`, capped per run
  (`effortsPerRun`, default 200 full / 60 incremental) — so a multi-thousand-activity history drains over
  successive ticks instead of one enormous transaction. It runs inside the `streams` phase (efforts are
  derived from streams; a separate `SyncPhase` would have meant a new /dane filter for the same work) and
  reports `efforts` / `effortsPending` in the run detail. `syncIfChanged` runs a smaller local-only pass
  before its "nothing changed" fast-return, so the backfill still finishes on a quiet account.
- **Ranking honesty.** An activity contributes at most one effort per distance (that is what
  `bestEfforts()` returns), so the leaderboard cannot be three splits of one workout. Ties on duration are
  broken by the **earlier** day: the record belongs to whoever set it first.
- **Sport scope: run + walk are derived and stored; only `run` is surfaced.** Best efforts are a
  pace-over-distance idea, so a ride's "fastest 1 km" is a descent, not a result — rides are excluded, as
  in spec 040. Walking efforts are stored because the derivation is free once the streams are read and the
  version marker makes a later `/training/marsz` card a UI change rather than a re-derivation; this spec
  ships the card on `/training/bieg` only.
- **`personalBests()` stays.** It is not dead: `runner-profile.ts` (spec 033) and the race predictor
  (spec 043) both consume it. Only its *card* is removed, and `RunningData.bests` with it — the
  projections now feed predictions/the radar and are never shown as records.
- Derived data is deliberately **not** added to the coverage/storage byte report: it is recomputable from
  streams and would make "how much of my data is stored" read as growth in synced data.

## Test plan

- **Unit (`best-efforts.rank.test.ts`):** grouping by distance in ascending order; fastest first; rank
  numbering from 1; the `topN` cap; ties broken by the earlier day; unknown distance keys ignored;
  distances with no efforts absent.
- **Unit (`sync/best-efforts.test.ts`):** derivation from a synthetic speed stream finds the buried fast
  window; a ride/strength activity yields nothing; the backfill is capped by its budget, resumes where it
  stopped on the next call, is a no-op once everything is stamped, and re-running it twice leaves exactly
  the same rows (idempotency); a re-fetched stream re-derives.
- **API integration (`best-efforts.api.test.ts`, mock adapters):** the handler over the in-memory store
  returns the documented JSON contract; only the run family; empty history → `hasData: false`; **per-user
  isolation** — user B's efforts never appear for user A.
- **Store contract (`best-efforts-contract` cases inside the memory store test):** put → read-back,
  replace-on-rewrite, version stamping and reset-on-`putStreams`.
- **UI (`BestEffortsCard.svelte.test.ts`, `RankMedal.svelte.test.ts`):** the empty state; a section per
  distance; the `PR` label on rank 1 and the dimmed lower ranks; the link target; the medal tone per rank.

## Closeout

- Commits: <hashes/links>
- Verify: `pnpm run verify` green (135 test files / 1625 tests, `svelte-check` 0 errors, prettier clean,
  production build + MCP bundle OK).
- Notes / follow-ups:
  - **The pg SQL is contract-tested but not executed here.** `store/best-efforts-contract.test.ts` runs the
    same suite against both adapters, but the Postgres half only runs with `TEST_DATABASE_URL` set, and no
    Postgres was available in this environment — so the window-function ranking query and the
    replace-in-a-transaction write have been reviewed, not run. Worth one pass against a scratch database
    before deploying.
  - **The race predictor and the runner archetype still eat `personalBests()` projections.** Feeding them
    the real stored efforts instead would be a strict improvement, and is now cheap — but it changes two
    other specs' numbers (033, 043) and would make both go quiet until a user's backfill completes, so it
    is deliberately a separate change.
  - **Walking efforts are stored but not surfaced.** `/training/marsz` can render the same card by calling
    `loadBestEfforts(..., { group: 'walk' })`; no re-derivation needed.
  - Efforts inherit the raw stream, so a GPS/speed spike can inflate one — the same caveat spec 040 left
    open. Spec 036's suspect flags cover the same sessions and the two still do not talk to each other.
  - Derived rows are not counted in the coverage/storage report (see the design notes).
