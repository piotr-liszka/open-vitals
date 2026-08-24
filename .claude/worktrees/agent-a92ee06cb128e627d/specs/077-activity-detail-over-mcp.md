# Spec 077 — Okrążenia dla asystenta: co było w środku treningu

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/mcp/` (thin read-only reuse of `activity-detail.api.ts`)
- **Owner agent:** module-dev
- **Depends on:** 023 (streams + laps), 026 (activity detail), 040 (in-session best efforts), 045 (pacing), 073 (blocks), 062 (journal)

> **Renumbered from 075.** Two sessions picked 075 the same afternoon; the recovery-timer spec landed
> on `main` first, so this one moved. Nothing about its scope changed.

## Context

Coaching feedback, August 2026: *"Największa dziura merytoryczna. Dziś dostaję wyłącznie agregaty
całego biegu. Twój trening z 13 sierpnia nazywa się „VO2 Max", a ja widzę tylko: 7.27 km, 5:41/km,
HR 144. Nie mam pojęcia, co się działo w środku."*

Nothing is missing from the database. `synced_activity_streams` has held per-lap distance, duration,
heart rate, cadence, stride length and ground contact time since spec 023, and the activity page
renders all of it. The MCP surface simply never exposed any of it, so an assistant asked to judge a
threshold session sees the same three numbers whether the athlete ran 5×800 or jogged for 40 minutes.

Three fields carry more weight than the rest, and each changes the reading of a session on its own:

- **cadence** — the coach prescribed 175–180 spm to protect the knees, and there is currently no way
  to check where the athlete actually is.
- **temperature** — 5:26/km at 30 °C is a different run from the same pace at 8 °C. Without it, a
  whole hot August reads as a loss of form.
- **stride length** — with a knee history, overstriding is an early warning, and it is invisible in
  any pace average.

This spec adds **no new maths**. It is an exposure layer over `loadActivityDetail`, which already
computes everything here, projected into a shape a model reads rather than a shape a chart draws.

## Requirements (acceptance criteria)

- [x] `get_activity_detail(activityId)` in a new `lib/mcp/activity-tools.ts`, registered behind one
      optional deps object like the block and journal tools.
- [x] It **reuses `loadActivityDetail`** rather than re-querying the store. A field it cannot get from
      there is a reason to extend that handler, not to fork the query (spec 061's rule).
- [x] `laps[]` per lap: `index`, `distanceM`, `durationS`, `avgPace` (seconds per km, pre-computed),
      `avgHr`, `maxHr`, `avgCadence`, `avgStrideLengthCm`.
- [x] Session-level running dynamics alongside: `avgCadenceSpm`, `avgStrideLengthCm`,
      `avgGroundContactTimeMs`, `avgVerticalOscillationCm`, and `temperatureC`.
- [x] `typedSplits[]` — Garmin's own work/rest classification — when present, because it answers
      "was this an interval session" without the model inferring it from lap lengths.
- [x] **Laps are capped** at a stated number, with the count of what was dropped reported. A 200-lap
      swim must not blow the context window silently.
- [x] Any subjective entry logged for the session (spec 062) rides along, so the RPE and the lap
      splits arrive together rather than needing a second call to be compared.
- [x] `list_activities(from?, to?, sport?, limit?)` so an assistant can FIND the id to ask about.
      Without it, `get_activity_detail` is only reachable if the id is already known.
- [x] Numbers are pre-rounded and paces pre-converted: a model should never divide to read one aloud.
- [x] An activity with no laps says so, rather than returning an empty array that reads as "no data".
- [x] Unit tests pass (no e2e)
- [x] No secrets logged or committed

## Deliberately NOT in this spec

The rest of spec 061's surface — `get_training_load`, `get_race_predictions`, `get_power_profile`,
`get_best_efforts`, `get_volume`, `get_weekly_summary`. They are real, and two of them are on the
coach's P2 list, but they are separate exposures with their own shaping decisions. This spec is the
one the coach called the biggest gap. **Spec 061 keeps the rest**; its `get_activity` bullet is
struck and points here.

## API contract

```
get_activity_detail { activityId }
  → { activity: { id, day, sport, name, distanceM, durationS, avgPace, avgHr, maxHr },
      dynamics: { avgCadenceSpm, avgStrideLengthCm, avgGroundContactTimeMs,
                  avgVerticalOscillationCm, temperatureC },
      laps: [{ index, distanceM, durationS, avgPace, avgHr, maxHr, avgCadence, avgStrideLengthCm }],
      lapsTruncated?: number,
      typedSplits?: [...],
      subjective?: { rpe?, note? },
      verdict?: string }

list_activities { from?, to?, sport?, limit? }
  → { count, activities: [{ id, day, sport, name, distanceM, durationS, avgPace, avgHr }] }
```

## UI

N/A — backend only. The web already renders all of this (`ActivityLapsPanel`, `StatSections`).

## Design / implementation notes

- Ports & adapters: the tool takes the same injected deps `loadActivityDetail` does (store +
  settings), plus the resolved `userId` from the MCP token — never from an argument.
- The lap cap is the one place this spec can lie by omission, which is why the dropped count is a
  named acceptance criterion rather than an implementation detail.
- `avgPace` is derived from lap distance and duration rather than read from `avgSpeedMps`, so a lap
  with a speed field but no distance does not produce a confident-looking wrong number.

## Test plan

- **Unit (mock store):** a session with laps returns them in order with paces converted; a session
  with none says so; the cap truncates and reports the count; running dynamics and temperature are
  carried; an unknown id errors; a subjective entry is attached when one exists.
- **MCP:** `list_activities` honours its filters and reports its count.

## Closeout

- Commits: shipped to `main` (see `git log --grep 'spec 077'`).
- Spec 061's `get_activity` / `list_activities` bullet is struck and points here; the other six
  exposures in that spec are untouched and still open.
- Notes / follow-ups: two of those six are on the coach's P2 list — `get_load_series` (CTL/ATL/ACWR,
  already computed in `lib/server/analytics/load-risk.ts`) and `get_personal_bests` (spec 054's
  stored leaderboard). Both are exposure-only, like this one was.
