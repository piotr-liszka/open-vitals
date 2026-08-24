# Spec 062 — Dziennik subiektywny: to, czego zegarek nie wie

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/journal/` + `lib/server/store/` + `lib/mcp/`
- **Owner agent:** module-dev
- **Depends on:** 013 (insights + correlations), 015 (local store), 025 (training section), 073 (training blocks)

> **Rewritten 2026-08-16.** The first draft bundled the journal with gear tracking and scored
> everything 1–5. Coaching feedback moved both: gear is now **spec 074** (one feature per spec), and
> the scales are **1–10**, because RPE is a 1–10 measure by definition and a coach comparing "should
> have been 7, was 9" cannot do it on a five-point scale. The draft also had no way to attach a score
> to a *session* — only to a day — which is exactly the comparison the feedback asks for.

## Context

Every number in OpenVitals comes from a watch. That ceiling is invisible until you look at what the
correlation engine (spec 013) is allowed to correlate: HRV against sleep, body battery against
resting HR — device signals against device signals.

Coaching feedback, August 2026: *"Garmin nie wie, że boli kolano. Przy Twojej historii kolan i
kręgosłupa to jest najważniejszy pojedynczy sygnał w całym planie, a jest go zero w danych."* And the
sentence that sets the shape: *"RPE 9 na treningu progowym, który miał być RPE 7, mówi mi więcej niż
[tętno]"* — a threshold session that felt like nine when it was written as seven is a signal that
arrives two weeks before the injury does.

That comparison needs the score attached to the **session**, not just the day. So this spec stores
both: a day row for how the body is (soreness, mood, where it hurts) and, optionally, a row per
activity for how that session felt (RPE). One table, one call, one nullable `activity_id`.

The data is consciously **hand-entered**, which is the trade: ten seconds a day buys a class of
insight no amount of device data can produce. The constraint that follows is that entry has to
genuinely take ten seconds, or the series will be sparse and the correlations built on it will lie.

## Requirements (acceptance criteria)

### Store

- [x] A `journal_entries` table, per-user: `day`, nullable `activity_id`, `rpe` (1–10), `soreness`
      (1–10), `location` (free text — "lewe kolano"), `mood` (1–10), `note`, and independent
      `illness` / `injury` flags. Every score nullable: a partial entry is a real entry.
- [x] `(user_id, day, activity_id)` is unique **with nulls treated as equal**, so a day has exactly
      one day-level row and at most one row per activity. Logging the same day twice upserts.
- [x] Scores are stored as integers 1–10 and validated at the boundary; 0 and 11 are rejected, not
      clamped — a clamp hides a typo in a number a coach will act on.
- [x] `LocalStore` gains journal CRUD in both adapters, held to a shared contract test, and that
      contract is run against a real Postgres before the spec closes (see spec 073's closeout).
- [x] A `recentSoreness(userId, from, to)` read, so other modules can ask "has anything hurt lately"
      without loading the whole journal.

### Behaviour

- [x] Back-fill is allowed for any past day — athletes log the week on Sunday — with the day explicit.
      Future days are rejected: a journal is a record, not a plan.
- [x] An entry may name an `activityId` only if that activity is this user's and falls on that day;
      otherwise the write is refused with a message saying which of the two is wrong.
- [x] `get_current_week` (spec 073) reports a **soreness flag** when any entry in the last 7 days has
      `soreness >= 4`, with the day, the score and the location — the coach's cut-the-volume trigger,
      surfaced where the week is read rather than waiting to be asked for.

### MCP

- [x] `log_note(date, { rpe?, soreness?, location?, mood?, note?, illness?, injury?, activityId? })`
      and `get_notes(start, end)`, registered behind one optional deps object like the block tools.
- [x] `log_note` upserts, and its result says plainly what it wrote and what it left alone, so an
      assistant never has to guess whether a partial write cleared the rest.
- [x] Server `instructions` state that RPE belongs to a session and soreness to a day, and that a
      session RPE well above what the plan asked for is a reason to look at the week, not a datum to
      file — the reason this data is collected at all.

### UI

- [x] A one-screen daily check-in reachable from the start page: soreness, mood, a note, and the two
      flags. No field is required, nothing is pre-filled, and there is no nag state.
- [x] Per-session RPE is logged from the activity detail page, next to the session it describes.
- [x] Self-reported data is visually distinguishable from synced data everywhere the two appear
      together — provenance matters most exactly where they get correlated.

### General

- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## Deliberately NOT in this spec

- **Correlating journal series against HRV/sleep/load** (the first draft's promise). The correlation
  engine has honesty rules of its own — `MIN_CORR_N`, `MIN_CORR_R`, reporting `n` — and wiring a
  self-reported series into it is a decision about those rules, not about this table. A separate
  spec, once there is enough logged data for the question to be answerable at all.
- **Illness/injury bands on the PMC and volume charts.** Wants a span model (an illness is not N day
  rows), which is its own piece of work.
- **Gear** — now spec 074.

## API contract

Types in `modules/journal/journal.types.ts`.

```
GET    /api/journal?from=&to=   res: { entries: JournalEntry[] }
PUT    /api/journal             req: JournalInput   res: { entry }   errors: 400 validation
DELETE /api/journal/[id]                            res: { deleted } errors: 404

