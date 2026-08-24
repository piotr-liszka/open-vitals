# Spec 082 — Notatka jedzie z treningiem: opis i skąd to się wzięło

- **Status:** Approved — implemented, NOT closed <!-- Draft → Approved → Closed -->
- **Module:** `services/garmin/app/workouts.py` + `lib/server/sync/engine.ts` + `lib/server/garmin/` + `modules/workouts/`
- **Owner agent:** garmin-integrator
- **Depends on:** 050 (authored workouts + push), 066 (planner/editor), 071 (feature switches)

## Context

Question from the athlete, August 2026: *"czy możemy w jakiś łatwy sposób po stronie Garmina dodać
jakieś info skąd pochodzi trening (np. suffix)?"* — standing in front of a session in Garmin Connect
and not knowing whether it came from here or from Garmin's own plan.

Two things came out of looking at the push path. First, `build_workout_payload` sends exactly three
fields — `sportType`, `workoutName`, `workoutSegments`
([workouts.py:137](../services/garmin/app/workouts.py)) — and `description` is only ever set on an
individual **step** ([workouts.py:224](../services/garmin/app/workouts.py)). Second, and unplanned:
the workout-level `note` the athlete writes in the editor is stored, rendered locally, and **never
sent anywhere**. Half of this spec is closing that gap; the provenance line then rides along in the
field that gap opens.

The suffix-in-the-title version was considered and rejected. A marker in `workoutName` shows on the
watch's workout list, in the calendar and on the start notification, and eats a name budget the
sidecar already caps at 80 characters — a loud answer to a question that is only ever asked while
reading Garmin Connect on a laptop.

**This is explicitly not a matching mechanism.** Nothing here reaches the completed activity; the
activity is linked to its plan by Garmin's own `workoutId` (spec 081). This spec is for the human.

## Requirements (acceptance criteria)

### Confirm the field first

- [ ] Confirmed by one real push that Garmin's workout DTO accepts a **top-level** `description` and
      shows it in Connect. Step-level `description` is known to work; the workout level is not
      verified. If Garmin drops it silently, the spec is withdrawn — a suffix in the title is not the
      fallback.

### Send it (sidecar)

- [x] `WorkoutCreateRequest` gains `note: str | None`, capped by `Field(max_length=1024)`.
- [x] `build_workout_payload` takes the note and, when non-empty after stripping, sets `description`
      on the top-level workout DTO. Empty or absent → the key is **omitted**, not sent as `""`.
- [x] Step-level descriptions are untouched. The two live at different levels and neither overwrites
      the other.

### Compose it (web tier)

- [x] The push phase passes `note` in `GarminWorkoutInput`; the HTTP adapter puts it in the POST body.
- [x] The provenance line is composed **in the web tier, not the sidecar** — it is content, and the
      sidecar's job is Garmin's DTO dialect, nothing else. The sidecar stays a dumb translator that
      can be tested without knowing what OpenVitals is.
- [x] The pushed description is the athlete's note, then a blank line, then a single provenance line.
      A session with no note sends the provenance line alone.
- [x] The provenance line is one short constant — not localised, not templated with dates. It is read
      by a human glancing at Connect to answer one question ("mine or Garmin's?"), and a sentence that
      changes with the UI language is a sentence that stops being recognisable.
- [x] Composed length is capped below the sidecar's limit; an over-long note is **truncated with an
      ellipsis, and the provenance line still survives**. A 422 from Garmin because someone wrote a
      long note would turn a nicety into a failed push.

### Say that it leaves (UI)

- [x] The editor's note field states that the note is sent to Garmin. Today it does not leave this
      machine and after this spec it does — the athlete writes notes to themselves and deserves to
      know the audience changed before they type, not after.
- [x] Built only from `lib/ui` components + design tokens; light + dark.

### General

- [x] Unit + API-integration tests pass (no e2e)
- [x] No secrets logged or committed — the note is athlete content and stays out of log lines, as
      `_write` already ensures for the payload

## API contract

```
POST /workouts (sidecar)   req: { sport, title, steps, note?: string|null }
                           res: unchanged — { supported, workoutId } | { supported: false, reason }
                           errors: 422 InvalidWorkout (unchanged), 403 internal key, 401 not authenticated
```

`GarminWorkoutInput` gains `readonly note: string | null`. No web-facing endpoint or MCP tool changes
shape: `create_workout` already takes a note, it simply had nowhere to send it.

## UI

`WorkoutEditor.svelte` only. The note field's helper text gains the fact that it travels to Garmin.
No new component, no new state — the editor's loading/error/success behaviour is unchanged.

## Design / implementation notes

- **Known limitation, and it caps what this spec is worth.** Editing a pushed session sets
  `pushState: 'pending'` intending a re-push, but the engine's idempotency guard skips `createWorkout`
  whenever `garminWorkoutId` is already set and re-runs only the schedule
  ([engine.ts:587](../apps/web/src/lib/server/sync/engine.ts)) — so an edited note (like an edited
  interval today) never reaches Garmin. The description is therefore correct **as first pushed** and
  stale after any edit. Fixing re-push is a separate spec; this one must not paper over it by
  deleting and recreating the upstream workout, which would break the id spec 081 matches on.
- Ports & adapters unchanged: one optional field added along an existing call.
- The note is athlete-authored free text going to a third party for the first time. It is already
  gated by the `workout_write` consent and the spec-071 switch, so no new gate — but the UI
  disclosure above is a requirement, not a nicety.

## Test plan

- **Sidecar (pytest):** note present → `description` on the top-level DTO; empty/whitespace/None → key
  absent entirely; step descriptions unaffected; over-length note → 422 from the request model, not a
  malformed upstream call.
- **Unit (web):** the composer — note + provenance, provenance alone, truncation keeps the provenance
  line, and the total stays under the sidecar cap.
- **API integration:** the push phase sends `note` through a mock adapter and the mock asserts the
  body shape; a workout with no note still pushes.
- **Manual, once:** the real push from the premise check, eyeballed in Garmin Connect.

## Closeout

**Why this is not `Closed`.** Every criterion but the first is met and tested; the first — that Garmin
accepts a **top-level** `description` — cannot be checked from a test suite. It needs one real push
followed by one look at the workout in Garmin Connect. The code was written to fail safely either
way: if Garmin drops the field, the workout still lands exactly as it did before 082 and nothing
regresses. Tick the box (or withdraw the spec) after that look.

- Commits: —
- What landed:
  - Sidecar: `WorkoutCreateRequest.note` (≤1024), `build_workout_payload(..., note)` → top-level
    `description`, omitted when blank. 5 new pytest cases, including one that the note never reaches
    a log line.
  - Web: `composeWorkoutDescription` + `WORKOUT_PROVENANCE_LINE` (`via OpenVitals`) in `$lib/workouts`,
    `GarminWorkoutInput.note`, adapter body, push phase. Truncation drops the note, never the line.
  - UI: the editor's note field now says the note travels to Garmin.
- Notes / follow-ups:
  - Result of the field check (§Requirements 1): **outstanding** — see above.
  - Re-push of an edited session (the limitation above): spec 084.
