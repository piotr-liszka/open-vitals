# Spec 092 — Fix re-push: edited sessions duplicate, deleted sessions get stuck

- **Status:** Closed <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/lib/server/sync/` + `apps/web/src/lib/server/store/` + `apps/web/src/lib/mcp/`
  + `apps/web/src/modules/workouts/` + `services/garmin/app/`
- **Owner agent:** module-dev (store + push logic + UI) · garmin-integrator (sidecar)
- **Depends on:** 050 (authored workouts + push), 083 (push this workout now)

## Context

Spec 083 closed with a named follow-up ("re-push of a session edited after it reached Garmin: spec
084"), but 084 was taken by an unrelated spec before this got written — this is that fix, numbered 092.
`pushWorkout()` treats "this row already has a `garminWorkoutId`" as "safe to just re-schedule," with no
way to tell **content changed since the last push** apart from **the id is merely stale because the
Garmin-side copy was deleted externally**. Garmin's schedule endpoint always creates a **new** calendar
entry rather than replacing one, and nothing in the codebase ever clears `garminWorkoutId`. Two symptoms,
one root cause:

- **Duplicate on edit-then-push.** Editing an already-pushed session resets `pushState` to `pending` but
  keeps `garminWorkoutId` *and* `garminScheduleId` from the prior push
  ([workouts.api.ts:264](../apps/web/src/modules/workouts/workouts.api.ts),
  [workout-tools.ts:388](../apps/web/src/lib/mcp/workout-tools.ts)). The next push skips `createWorkout`
  (an id is already there) and calls `scheduleWorkout` again with the **old** id — Garmin adds a second
  calendar/watch entry carrying the **unedited** content, since the edited title/steps never reach
  Garmin's workout library at all. This is not hypothetical: the existing test at
  `workouts.api.test.ts:497` ("is a no-op the second time") already asserts `scheduleWorkout` is called
  **twice** for two presses on an unchanged, already-pushed row — the "no-op" it describes is a second
  live schedule call, which is the bug, not the guarantee its own name claims.
- **Stuck forever after external deletion.** `PlannerView.svelte:378` replaces the push control with a
  static `<span>` whenever `pushState === 'pushed'`, so there is no UI path to retry once Garmin has
  the id. Even a direct retry would fail identically: the sidecar's `_write()` maps a 404 on **any**
  workout write to the same `_UNSUPPORTED` sentinel
  ([workouts.py:410](../services/garmin/app/workouts.py)), so a schedule call against a workout Garmin
  no longer has looks exactly like "this account cannot schedule workouts at all." `pushWorkout` marks
  the row `failed` and never clears `garminWorkoutId`, so every retry — manual or background — repeats
  the same doomed call forever.

## Requirements (acceptance criteria)

**Data model**

- [x] `AuthoredWorkout` gains `contentPushed: boolean` — true once a `createWorkout` call has sent the
      row's **current** title/steps/note/sport to Garmin and not yet invalidated by an edit; false at
      creation (nothing sent yet) and false again the moment any content-affecting field changes.
      Implemented consistently in `AuthoredWorkoutPatch`, the pg adapter (new `content_pushed boolean
      not null default false` column, `ALTER TABLE authored_workouts ADD COLUMN IF NOT EXISTS
      content_pushed boolean not null default false`, added to `AUTHORED_COLUMNS`), and the in-memory
      adapter.
- [x] `updateWorkout` (both the web API path and the MCP `update_workout` tool) sets `contentPushed:
      false` in the same patch that resets `pushState` to `pending`, whenever `day`/`time`/`sport`/
      `title`/`steps`/`note` change. A patch that only changes non-content fields (nothing today does
      this, but the rule is stated for whoever adds one next) leaves it untouched.
- [x] The MCP `update_workout` comment claiming the kept `garminWorkoutId` means "the push phase updates
      rather than duplicating" is corrected to describe what actually happens once this spec lands
      (delete + recreate on the next push), or removed if it becomes literally true.

**`pushWorkout()` — the one push path both the sync engine and the manual button share**

- [x] No `garminWorkoutId` yet → unchanged: create, then schedule.
- [x] `garminWorkoutId` present and `contentPushed` is `false` (an edit happened since the last
      successful create) → delete the existing Garmin workout first (tolerates "already gone" — see
      below), then create + schedule fresh, storing the **new** `garminWorkoutId`/`garminScheduleId`.
      Never leaves two live calendar entries and never leaves the edited content unsent.
- [x] `garminWorkoutId` present and `contentPushed` is `true` (a half-pushed retry: create succeeded,
      scheduling didn't, content unchanged since) → schedule only, using the existing id, exactly as
      today.
- [x] When that schedule call reports the new `workout_not_found` reason (see sidecar below): clear
      `garminWorkoutId` (and `contentPushed`) and retry as a fresh create + schedule **in the same push
      call** — never leave the row `failed` with a stale id that every future attempt repeats.
- [x] A push that ends in `pushed` sets `contentPushed: true` alongside the ids it already stores.
- [x] Idempotency for the **unchanged, already-pushed** case gets strictly stronger, not weaker: calling
      `pushWorkout` again on a row that is already `pushed` with `contentPushed: true` and a
      `garminScheduleId` makes **no adapter calls at all** and returns the same state — today's
      `workouts.api.test.ts:497` asserts two `scheduleWorkout` calls for this case; that assertion is
      wrong and is corrected as part of this spec, not preserved.

**A user-facing way to force a re-push (fixes the "stuck" symptom)**

- [x] `PlannerView.svelte` never fully replaces the push control with a non-interactive element just
      because `pushState === 'pushed'`. It always renders a de-emphasized, still-clickable control
      (`Wyślij ponownie` instead of the primary `Wyślij na Garmina`), so recovery from an
      externally-deleted copy never depends solely on the server detecting staleness on its own.
- [x] Pressing `Wyślij ponownie` on a `pushed` row forces `contentPushed: false` (even though the
      athlete made no edit) before calling the existing push endpoint, so the existing "content
      changed" branch above runs: delete (idempotent) + create + schedule fresh. This is deliberately
      the *same* code path as the edit case — no second "does this workout still exist" check is
      invented, because Garmin's delete already tolerates "already gone" (see below), making
      delete-then-recreate safe whether the upstream copy is still live or was removed externally.
- [x] A normal edit still surfaces the existing `Wyślij na Garmina` (primary) control, unchanged from
      spec 083 — only an unedited `pushed` row gets the de-emphasized re-push affordance.

**Sidecar**

- [x] `schedule_workout`'s 404 handling returns a distinct `{"supported": false, "reason":
      "workout_not_found"}` instead of the generic `unsupported_endpoint`. `create_workout`'s 404
      handling is unchanged (`unsupported_endpoint`, permanent) — by the time `schedule_workout` is
      called with an existing id, a `create_workout` for this account has already succeeded at least
      once, so a schedule-endpoint 404 is evidence about *this workout id*, not about the account.
- [x] `delete_workout`'s existing tolerance of a 404 (`{"supported": true, "removed": false, "reason":
      "already_gone"}`) is confirmed sufficient for reuse by the new delete-then-recreate branch above —
      no sidecar change needed there, just verified by a new pytest case exercising it from that angle.
- [x] `GarminWorkoutScheduleResult`'s doc comment in `interfaces.ts` documents the new `reason` value;
      the HTTP adapter's `scheduleWorkout` needs no code change (it already forwards `reason` verbatim).

**General**

- [x] Unit + API-integration tests pass (no e2e); sidecar pytest covers the new `schedule_workout`
      classification and re-confirms `delete_workout`'s tolerance.
- [x] Store contract tests (`workout-contract.test.ts`) cover `contentPushed` round-tripping and the
      patch semantics in **both** the memory and pg adapters — not green-by-skip.
- [x] Built only from `lib/ui` components + design tokens (the one UI change: the de-emphasized button
      variant).
- [x] No secrets logged or committed.

## API contract

No new endpoints. `POST /api/workouts/[id]/push` (spec 083) is unchanged at the wire level; its
behavior changes for a `pushed` row only when the caller has first set `contentPushed: false` via the
patch this spec adds (an internal detail of how the "Wyślij ponownie" button calls it — see Design
notes for exactly where that happens).

```
# sidecar (internal only), changed response shape only
POST /workouts/{id}/schedule   res 200 (unchanged): { supported: true, scheduleId }
                                res 200 (CHANGED): { supported: false, reason: "workout_not_found" }
                                          — was reason: "unsupported_endpoint" for this same case
                               res 200 (unchanged): { supported: false, reason: "unsupported_endpoint" }
                                          — genuinely no schedule endpoint / different failure shape