log_note   { date, rpe?, soreness?, location?, mood?, note?, illness?, injury?, activityId? }
           → { written, fields: [...], entry }
get_notes  { start, end } → { count, entries: [...], sorenessFlag? }
```

## UI

Check-in card on the start page from `lib/ui` (`Card`, `SegmentedControl`, `Input`, `Toggle`), and an
RPE row on the activity detail page. States: never logged (an invitation, not a scold), partially
logged, back-fill.

## Design / implementation notes

- **The ten-second rule is the design.** Every field past one screen costs completion rate, and a
  sparse subjective series is worse than none: it makes the correlation engine confident about noise.
  Anything richer belongs in the free-text note.
- 1–10 everywhere rather than a mix. The first draft's 1–5 could not carry RPE, and two scales in one
  form is how a 7 gets entered on the wrong one.
- Nulls-not-distinct uniqueness needs Postgres 15+; the project runs 16. The memory adapter mirrors it
  by keying on `day\0activityId ?? ''`.
- **Edge cases:** the same day logged twice (upsert); an RPE for an activity the sync later removes
  (the entry outlives it, like a goal outlives its imported event in spec 060); a day entry and a
  session entry on the same day (both legal, different rows).

## Test plan

- **Unit:** score-range validation either side of 1 and 10; future-day rejection; activity/day
  mismatch; soreness-flag threshold at 3, 4 and across the 7-day edge.
- **Contract (both adapters, incl. real Postgres):** upsert per (day, activity), per-user isolation,
  range reads, `recentSoreness`.
- **API integration (mock adapters):** each endpoint's success and validation failures.
- **MCP:** `log_note` partial writes report what they touched; `get_notes` over an empty range says so.
- **Spec 073:** `get_current_week` carries the soreness flag when one is due and omits it otherwise.

## Closeout

- Commits: shipped to `main` (see `git log --grep 'spec 062'`).
- Verified against a real Postgres as well as the fake. The `NULLS NOT DISTINCT` upsert key is the
  reason that mattered: under the default `NULLS DISTINCT` every day-level check-in would have
  inserted a second row rather than correcting the first, and the JavaScript fake compares
  differently and would never have shown it.
- One design change fell out of the wiring: `JournalDeps` split into read and write halves. The start
  page loads the journal, and spec 021's loader test fails if that page touches any container service
  beyond clock/config/store — the guard that keeps the MCP token out of the page payload. A read path
  that demanded an id generator would have forced that guard open, so reads no longer take a `Random`.
- Notes / follow-ups: correlating journal series against HRV/sleep/load, and illness/injury bands on
  the charts, remain out of scope — see "Deliberately NOT in this spec".
