# Spec 079 — Obciążenie, rekordy i test: ostatnie trzy pozycje z listy trenera

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/mcp/` + `lib/analytics/training-paces.ts`
- **Owner agent:** module-dev
- **Depends on:** 043 (race predictor), 044 (training load), 054 (best efforts), 073 (training blocks)

## Context

The last three items on the coaching feedback, all marked P2 there. Two are pure exposure of numbers
the app already computes; the third is the only one that needs new arithmetic.

1. *"`acuteLoad` jest schowany w `training_readiness`. […] To jest dokładnie ta liczba, która
   14 sierpnia skoczyła 310 → 467; chcę ją widzieć wprost, a nie wyłuskiwać z pola obok."*
   CTL/ATL/TSB and ACWR are computed in `lib/server/analytics/` and drawn on the training page. The
   assistant has never been able to read them.
2. *"`get_personal_bests()` — 5 km / 10 km / HM z historii."* Spec 054 already stores a ranked
   leaderboard; nothing exposes it.
3. *"`mark_as_time_trial(activityId, distanceM)` — auto-przeliczenie temp w bloku."*

**The third one carries a judgement the other two do not.** Turning a race result into training
paces is a coaching model, not a measurement, and quietly overwriting a coach's pace bands with a
formula would be the wrong kind of automation. So this spec derives them from a **named, documented
model** (Riegel to an equivalent 5 km, then conventional offsets), reports the model by name in the
result, and never writes without being asked to: `apply` defaults to false, so the default behaviour
is a proposal a coach can accept, adjust or ignore.

## Requirements (acceptance criteria)

### `get_load_series`

- [x] Returns the CTL/ATL/TSB series over a requested window (default 90 days, capped), plus today's
      values, the band and ACWR with its own band and advice.
- [x] The series is **downsampled** to a stated maximum number of points, and says so — a 365-day
      daily series is 365 rows nobody reads and a context window nobody gets back.
- [x] The **jump** is reported explicitly: the largest day-over-day ATL rise inside the window, with
      its date. That is the number the feedback asked to see directly.
- [x] Under the history floor (`MIN_HISTORY_DAYS`) it says so rather than reporting a confident zero.

### `get_personal_bests`

- [x] Ranked bests per standard distance from spec 054's stored leaderboard, with the day and the
      activity id so the assistant can open the session that set one.
- [x] Filterable by sport family; defaults to running.
- [x] Says plainly when there is no history rather than returning an empty list.

### `mark_as_time_trial`

- [x] Takes `activityId` and `distanceM`, reads the ACTUAL time for that distance from the stored
      best efforts of that activity — not the whole-activity average, which for a 5 km inside a
      longer run is a different number.
- [x] Derives easy / long / threshold / interval / goal bands through `lib/analytics/training-paces.ts`:
      pure, documented, unit-tested, and **named in the output** (`model: "riegel-5k-offsets"`), so a
      coach can see what produced them.
- [x] `apply` defaults to **false**: the tool proposes. With `apply: true` it writes the bands onto
      the block covering that day and reports the before/after.
- [x] Refuses an activity that has no effort at that distance, and says which distances it does have
      — the athlete asked about a 5 km inside a run that never covered 5 km. Read through
      `loadActivityDetail`, which already derives a session's own efforts, rather than adding a
      per-activity getter to the store port: one fact, one source.
- [x] The derived bands are ranges, not points, and the offsets are stated in the module.

### General

- [x] Unit tests pass (no e2e)
- [x] No secrets logged or committed

## API contract

```
get_load_series    { days?, sport? }
  → { from, to, ctl, atl, tsb, band, acwr, acwrBand, advice,
      biggestJump: { day, from, to, delta }, series: [{ day, ctl, atl, tsb }], sampledEvery }

get_personal_bests { sport?, limit? }
  → { count, distances: [{ key, label, best: { durationS, time, pace, day, activityId }, runnersUp }] }

mark_as_time_trial { activityId, distanceM, apply? }
  → { source: { day, distanceM, durationS, time, pace },
      model: 'riegel-5k-offsets', equivalent5kPace,
      paces: { easy, long, threshold, interval, goal },
      applied: boolean, block?: { id, name }, previous?: {...} }
```

## UI

N/A — backend only. The training page already draws the PMC and the leaderboard.

## Design / implementation notes

- `lib/analytics/training-paces.ts` is where the coaching model lives, alone and pure, so it can be
  read and argued with in one file rather than being spread through a tool handler.
- The offsets are conventional (Daniels-style, relative to 5 km race pace) and stated as constants
  with their reasoning. They are **not personalised** — that is the point of naming the model in the
  output rather than presenting the numbers as measurements.
- `get_load_series` reuses `buildTrainingLoad` + `loadRisk`; no new load maths.

## Test plan

- **Unit (paces):** a known 5 km time produces the documented bands; a 10 km input is converted
  through Riegel first; bands stay ordered (interval fastest → long slowest); an absurd input is
  rejected rather than producing a negative pace.
- **MCP:** the series downsamples and says its interval; the biggest jump is found; below the history
  floor it says so; bests report the activity id; `mark_as_time_trial` proposes by default and only
  writes with `apply: true`; a missing effort at that distance lists what does exist.

## Closeout

- Commits: shipped to `main` (see `git log --grep 'spec 079'`).
- One guard was added that the spec did not anticipate. Riegel is fitted over a modest range of
  distances, and a 100 m sprint extrapolated to 5 km produces a pace that looks plausible enough to
  be believed — which is what makes it worth refusing rather than merely flagging. The conversion
  now caps at a 6× ratio, deliberately looser than spec 043's `MAX_EXTRAPOLATION` of 4, because a
  half marathon is 4.2× a 5 km and is an ordinary thing to have raced.
- **This closes the coaching feedback in full.** All six items from the original list are done, plus
  the three that turned out to be already working (treadmill workouts, the `list_workouts` date
  filter, and days-to-race).