DELETE /workouts/{id}          res 200 (unchanged): { supported: true, removed: false, reason: "already_gone" }
                                          when the id is already gone upstream
```

New/changed types: `AuthoredWorkout.contentPushed`, `AuthoredWorkoutPatch.contentPushed` in
`lib/server/store/types.ts`; `GarminWorkoutScheduleResult.reason` doc comment in `lib/server/interfaces.ts`.

## UI

`PlannerView.svelte` day panel. States for the push control on an authored session:

- Not yet pushed / failed / unsupported: unchanged from spec 083 — primary `Wyślij na Garmina` /
  `Wyślij…` busy state / reason text.
- Pushed, content unchanged: **new** — a de-emphasized `Wyślij ponownie` button (same `lib/ui` `Button`
  component, `variant="ghost"` or equivalent secondary treatment already used elsewhere in this file, not
  a bespoke style) sits where the static `Na Garminie` span used to be alone. The `Na Garminie` label can
  stay as an adjacent badge/status text; what changes is that a click target is *always* present.
- Busy state: disabled + announced to screen readers, same pattern as the existing button (spec 083).
- Light + dark via tokens; no new component.

## Design / implementation notes

- **Ports & adapters unchanged.** `pushWorkout` still takes `store`, `source`, `clock`, `classify` as
  injected arguments; no new adapter interface. `WritableSource` already requires `createWorkout` +
  `scheduleWorkout`; this spec also requires callers of the delete-then-recreate branch to have
  `deleteWorkout` — if a source lacks it (unlikely, since `WritableSource` is derived from
  `GarminSyncSource` where all three are added together in spec 050), the branch degrades to today's
  create+schedule without a delete, which is documented as a known gap rather than silently skipped.
- **Where `contentPushed: false` gets set for the manual re-push button:** the simplest place
  consistent with existing code is the `pushWorkoutNow` handler in `workouts.api.ts` — when the
  fetched row is already `pushed`, it patches `contentPushed: false` (and `pushState: 'pending'`) via
  `store.updateWorkout` *before* calling `pushWorkout`, mirroring exactly what an edit already does
  today. No change to the endpoint's request shape; the UI still calls the same
  `POST /api/workouts/[id]/push` with no body — the "force" is a server-side decision keyed on the
  row's current `pushState`, not a new query param, so a plain automatic retry (row already `failed`/
  `pending` from an edit) and an explicit re-push (row `pushed`) both funnel through one function.
- **Why delete-then-recreate is safe for the "still-live" case too:** if the athlete presses
  `Wyślij ponownie` on a row that is, in fact, still correctly on Garmin, `deleteWorkout` removes it and
  its schedule cleanly (spec 050: delete also removes the schedule), then a fresh create+schedule
  puts back an equivalent (or newly-edited) entry. Net result: still exactly one live entry. No
  probing/GET-based existence check is introduced — it would be one more unverified sidecar endpoint
  for no behavioral gain over "always safe to delete first."
- **Half-pushed retry stays narrow on purpose.** The `contentPushed: true` branch (schedule-only retry)
  is kept distinct from the delete-then-recreate branch specifically so an ordinary transient scheduling
  failure (rate limit, timeout) does not cost an extra delete+recreate round-trip on every sync tick —
  only a genuine `workout_not_found` answer triggers the self-heal, and only a content edit or an
  explicit user re-push triggers the delete-first path.
- **Existing quirk, explicitly out of scope:** a schedule failure whose reason is
  `unsupported_endpoint` (not `workout_not_found`) still becomes `pushState: 'failed'` and retries
  forever under today's logic rather than being parked as permanently `unsupported`. That inconsistency
  predates this spec and is not fixed here — flagged so it isn't mistaken for something this spec
  silently addressed.
- **Sync engine unaffected in shape.** The engine's push phase still iterates `pending`/`failed` rows and
  calls the same `pushWorkout`; a `pushed` row is still never selected by the automatic phase, so the
  "unedited, still-live workout is never touched on unrelated syncs" guarantee from spec 083 holds
  structurally, unchanged by anything in this spec.

## Test plan

- **Unit (`pushWorkout`):**
  - no id → create + schedule (unchanged).
  - id present, `contentPushed: true`, schedule succeeds → schedule-only, no delete, no create
    (unchanged from today).
  - id present, `contentPushed: false` (post-edit) → `deleteWorkout` called once with the old id,
    then `createWorkout` + `scheduleWorkout` with fresh ids; the stored row ends with the **new**
    ids and `contentPushed: true`.
  - id present, `contentPushed: true`, schedule reports `{ supported: false, reason:
    'workout_not_found' }` → `garminWorkoutId` cleared, immediate fresh create + schedule in the same
    call, ending `pushed` with new ids — never left `failed` with the stale id.
  - id present, `contentPushed: true`, schedule reports `{ supported: false, reason:
    'unsupported_endpoint' }` → unchanged existing behavior (`failed`, id kept).
  - already `pushed`, `contentPushed: true`, `garminScheduleId` set → calling `pushWorkout` again makes
    **zero** adapter calls (no create, no schedule, no delete) and returns the same state.
- **Unit (store contract, both adapters):** `contentPushed` defaults `false` on create; round-trips
  through `updateWorkout`; a patch that changes `steps`/`title`/etc. alongside `contentPushed: false`
  persists both; per-user isolation holds for the new column same as every other field.
- **Unit (`workouts.api.ts` / MCP `update_workout`):** editing content sets `contentPushed: false` in
  the same patch as `pushState: 'pending'`; `pushWorkoutNow` on an already-`pushed` row forces
  `contentPushed: false` before delegating to `pushWorkout`.
- **API integration (mock adapters):** `POST /api/workouts/[id]/push` on a `pushed` row exercises the
  delete+recreate path and returns a 200 view with fresh ids and `pushState: 'pushed'`; the existing
  083 contract tests (403/404/429/no-op-when-nothing-to-do) still pass, with the no-op case now
  meaning **zero adapter calls**, not two schedule calls.
- **Sidecar (pytest):** `schedule_workout` 404 → `{"supported": false, "reason": "workout_not_found"}`;
  `create_workout` 404 → unchanged `unsupported_endpoint`; `delete_workout` against an already-gone id
  → unchanged `{"supported": true, "removed": false, "reason": "already_gone"}`, exercised specifically
  as "the delete the web tier will call before recreating."
- **Component:** not written, same reasoning as spec 083 (`PlannerView` needs `$app/stores`/`goto`
  scaffolding disproportionate to the states, which are already pinned down by the API tests).

## Closeout

- Commits: — (pending; verified against uncommitted working tree — commit ref to follow)
- Notes / follow-ups:
  - QA verified every acceptance criterion directly against the code (not just agent self-reports):
    `pushWorkout()`'s four branches in `apps/web/src/lib/server/sync/workout-push.ts` match the spec
    line-for-line, with a dedicated `workout-push.test.ts` exercising all six test-plan cases directly
    (no id; half-pushed schedule-only; post-edit delete+recreate; `workout_not_found` self-heal in the
    same call; `unsupported_endpoint` unchanged; already-pushed zero-adapter-call idempotency), plus a
    documented-gap case for a source lacking `deleteWorkout`.
  - `services/garmin/app/workouts.py`: `git diff` confirms `create_workout` and `delete_workout` are
    byte-for-byte unchanged; only `schedule_workout`'s 404 branch and its docstring changed, exactly as
    scoped. New pytest cases confirm `workout_not_found` vs. unchanged `unsupported_endpoint` vs.
    unchanged `already_gone`.
  - Store/UI/MCP wiring (`memory.ts`, `pg.ts`, `db/index.ts` migration, `types.ts`,
    `workouts.api.ts`'s `updateWorkout`/`pushWorkoutNow`, MCP `update_workout`, `PlannerView.svelte`'s
    ghost-variant "Wyślij ponownie" button) all set/read `contentPushed` exactly where the spec requires.
  - Test suites re-run independently, not trusted from the agents' reports: `pnpm run check` (0 errors),
    `pnpm run lint` (clean), `pnpm run test` (203 files, 2822 passed / 7 skipped — the 7 are the
    standing per-file `describe.skip` pg blocks gated on `TEST_DATABASE_URL`, one of them
    `workout-contract.test.ts`). Re-ran the full suite a second time with `TEST_DATABASE_URL` pointed at
    the local dev Postgres (`garmin-bridge-db-1`, port 5433): all pg-adapter tests — including the new
    `contentPushed` round-trip case in `workout-contract.test.ts` — passed for real against Postgres,
    not green-by-skip. Sidecar: `pytest` from `services/garmin` via its `.venv`, 191 passed, matching
    the reported count with no regressions elsewhere in the suite.
  - The Design notes' explicitly-out-of-scope quirk — a schedule failure whose reason is
    `unsupported_endpoint` (not `workout_not_found`) still becomes `pushState: 'failed'` and retries
    forever rather than being parked as permanently `unsupported` — was confirmed left exactly as
    documented pre-existing behavior (see the dedicated "unchanged: failed, id kept" test in
    `workout-push.test.ts`), not silently fixed or silently reintroduced as a new bug.
  - General checklist: store contract tests cover `contentPushed` for both adapters (verified against
    real Postgres, not skip-only); no secrets logged or committed (sidecar logs only method/path/step
    counts, web logs classified failure text only); the one UI change (`PlannerView.svelte`'s re-push
    button) uses the existing `lib/ui` `Button` component with the `ghost` variant already used
    elsewhere in the file — no bespoke styling, no new component.
