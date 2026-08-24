# Spec 069 — Workout library: reusable sessions, dragged onto the plan

- **Status:** Closed
- **Module:** `apps/web/src/modules/workouts/`
- **Owner agent:** module-dev
- **Depends on:** 066 (planner), 050 (authored workouts + Garmin push)

## Context

Spec 066 built the calendar half of the request and missed the other half. The ask was *"a planner so I
can see predefined workouts **and** planner (Calendar)"* — two things. Only the calendar was built, so
every session has to be composed from scratch on the day it is wanted, and the athlete who does the
same 5×1 km session every fortnight rebuilds it every fortnight.

The missing half is a **library**: workouts that exist independently of any date, with their own CRUD,
which you drag onto a day to schedule. That split is the real model of how training is planned — a
session is a *thing you have*, and a plan is *when you will do it* — and the store has never been able
to express the first one. `authored_workouts` is date-bound by construction; there is no row that
means "this session, whenever".

This also gives the MCP tools somewhere to aim. Today an assistant asked for "Interwały 5×1 km on
Tuesday" builds the steps from nothing every time, so two requests a month apart produce two subtly
different sessions with the same name. With a library it resolves the name first and only invents a
session when the library genuinely has none.

## The scheduling relationship, stated

Scheduling **copies** the steps onto a dated `authored_workout`. It does not link to the template.

That is deliberate, and it is the one decision worth arguing about here. A live link would mean editing
a library entry silently rewrites sessions that have already been pushed to the athlete's watch —
including ones in the past. A session on the calendar is a commitment made on a day; the library is
where the idea lives. Copying keeps a plan an accurate record of what was actually asked for.

The cost is honest and small: editing a library entry does not update sessions already scheduled from
it. The UI says so at the point of editing rather than leaving it to be discovered.

## Requirements (acceptance criteria)

- [x] A `workout_templates` table holds reusable sessions: sport, title, steps, note — and no date
- [x] The library is listed on the plan page beside the calendar, with its step structure visible
- [x] A library workout can be created, edited and deleted from the UI
- [x] Dragging a library workout onto a calendar day schedules it on that day
- [x] Scheduling copies the steps; later edits to the library do not alter scheduled sessions
- [x] The editor says plainly that editing a library entry leaves already-scheduled copies untouched
- [x] A keyboard path to schedule exists — dragging is not the only way
- [x] Deleting a library workout asks first, and says scheduled copies survive
- [x] MCP `create_workout` resolves an existing library entry by sport + title before building steps
- [x] MCP creates the library entry when none matches, so the library fills as the assistant is used
- [x] A new MCP tool lists the library, so the assistant can offer what already exists
- [x] Writes are gated on `workout_write`, like every other authored-workout write
- [x] Unit + API-integration tests pass (no e2e)
- [x] Built only from `lib/ui` components + design tokens
- [x] No secrets logged or committed

## API contract

```
GET    /api/workout-templates                res 200 { templates: WorkoutTemplateView[] }
POST   /api/workout-templates                req WorkoutTemplateDraft  res 201 | 400 | 403 | 401
PATCH  /api/workout-templates/<id>           req WorkoutTemplateDraft  res 200 | 400 | 403 | 404 | 401
DELETE /api/workout-templates/<id>           res 200 { deleted: true } | 403 | 404 | 401
POST   /api/workouts   { templateId, day }   schedules a COPY   res 201 AuthoredWorkoutView | 404
```

`WorkoutTemplateDraft = { sport, title, steps, note }` — the same shape as a `WorkoutDraft` minus
`day`/`time`, and validated by the same `normalizeWorkout`. The scheduling call reuses the existing
create endpoint rather than adding a verb: scheduling *is* creating an authored workout, and the only
new thing is where the steps came from.

## UI

- `WorkoutLibrary.svelte` (new) — the list, its CRUD, and the drag source.
- `PlannerCalendar.svelte` — gains drop targets on day cells.
- `PlannerView.svelte` — three regions: calendar and library in the left column, selected day on the right.
- `WorkoutEditor.svelte` — reused for library entries with `day`/`time` suppressed; one editor, not two.
- States: empty library, dragging, drop hover, delete confirmation, consent off.

## Design / implementation notes

- **The editor is not forked.** A library entry is a workout without a date, so `WorkoutEditor` takes a
  `mode` and hides the two date fields. A second editor would be ~500 lines of duplicated step UI and
  a guaranteed drift, which is exactly what spec 067 had to clean up inside this file already.
- **Drag-and-drop reuses the spec-064 pattern** — native HTML5 DnD, index/id in component state, a pure
  function doing the actual work. It also keeps the keyboard path (a "schedule on…" control), because a
  drag is not reachable from a keyboard and this time it is the ONLY way to get a workout onto a day.
- **MCP resolution matches on `(sport, title)`**, case-insensitively, not on an id: the assistant is
  given a name by a human, and a name is what it can match. No foreign key is added to
  `authored_workouts` — the copy is a snapshot and a link would imply a liveness that does not exist.
- **One new table, and it must be declared TWICE.** `lib/server/db/index.ts` holds the schema in two
  places: the exported `schemaSql` reference string, and the `MIGRATIONS` array that `migrate()`
  actually runs. Only the second one exists at runtime. See the closeout — writing to the wrong one
  costs a green build and a 500.

## Test plan

- **Unit:** template sanitisation rejects what `normalizeWorkout` rejects; `scheduleFromTemplate` copies
  steps rather than referencing them (mutating the template afterwards must not change the scheduled row).
- **API integration (mock adapters):** template CRUD round-trips; scheduling from a template creates a
  dated workout whose steps equal the template's; scheduling an unknown template is 404; every write
  refuses without `workout_write`; one user cannot read or schedule another's templates.
- **MCP:** `create_workout` with a title matching a library entry uses its steps; with no match it
  creates the entry; the list tool returns the user's own templates only.

## Closeout

- Commits: see `feat(workouts): a library of sessions, dragged onto the plan (spec 069)`
- Verified in a running app: created a `5× (1 km @ 4:10–4:20/km)` entry, dragged it from the library
  onto the 26th with real `DragEvent`s — 42 cells armed as drop targets only while a drag was live, one
  highlighted under the pointer, and the drop landed the session on that day with its full step tree
  and a `W kolejce` badge. Then the spec's central claim, checked live: rewriting the library entry to
  a single 60-second step left the scheduled session's `5× (1 km @ 4:10)` block completely untouched.
- The tab is `Plan treningowy`, per the request.

### The bug worth writing down

`lib/server/db/index.ts` holds the schema **twice** — an exported `schemaSql` string whose comment said
"for reference / manual application", and a `MIGRATIONS` array that `migrate()` actually executes. I
added `workout_templates` to the first one, everything type-checked, all 2043 tests passed, and the
feature 500'd at runtime with *relation "workout_templates" does not exist*. Nothing in the type system
or the suite can catch this: the reference string is dead code that looks authoritative.

Fixed by adding the table to `MIGRATIONS` (the one that runs) and rewriting that comment to say
**NOTHING RUNS THIS** and that adding a table means editing both. The real fix is to generate one from
the other, or delete `schemaSql` — it has no importers at all. Left out of scope here because it
touches the boot path of every environment, but it is a trap set for the next person.

- Follow-ups: `schemaSql` is unused dead code and should be deleted or derived; drag-to-reschedule
  between calendar cells (spec 066's follow-up) is still open and now has a drop-target mechanism to
  build on.
