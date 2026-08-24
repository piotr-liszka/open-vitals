# Spec 093 — One dot, one card: merging an authored session with its own Garmin echo

- **Status:** Approved <!-- Draft → Approved → Closed -->
- **Module:** `apps/web/src/modules/workouts/`
- **Owner agent:** module-dev
- **Depends on:** 066 (planner UI), 024 (synced planned events), 081 (workout-id matching, `$lib/session-match.ts`),
  085 (planned-vs-actual, day+sport-family fallback precedent), 092 (repush fix, most recent touch of this UI)

## Context

`workouts.api.ts` has always been explicit that the planner draws from **two sources, deliberately not
merged**: `authored_workouts` (what the athlete wrote here — editable, has a push state) and
`synced_planned_events` (what Garmin's calendar already knows — read-only, replaced wholesale every
sync). That separation is correct as data model; spec 066 built the calendar and day panel to reflect
it literally, one dot and one card per row per source.

The problem is what happens the moment a push succeeds. The very next sync mirrors the pushed workout
straight back into `synced_planned_events` (spec 024's calendar read has no way to know "that entry is
mine"), so **every session that ever reaches Garmin ends up with two rows describing the same
real-world training session**: an authored one (pink "W kolejce" → green-ish "Na zegarku" once pushed,
with edit/delete/push controls) and a Garmin-echoed one (grey "Z Garmina", read-only, same title, same
discipline). Verified live on the production instance (beniaminnas.tail98287e.ts.net, 2026-08-20): a
day with one pushed session shows **two dots and two near-identical cards**. This is a display bug, not
a data bug — the two rows are legitimately separate records from two sources, and this spec does not
touch that. It revisits the "deliberately not merged" stance **only for rendering**, and only when a
confident same-session pairing exists: collapse the pair to one dot / one card, with a small indicator
that Garmin has echoed it back. A `synced_planned_events` row with no authored counterpart — a session
that only ever existed on Garmin — is unaffected and keeps rendering exactly as it does today.

## Requirements (acceptance criteria)

### Confirm the id link before trusting it

- [ ] **Not confirmed against real synced data — see Closeout.** This module-dev pass has no NAS/
      production database access, so `synced_planned_events.id` for an actually-pushed-and-resynced
      session could not be read live. Per the spec's own text this does not block shipping the rest:
      the id-match path below is implemented (trying both `garminScheduleId` and `garminWorkoutId`) and
      is cheap and correct if either lines up, but is NOT claimed confirmed. The day+discipline+title
      heuristic is the path that is actually known to be exercised in this checkout.

### Matching (new pure function, module-owned — this pairing has no existing home)

- [x] A new pure function, e.g. `matchPlannedEcho` in `apps/web/src/modules/workouts/planner-merge.ts`,
      pairs — **per day only, never across days** (an echo of a pushed session is never a day-shift
      candidate; the athlete didn't "do it late", Garmin just mirrored the same push back) — each
      authored workout against at most one planned event and each planned event against at most one
      authored workout.
- [x] **Preferred pairing: id match.** An authored workout whose `garminScheduleId` or
      `garminWorkoutId` (whichever the premise check above confirms, trying both if both survive) equals
      a same-day planned event's `id` is paired with it, unconditionally — no discipline or title check
      needed once an id lines up.
- [x] **Fallback pairing: same day + same discipline (`sportGroup`) + closest title**, used only when no
      id pairing exists for either side. This is the same *shape* of fallback spec 085 already applies
      (day + sport family before falling back further) — not the same code, since `$lib/session-match.ts`
      pairs a plan against a **completed activity**, and this spec pairs a plan against **another
      plan**; the two sides here are the same shape, so nothing in `session-match.ts`'s types fits
      without distortion. The pattern (try a hard identifier first, degrade to a same-day/same-discipline
      heuristic, never invent a pairing that dodges those two, resolve ties conservatively) is reused;
      the code is new and lives with the module that is its only consumer.
- [x] **Ties are left unmerged, not guessed.** If two same-day, same-discipline authored workouts are
      equally close to a candidate planned event by title (or there is no clear closest title at all —
      e.g. the titles share no meaningful similarity), no pairing is made for that event and every
      row involved renders separately, exactly as today. Under-merging (two cards where one would be
      nicer) is the acceptable failure mode; over-merging (hiding a real second session under one card)
      is not.
- [x] A planned event whose day holds no authored workout, or whose discipline matches nothing that
      day, is never paired — it stays a fully independent "Garmin-only" row, unchanged from today.

### View-model wiring (`workouts.api.ts` / `loadPlanner`)

- [x] `loadPlanner` runs the matcher above per day, over the same window's `workouts` and `planned`
      rows it already loads — no new store read, no new call to Garmin.
- [x] `PlannerData.planned` (`workouts.types.ts`) contains only planned events that were **not** paired
      to an authored workout. A paired planned event is consumed by the merge and never appears in this
      array — this is what makes the calendar's existing dot-counting code (`plannedByDay` in
      `PlannerView.svelte`, derived from `data.planned`) correct with **no change to
      `PlannerCalendar.svelte`**: a merged day already shows exactly one dot, because the "theirs" count
      it draws no longer includes the echoed-back event.
- [x] `AuthoredWorkoutView` gains `syncedBack: boolean` (`workouts.types.ts`) — true when this session
      was paired to a planned event by the matcher above, false otherwise. Nothing else about the view
      changes shape; no `PlannedEventView` fields leak into `AuthoredWorkoutView`, because the day panel
      only ever needs to say "Garmin has this back", not repeat Garmin's copy of the title/description.

### Calendar

- [x] A day with one authored, pushed, synced-back-echoed workout shows **exactly one dot**, colored by
      the existing done/pending rule (`--color-success` if `completion` is set, `--color-accent` "mine"
      otherwise) — never a second grey "theirs" dot for the same session.
- [x] A day with two distinct authored sessions of different disciplines, both pushed and both echoed
      back, shows **two dots** — de-duplication is per matched pair, not a cap on the day.
- [x] A day whose only planned-event row is genuinely Garmin-only (no authored counterpart) still shows
      its grey "theirs" dot, unchanged.

### Day panel

- [x] The merged case renders as **one card**: the existing authored-session card (title, discipline,
      time, push-state badge, steps, note, Edytuj/Usuń/Wyślij ponownie), plus a small additional
      `Badge` (reusing `lib/ui`'s `Badge`, not a bespoke element) reading "Zsynchronizowano" when
      `w.syncedBack` is true. The separate read-only "Z Garmina" card that same session used to also
      produce is not rendered a second time.
- [x] A day with one authored (never pushed) workout and no synced event renders exactly as today: one
      pink/neutral card, no "Zsynchronizowano" badge.
- [x] A day with a planned event that matched no authored workout still renders its own read-only
      "Z Garmina" card, unchanged from today — no edit/delete, same badge, same layout.
- [x] A day with two distinct authored workouts (different disciplines, or same discipline but not
      close enough in title to merge per the tie-break rule above) shows two cards, each following the
      rules above independently.

### General

- [x] `workouts.api.ts`'s own header comment ("Two sources, deliberately not merged") is updated to say
      *why* it still says that about the data, and *where* the one exception lives (rendering only, one
      confident pair at a time) — so the next reader does not find the comment and the behavior
      disagreeing.
- [x] No backend schema change. `synced_planned_events` and `authored_workouts` are both still written
      exactly as before; nothing pushed to Garmin changes; a paired planned event still exists in the
      store and is still returned by any other reader of `listPlannedEvents` (e.g. the start-page
      timeline, spec 022/024) — this spec touches the planner's view model only.
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

No new endpoint — the planner has no GET endpoint by design (spec 066); this is a `+page.server.ts`
load calling `loadPlanner`, tested by calling that function directly, exactly as today.

```
loadPlanner(...) result (PlannerData, in workouts.types.ts):
  workouts[].syncedBack: boolean    // NEW — true when a same-day planned event was folded into this row
  planned[]                        // UNCHANGED shape, but now EXCLUDES any event folded into a workout
```

## UI

- `PlannerView.svelte` day panel: one new `Badge` (tone `info` or `neutral`, `dot={false}`, label
  "Zsynchronizowano" / en. "Synced") next to the existing push-state `Badge`, shown only when
  `w.syncedBack`. No new component.
- `PlannerCalendar.svelte`: **no change**. Its dot counts are already derived from `authoredByDay` /
  `plannedByDay`, which in turn come from `data.workouts` / `data.planned` in `PlannerView.svelte` — once
  `data.planned` excludes matched events, the existing dot logic already draws one dot per day
  correctly. Stating this here so an implementer does not go looking for a change that is not needed.
- Copy added to both `pl.ts` and `en.ts` (`workout.syncedBackBadge` or similar key) — no hardcoded
  strings in the component, consistent with the rest of this module.
- Light + dark via tokens only; the new badge is an existing `lib/ui` component, so both already work.
- States: merged (badge shown), authored-only (unchanged), Garmin-only (unchanged), ambiguous/tied
  same-day same-discipline pair (both render separately, unchanged from today — explicitly not a new
  state, just the existing "two authored + two planned" rendering).

## Design / implementation notes

- **Why this is a module-owned file, not `$lib/`.** `$lib/session-match.ts` is shared because spec 081
  made both the week review and the planner ask the same question ("was this done?") of the same two
  shapes (a plan, an activity). This spec's pairing — a plan against *another plan* — has exactly one
  consumer, the planner's own load. AGENTS.md §5 says cross-module sharing goes through `lib/`; a
  single-consumer helper does not need to leave its module to satisfy that rule, and putting it in
  `$lib/` on spec-writing day would invite a second, drifting definition of "plan" the moment a second
  file wants a slightly different shape.
- **Per-day matching keeps this simple on purpose.** Unlike `session-match.ts`'s activity matching,
  there is no day-shift tolerance here: an echo of a pushed workout appears on the sync that follows
  the push, on the **same day** the workout was scheduled for. If a real gap between "authored" and
  "echoed" day is ever observed in practice, that is new information the premise check above should
  also capture — treated as a reason to revisit, not silently special-cased in advance.
- **The id fields to try are the two the push path already writes.** `AuthoredWorkout.garminScheduleId`
  (from `scheduleWorkout`, spec 092) and `AuthoredWorkout.garminWorkoutId` (from `createWorkout`, spec
  050) are both already columns; neither needs to be added. Only the premise check says which (if
  either) actually shows up as a `synced_planned_events.id` in practice — `garmy_client.py`'s own
  `_planned_event` tries `item.id`, then `item.scheduleId`, then `item.workoutId`, in that order, which
  is itself an `# ASSUMPTION:`-tagged guess from spec 024 and has never been checked against a real
  payload for this exact question.
- **Title-closeness is new, and deliberately narrow.** It only runs as a tie-break among same-day,
  same-discipline candidates that already survived the id check with nothing to show. It does not need
  to be a general string-similarity library — an exact match, then one title containing the other, then
  "no confident closest" (→ no merge) covers the realistic case (Garmin echoes the athlete's own title
  back verbatim in every observed instance so far) without overclaiming precision it cannot deliver.
- **`syncedBack` is derived on read, like `completion` (spec 081) and `onGarmin`.** No new stored flag,
  so a session whose Garmin echo later disappears (external deletion, a re-sync that drops the window)
  loses the badge on the very next load rather than lying about a state that no longer holds.
- Ports & adapters unchanged: no new adapter method, no new store method. `loadPlanner` still takes
  `store`/`clock`/`random`/`features` exactly as today; the merge is pure computation over what it
  already reads.

## Test plan

- **Unit (`planner-merge.test.ts`):**
  - an authored workout's `garminScheduleId` equal to a same-day planned event's `id` → paired,
    regardless of title/discipline text.
  - no id match, same day, same discipline, one clearly closer title → paired by the heuristic.
  - no id match, same day, same discipline, two authored candidates equally close (or neither close) to
    one planned event → **no pairing**, both stay unmerged.
  - same day, different discipline → never paired, id or no id.
  - different day entirely → never paired, even with matching ids (guards the "per day only" rule).
  - a planned event with no same-day authored workout at all → returned unmatched, unchanged.
- **Unit (`workouts.api.ts` / `loadPlanner`, mock store):**
  - one authored (pushed) + its matching planned echo on the same day → `workouts[0].syncedBack ===
    true`; `planned` array does not contain that event.
  - one authored (never pushed), no planned events that day → `syncedBack === false`; `planned` empty.
  - one planned event with no authored counterpart → present in `planned`, no workout has
    `syncedBack: true`.
  - two authored workouts, different disciplines, both echoed → both `syncedBack: true`; `planned`
    empty for that day.
- **Component:** not written, same reasoning as specs 083/092 — `PlannerView` needs `$app/stores`/
  `goto` scaffolding disproportionate to a one-badge change already pinned down by the `loadPlanner`
  tests above.

## Closeout

- Commits: (left uncommitted in the working tree for review, per instructions to this pass)
- Files changed:
  - `apps/web/src/modules/workouts/planner-merge.ts` — new. `matchPlannedEcho`, per-day id-then-heuristic
    pairing, exported alongside `AuthoredMergeCandidate` / `PlannedMergeCandidate` / `PlannerMergeResult`.
  - `apps/web/src/modules/workouts/planner-merge.test.ts` — new. Unit coverage for all 6 Test-plan cases
    plus a couple of extras (garminWorkoutId-only id match, empty-input short-circuit, two-discipline
    independence).
  - `apps/web/src/modules/workouts/workouts.types.ts` — `AuthoredWorkoutView.syncedBack: boolean` added.
  - `apps/web/src/modules/workouts/workouts.api.ts` — header comment reworded (see below); `toView` takes
    a `syncedBack` param (default `false` for the single-row write paths, which never know about synced
    events); `loadPlanner` runs `matchPlannedEcho` over the same `workouts`/`planned` arrays it already
    loaded, marks `syncedBack` per workout, and filters matched ids out of `planned` before mapping to
    `PlannedEventView`.
  - `apps/web/src/modules/workouts/workouts.api.test.ts` — added `describe('loadPlanner — synced-back
    merge (spec 093)')` with the 4 scenarios from the Test plan (merged pair, unpushed-only, Garmin-only,
    two-discipline both-merged).
  - `apps/web/src/modules/workouts/PlannerView.svelte` — one additional `Badge` (`tone="info"
    dot={false}`) next to the push-state badge, shown only when `w.syncedBack`.
  - `apps/web/src/lib/i18n/messages/pl.ts` / `en.ts` — `workout.syncedBackBadge`: "Zsynchronizowano" /
    "Synced".
  - `specs/093-planner-merge-authored-planned.md` — this file (checkboxes, Closeout).
  - `PlannerCalendar.svelte` — **untouched**, per the spec's own claim; verified by inspection (its dot
    counts derive from `authoredByDay`/`plannedByDay`, which `PlannerView.svelte` builds from
    `data.workouts`/`data.planned`) and by the full component test suite staying green unmodified.

- **Id-premise finding: NOT confirmed, by necessity, not by choice.** This pass runs with no NAS/
  production database access — there is no way to push a real session, let it sync back, and read what
  `synced_planned_events.id` actually holds for it. `services/garmin/app/garmy_client.py`'s
  `_planned_event` (around line 964) tries `item.id`, then `item.scheduleId`, then `item.workoutId`, and
  that ordering carries its own unresolved `# ASSUMPTION:` from spec 024 (line 861) — "UNVERIFIED
  against a live account." Nothing in this checkout (mock adapter, in-memory store fixtures, dev
  compose) exercises a real push-then-resync cycle either, so there was no secondary way to observe the
  behavior short of the live NAS check the spec asks for. Following the spec's explicit instruction for
  exactly this situation (and the spec 081 precedent it cites): the id-match path is implemented and
  tested — trying `garminScheduleId` first, then `garminWorkoutId`, against a same-day planned event's
  `id` — because it is cheap, correct if it ever lines up, and harmless if it never fires; but it ships
  UNCONFIRMED, not confirmed. The day+discipline+title heuristic is the path this implementation actually
  relies on to exercise merging, and every `loadPlanner` integration test above pairs sessions purely
  through it (via `garminWorkoutId` set by `updateWorkout`, which — not knowing which field Garmin
  echoes back as `id` — is exercised as if it were the winning id, but the test would pass identically if
  the heuristic pairing had matched instead, since day+discipline+title also line up in every test
  fixture). Whoever next gets NAS/production access should re-run spec 081's method (read `/dane` or the
  tables directly after a real push+resync) and update this note — and, if it turns out neither id ever
  lines up in practice, delete the id-match path from `planner-merge.ts` rather than leave a
  never-fires branch to gather test debt.

- Notes / follow-ups:
  - `matchPlannedEcho`'s heuristic never pairs a planned event whose `sport` is `null` — "same
    discipline" cannot be confirmed against an unknown one, and under-merging (leaving it as its own
    Garmin-only row) is the acceptable failure mode the spec asks for, not a gap to close later.
  - `pnpm run check`, `pnpm run lint`, `pnpm run test` (full suite, 204 files / 2836 passed / 7
    pre-existing skips), and `pnpm run build` were all run clean after this change.

- **QA verification (independent re-run, 2026-08-20):** `pnpm run check`, `pnpm run lint`,
  `pnpm run test -- --run` and `pnpm run build` re-run independently in `apps/web`; all green,
  matching the reported 204 files / 2836 passed / 7 pre-existing skips. Every checked acceptance
  criterion walked against the actual code: `matchPlannedEcho`'s per-day grouping, id-then-heuristic
  order, tie-handling and null-sport exclusion in `planner-merge.ts`; `loadPlanner`'s wiring of
  `syncedBack` and the `planned` filter in `workouts.api.ts`; `AuthoredWorkoutView.syncedBack` and
  the unchanged `PlannedEventView` shape in `workouts.types.ts`; the single new `Badge` (tone
  `info`, `dot={false}`, `workout.syncedBackBadge`) in `PlannerView.svelte`, gated on `w.syncedBack`
  with no bespoke element and no hardcoded copy. `PlannerCalendar.svelte` confirmed untouched by
  `git diff` and confirmed by reading it: `authoredByDay`/`plannedByDay` are props it only counts,
  supplied by `PlannerView.svelte`'s own `$derived` over `data.workouts`/`data.planned` — so the
  merge's filtering of `planned` is sufficient with no calendar change. i18n parity confirmed:
  `workout.syncedBackBadge` present in both `pl.ts` (`"Zsynchronizowano"`) and `en.ts` (`"Synced"`),
  exercised by `catalog.test.ts`'s key-parity/placeholder checks (green) and actually referenced in
  `PlannerView.svelte` (not orphaned). Scope confirmed via `git status`/`git diff --stat`: only
  `apps/web/src/modules/workouts/{planner-merge.ts,planner-merge.test.ts,workouts.types.ts,
  workouts.api.ts,workouts.api.test.ts,PlannerView.svelte}`, the two i18n message files, and this
  spec file were touched — nothing else in the tree.
  **Id-match safety, independently verified:** the id pass (`matchByIdForDay`) is scoped inside the
  same per-day loop as the heuristic pass, so it can never cross days regardless of whether ids
  collide; when `garminScheduleId`/`garminWorkoutId` are both `null` (never pushed) the function
  short-circuits (`wanted.length === 0`) straight past the id check; when they are set but do not
  match any same-day planned event's `id` (the premise's own stated uncertainty), `usedAuthored`/
  `usedPlanned` are left untouched and the row falls straight into
  `matchByHeuristicForDay` — same day + same discipline + closest title, ties and "no confident
  closest" both left unmerged. There is no code path where an unresolved or non-matching id causes
  an incorrect merge or a missed fallback; the degrade is clean. Confirmed by
  `planner-merge.test.ts`'s own "no id match" / cross-day / cross-discipline / tie cases, all green.
  No secrets in the diff (`git diff` grepped clean for `secret|token|password|apikey`, the one hit
  being a doc comment about the rule itself, not a violation). No stray `fetch`/`Date.now()`/
  `process.env` introduced. No e2e added. **Verdict: every checked box is genuinely earned; the one
  unchecked box (id-premise confirmation) is honestly represented, not a blocker per the spec's own
  text, and the code demonstrably degrades safely if it never fires. Status left at `Approved`,
  not advanced to `Closed`, because the id-premise item is explicitly unresolved pending NAS/
  production access — that is a `Closed`-blocking open item by this reviewer's read of AGENTS.md
  §8, even though it does not block the rest of the slice from shipping.**
