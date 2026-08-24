# Spec 062 — The subjective log and gear: the data Garmin does not have

- **Status:** Draft <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/journal/` + `modules/gear/` + `lib/server/store/` + `lib/mcp/`
- **Owner agent:** module-dev
- **Depends on:** 013 (insights + correlations), 015 (local store), 025 (training section), 060 (goals)

## Context

Every number in OpenVitals comes from a watch. That ceiling is invisible until you look at what the correlation
engine (spec 013) is allowed to correlate: HRV against sleep, body battery against resting HR — device
signals against device signals. The findings athletes actually want are device signals against **how they
felt**: "my HRV drops two days before every illness", "my heavy legs follow the weeks I sleep under seven
hours", "this shoe is where the calf pain started". None of those questions can be asked, because none of
that data exists in the system.

Runalyze treats the subjective log as a first-class dataset (mood, fatigue, injuries, illness, notes) and it
is the single largest thing they have that we do not. Gear is the same shape of gap and a fraction of the
work: shoe and bike mileage is universally wanted, Garmin's own version is poor, and every input it needs is
already in `synced_activities`.

Both are consciously **hand-entered**, which is the trade this spec makes: ten seconds a morning buys a
class of insight no amount of device data can produce. The design constraint that follows is that the entry
has to be genuinely ten seconds, or the data will be sparse and the correlations built on it will lie.

## Requirements (acceptance criteria)

### Journal

- [ ] A `journal_days` table, per-user, one row per local day: `mood`, `fatigue`, `soreness`, `stress`
      (1–5 integer scales), `motivation`, plus free-text `note`, and independent `illness` / `injury` flags
      with an optional body-part label. Every field nullable — a partial entry is a real entry.
- [ ] `LocalStore` gains journal CRUD in both adapters, held to a shared contract test like spec 060's.
- [ ] A **one-screen daily check-in**: five taps and done, reachable from the start page, pre-filled with
      nothing and defaulting to nothing. No field is required and no nag state exists.
- [ ] Back-fill is allowed for any past day (athletes log the week on Sunday), with the day explicit.
- [ ] The insights engine (spec 013) treats journal series as first-class metric series: subjective scores
      join the correlation pairs against HRV, sleep, resting HR, body battery and training load.
- [ ] Correlations involving subjective data carry the **same honesty floor** the existing ones do
      (`MIN_CORR_N`, `MIN_CORR_R`) and are reported with their `n` — a self-reported scale over nine days is
      not a finding, and must not be dressed as one.
- [ ] Illness and injury spans render on the PMC and the volume charts as bands, so a load dip has its
      reason attached rather than looking like laziness.

### Gear

- [ ] A `gear` table: `name`, `kind` (`shoe` | `bike` | `other`), `sport`, `purchased_on`, `retired_on`,
      `initial_distance_m` (gear bought used, or in service before OpenVitals), `alert_distance_m`, `note`.
- [ ] A `gear_activities` link table, so one activity attributes to at most one item of gear per kind.
- [ ] **Default gear per sport family**: new activities in that family attribute automatically, so the
      common case needs no interaction at all. Re-attribution of a past activity is one click.
- [ ] Mileage is computed from `synced_activities`, never stored as a running total — a re-sync or a
      corrected activity must move the number, which a counter would not.
- [ ] A retirement alert at `alert_distance_m` (default 800 km for shoes, off for bikes), shown on the gear
      page and in the start page's attention area.
- [ ] Retired gear keeps its history and drops out of the default-attribution rotation.

### Both

- [ ] MCP: `log_day` / `get_journal` and `list_gear`, so an assistant can both record ("I slept badly and my
      calf is sore") and reason about the result.
- [ ] Consent-gated as `detailed_analytics`, and clearly labelled in the UI as data the athlete typed rather
      than data we synced — the provenance distinction matters most exactly where the two get correlated.
- [ ] Unit + API-integration tests pass (no e2e)
- [ ] Built only from `lib/ui` components + design tokens
- [ ] No secrets logged or committed

## API contract

```
GET    /api/journal?from=&to=      res: { days: JournalDay[] }
PUT    /api/journal/[day]          req: JournalInput      res: { day: JournalDay }   400 → { error }
DELETE /api/journal/[day]                                 res: { deleted: true }

GET    /api/gear                   res: { gear: GearItem[] }   // incl. computed distance + alert state
POST   /api/gear                   req: NewGearInput      res: { gear: GearItem }
PATCH  /api/gear/[id]              req: GearPatch         res: { gear: GearItem }
POST   /api/gear/[id]/retire                              res: { gear: GearItem }
```

## UI

Journal: a compact check-in card (five `SegmentedControl` rows, one note `Input`) on the start page, plus a
`/insights` history strip. Gear: a new `/training/sprzet` tab — `Table` of items with distance, a
`ProgressBar` against the alert threshold, and a `Badge` when it is passed.

States: never-logged (an invitation, not a scold), partially-logged day, back-fill mode, retired gear.

## Design / implementation notes

- **The ten-second rule is the design.** Every field added past the check-in's one screen costs completion
  rate, and a sparse subjective series is worse than none — it makes the correlation engine confident about
  noise. Anything richer belongs in the free-text note.
- **Provenance is not decoration.** Synced and self-reported data must be visually distinguishable
  everywhere they appear together, because a correlation between two self-reported scales is a fact about
  the athlete's mood while typing, not about their body.
- Gear mileage is **derived, never accumulated** — see the acceptance criterion; this is the single most
  common bug in every gear tracker.
- **Edge cases:** a day logged twice (upsert on the day key); an illness spanning a month (a span, not N
  rows); gear attributed to an activity later deleted upstream; an activity in a sport with no default gear;
  gear bought used (`initial_distance_m`).

## Test plan

- **Unit:** journal upsert semantics per day; span derivation from illness flags; gear distance from a set
  of activities including a re-sync that changes one; alert threshold either side; retired gear excluded
  from rotation but not from history.
- **API integration (mock adapters):** each endpoint's success and validation failures; per-user isolation
  on every read and write; consent off → disabled payload.
- **Insights:** a subjective series below the correlation floor is reported as no finding, not a weak one.

## Closeout

- Commits:
- Notes / follow-ups:
