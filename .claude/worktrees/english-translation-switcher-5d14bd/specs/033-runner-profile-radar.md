# Spec 033 — Profil biegacza: pięcioramienny radar "jakim biegaczem jesteś"

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/running/` (+ `lib/ui/RadarChart.svelte`, `lib/server/analytics/runner-profile.ts`)
- **Owner agent:** ui-designer + module-dev
- **Depends on:** 001 (design system), 015 (local store), 018 (running analytics / dates), 020 (sport labels), 025 (multi-sport training)

## Context

The cycling page has the one widget the athlete keeps coming back to: the **rider-type pentagon**
(`PowerView`, PWRX §5) — five spokes, one glance, "this is the kind of rider you are". Running has
none. `/training/bieg` answers "how much did I run and how fast" (totals, PR table, weekly mileage,
HR split) but never "**what kind of runner am I, and where am I strong**".

This spec gives running the same instrument, built on the data we actually hold locally (activity
summaries — no power meter, no streams required), and extracts the pentagon into a **shared
`lib/ui/RadarChart`** so the cycling radar and this one are literally the same component (AGENTS.md
§6: a new visual pattern becomes a `lib/ui` component, never a second inline copy).

Honesty rules the design. An axis we cannot compute is **`null` — "brak danych"** — not a zero: a
runner who has never run 10 km is not a runner with 10 km endurance of 0. The reference scale is
stated on the card, and the two time bases are labelled (pace axes = rekordy życiowe, objętość /
regularność = ostatnie 12 tygodni) rather than silently blended.

## Requirements (acceptance criteria)

- [x] New shared `lib/ui/RadarChart.svelte`: N spokes (default 5), `value: number | null` in `0..1`
      per axis, rings, spoke lines, wrapped outside labels, data polygon + vertex dots.
- [x] `RadarChart` degrades honestly: `null` axes are excluded from the polygon and marked on the
      spoke; with fewer than 3 defined axes it draws the frame and no polygon (never a misleading
      sliver).
- [x] `PowerView`'s inline pentagon is **replaced** by `RadarChart` — one radar implementation in the
      repo, cycling normalisation (W/kg vs Coggan reference) stays in the power module.
- [x] New pure engine `lib/server/analytics/runner-profile.ts` computing five axes from
      `RunSummary[]`: **Szybkość** (best 1 km), **Tempo** (best 5 km), **Wytrzymałość** (longest
      standard distance with data: 10 km → półmaraton → maraton), **Objętość** (avg km/week),
      **Regularność** (active-week share + runs/week).
- [x] Pace axes are normalised against a **documented reference scale** (`rekreacyjny → wyczynowy`)
      declared as one exported table, so re-tuning a scale is a one-line change.
- [x] Volume / consistency use a trailing window bounded by the athlete's own history: under 3 weeks
      of running history both are `null`, never a flattering or punishing zero.
- [x] A deterministic **archetype** falls out of the axis vector (`speedster` / `diesel` / `grinder` /
      `allrounder` / `beginner` / `unknown`) with a Polish one-line explanation, plus the strongest
      and weakest defined axis. Same input ⇒ same archetype, always (pure, no clock beyond `today`).
- [x] `unknown` is a real state: fewer than 3 defined axes ⇒ we say we cannot name the type yet
      instead of guessing one.
- [x] `RunnerProfileCard` renders on `/training/bieg` under the totals tiles and above the PR table:
      radar, archetype headline, per-axis readouts with their basis (`4:08 /km` + `najlepsze 1 km`),
      and the scale note.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new HTTP endpoint — the profile rides on the existing `/training/bieg` server load.

```
lib/server/analytics/runner-profile.ts   (pure)
  RUNNER_AXES: readonly RunnerAxisDef[]                     // key, label, hint
  PACE_SCALE:  Record<string, {slow: number, fast: number}>  // sec/km anchors per distance key
  runnerProfile(runs: readonly RunSummary[], opts: { today: DayKey, weeks?: 12 }) -> RunnerProfile

  RunnerProfile {
    axes: RunnerAxis[]            // 5, in RUNNER_AXES order
    archetype: { key, label, summary }
    strength:  RunnerAxisKey | null
    weakness:  RunnerAxisKey | null
    window:    { weeks: number, km: number, runs: number, activeWeeks: number }
    hasProfile: boolean           // >= 1 defined axis
  }
  RunnerAxis {
    key, label
    score:   number | null        // 0..1, null = brak danych
    readout: string | null        // pre-formatted, e.g. "3:58 /km"
    basis:   string               // what it was computed from, e.g. "najlepsze 1 km"
    day:     DayKey | null        // when the underlying best was set (pace axes)
  }

modules/running/running.types.ts
  RunningData.profile: RunnerProfile
```

## UI

- `Card`, `Badge`, `RadarChart` (new), design tokens only. Radar accent `--lane-orange` (the running
  lane, consistent with the mileage chart).
- Layout: two columns (radar | axis list) collapsing to one under 60rem.
- States: no runs at all → the existing `/training/bieg` empty card (unchanged); runs but < 3 defined
  axes → radar frame + "Za mało danych, by nazwać typ" + the axes we do have; full profile → polygon
  + archetype + strength/weakness badges.
- Light + dark via tokens; the polygon uses `color-mix` on the lane colour so both themes hold.

## Design / implementation notes

- The engine composes the spec-018 primitives (`personalBests`, `weeklyMileage`) instead of
  re-deriving bests — one definition of "personal best" in the app.
- Pace axes are all-time (that is what a profile is), volume/consistency are a trailing window; the
  card labels both so the mix is visible rather than implied.
- Reference anchors (sec/km): 1 km 450→155, 5 km 480→165, 10 km 510→170, półmaraton 540→180,
  maraton 570→190. Volume: 0→80 km/week. Consistency: `0.6·activeWeekShare + 0.4·min(1, runs/wk ÷ 4)`.
  These are heuristics for *shape*, not a fitness test — the card says so.
- No new store read: `loadRunning` already lists every run; the profile is computed from that array.
- `RadarChart` takes pre-normalised `0..1` values — no domain knowledge (watts, paces) in `lib/ui`.

## Test plan

- **Unit (`runner-profile.test.ts`):** each axis from a fixture set; a missing distance ⇒ `null` (not
  0); < 3 weeks history ⇒ volume/consistency `null`; each archetype branch hit by a crafted vector;
  `unknown` under 3 defined axes; scores clamped to `0..1`; determinism (same input twice).
- **Unit (`RadarChart.svelte.test.ts`, jsdom):** renders N spokes and labels; polygon skips `null`
  axes; no polygon under 3 defined axes; `aria-label` present.
- **API integration (`running.api.test.ts`, mock store):** `loadRunning` returns a `profile` whose
  axes match the fixture runs, and a profile with `hasProfile: false` for an empty store.
- **Component (`RunnerProfileCard.svelte.test.ts`, jsdom):** archetype headline, per-axis readouts,
  "brak danych" for a `null` axis, and the scale note.

## Closeout

- Commits: `f2d66b4` — feat: timeline pion/poziom + profil biegacza (specs 032-033)
- Notes / follow-ups:
  - The same engine shape fits marsz (walking) and — with stream data — a running-dynamics axis
    (kadencja / GCT / długość kroku, spec 023 streams). Not in this spec.
  - `RadarChart` reserves `labelSpace: 96` by default because a 12-character uppercase Polish label
    ("WYTRZYMAŁOŚĆ", "REGULARNOŚĆ") is clipped at the box edge with less.
  - The reference anchors are the one number set worth revisiting once there is more of the user's own
    history to calibrate against; they live in `PACE_SCALE` / `VOLUME_TARGET_KM` /
    `RUNS_PER_WEEK_TARGET` so a change is one line.
