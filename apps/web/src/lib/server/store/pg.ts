/**
 * Postgres LocalStore adapter (spec 015). Parameterized tagged-template queries only (safe by
 * construction). Idempotent upserts (ON CONFLICT) so re-syncing a day/activity is a no-op-or-refresh.
 * Every row is keyed by `user_id` and cascades on user delete (schema in db/index.ts).
 */
import type { Sql } from 'postgres';
import type { GarminMetricName, GarminMetricRange } from '../interfaces';
import type { WorkoutStep } from '$lib/workouts';
import { isSportGroup } from '$lib/sport-labels';
import { blockEndDay } from '$lib/blocks';
import { DuplicateGoalError, OverlappingBlockError, lastDataDayOf } from './types';
import type {
  ActivityStreams,
  ActivitySummary,
  AuthoredWorkout,
  CoverageSnapshot,
  DataSource,
  GoalKind,
  GoalPriority,
  ListActivitiesQuery,
  ListGoalsQuery,
  ListWorkoutsQuery,
  LocalStore,
  MetricCoverage,
  PlannedEvent,
  SeasonGoal,
  SyncRun,
  SyncRunStatus,
  JournalEntry,
  ListJournalQuery,
  SorenessSignal,
  SyncState,
  TrainingBlock,
  TrainingBlockWeek,
  BlockPaces,
  WeightPoint,
  WorkoutPushState,
  WorkoutTemplate
} from './types';

interface ActivityRow {
  activity_id: string;
  sport: string;
  name: string | null;
  start_time: Date;
  start_time_local: string;
  distance_m: number | null;
  duration_s: number | null;
  moving_s: number | null;
  elevation_gain_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_power: number | null;
  max_power: number | null;
  norm_power: number | null;
  calories: number | null;
  training_load: number | null;
  has_gps: boolean;
  garmin_workout_id: string | null;
  raw: unknown;
}

function toActivity(userId: string, r: ActivityRow): ActivitySummary {
  return {
    userId,
    activityId: r.activity_id,
    sport: r.sport,
    name: r.name,
    startTime: r.start_time instanceof Date ? r.start_time.toISOString() : String(r.start_time),
    startTimeLocal: r.start_time_local,
    distanceM: r.distance_m,
    durationS: r.duration_s,
    movingS: r.moving_s,
    elevationGainM: r.elevation_gain_m,
    avgHr: r.avg_hr,
    maxHr: r.max_hr,
    avgPower: r.avg_power,
    maxPower: r.max_power,
    normPower: r.norm_power,
    calories: r.calories,
    trainingLoad: r.training_load,
    hasGps: r.has_gps,
    garminWorkoutId: r.garmin_workout_id ?? null,
    raw: r.raw ?? null // null for lite list reads (raw column not selected); populated by getActivity
  };
}

const isoDay = (d: Date | string): string =>
  d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);

export function createPgStore(sql: Sql): LocalStore {
  return {
    async putMetricDay(userId, metric, day, data) {
      await sql`
        INSERT INTO synced_metric_days (user_id, metric, day, data, has_value, synced_at)
        VALUES (${userId}, ${metric}, ${day}, ${sql.json(data as never)}, ${data != null}, now())
        ON CONFLICT (user_id, metric, day) DO UPDATE
          SET data = EXCLUDED.data, has_value = EXCLUDED.has_value, synced_at = now()`;
    },
    async putMetricDays(userId, metric, days) {
      if (days.length === 0) return;
      // One multi-row upsert. postgres.js expands the array of records.
      const rows = days.map((d) => ({
        user_id: userId,
        metric,
        day: d.day,
        data: sql.json(d.data as never),
        has_value: d.hasValue ?? d.data != null
      }));
      await sql`
        INSERT INTO synced_metric_days ${sql(rows, 'user_id', 'metric', 'day', 'data', 'has_value')}
        ON CONFLICT (user_id, metric, day) DO UPDATE
          SET data = EXCLUDED.data, has_value = EXCLUDED.has_value, synced_at = now()`;
    },
    async getMetricDay(userId, metric, day) {
      const rows = await sql<{ data: unknown }[]>`
        SELECT data FROM synced_metric_days WHERE user_id = ${userId} AND metric = ${metric} AND day = ${day} LIMIT 1`;
      return rows[0]?.data ?? null;
    },
    async getMetricRange(userId, metric: GarminMetricName, start, end): Promise<GarminMetricRange> {
      const rows = await sql<{ day: Date; data: unknown }[]>`
        SELECT day, data FROM synced_metric_days
        WHERE user_id = ${userId} AND metric = ${metric} AND day >= ${start} AND day <= ${end}
        ORDER BY day ASC`;
      const byDay = new Map(rows.map((r) => [isoDay(r.day), r.data]));
      const days: GarminMetricRange['days'] = [];
      const d = new Date(`${start}T00:00:00Z`);
      const last = new Date(`${end}T00:00:00Z`);
      while (d.getTime() <= last.getTime()) {
        const stamp = d.toISOString().slice(0, 10);
        days.push({ date: stamp, data: byDay.get(stamp) ?? null });
        d.setUTCDate(d.getUTCDate() + 1);
      }
      return { metric, start, end, days };
    },

    async putActivities(userId, list) {
      if (list.length === 0) return;
      for (const a of list) {
        await sql`
          INSERT INTO synced_activities (
            user_id, activity_id, sport, name, start_time, start_time_local, distance_m, duration_s,
            moving_s, elevation_gain_m, avg_hr, max_hr, avg_power, max_power, norm_power, calories,
            training_load, has_gps, garmin_workout_id, raw, synced_at)
          VALUES (
            ${userId}, ${a.activityId}, ${a.sport}, ${a.name}, ${a.startTime}, ${a.startTimeLocal},
            ${a.distanceM}, ${a.durationS}, ${a.movingS}, ${a.elevationGainM}, ${a.avgHr}, ${a.maxHr},
            ${a.avgPower}, ${a.maxPower}, ${a.normPower}, ${a.calories}, ${a.trainingLoad}, ${a.hasGps},
            ${a.garminWorkoutId}, ${sql.json(a.raw as never)}, now())
          ON CONFLICT (user_id, activity_id) DO UPDATE SET
            sport = EXCLUDED.sport, name = EXCLUDED.name, start_time = EXCLUDED.start_time,
            start_time_local = EXCLUDED.start_time_local, distance_m = EXCLUDED.distance_m,
            duration_s = EXCLUDED.duration_s, moving_s = EXCLUDED.moving_s,
            elevation_gain_m = EXCLUDED.elevation_gain_m, avg_hr = EXCLUDED.avg_hr, max_hr = EXCLUDED.max_hr,
            avg_power = EXCLUDED.avg_power, max_power = EXCLUDED.max_power, norm_power = EXCLUDED.norm_power,
            calories = EXCLUDED.calories, training_load = EXCLUDED.training_load,
            has_gps = (synced_activities.has_gps OR EXCLUDED.has_gps),
            -- Both of these are STICKY, like has_gps above and for the same reason: listActivities
            -- deliberately does not read raw, so a row round-tripped through a lite read (the
            -- streams phase does exactly that to set has_gps) arrives here with raw = null and
            -- therefore no workout id. Overwriting on that would erase the payload the write never
            -- read — and with it the id this whole join depends on. Garmin never re-issues a
            -- different workoutId for the same activity, so keeping the known value is also correct.
            garmin_workout_id = COALESCE(EXCLUDED.garmin_workout_id, synced_activities.garmin_workout_id),
            raw = CASE
                    WHEN EXCLUDED.raw IS NULL OR jsonb_typeof(EXCLUDED.raw) = 'null'
                      THEN synced_activities.raw
                    ELSE EXCLUDED.raw
                  END,
            synced_at = now()`;
      }
    },
    async getActivity(userId, activityId) {
      const rows = await sql<ActivityRow[]>`
        SELECT * FROM synced_activities WHERE user_id = ${userId} AND activity_id = ${activityId} LIMIT 1`;
      return rows[0] ? toActivity(userId, rows[0]) : null;
    },
    async listActivities(userId, query = {}) {
      // Deliberately DO NOT select `raw` (the full Garmin summary blob): list/aggregate pages only
      // need the normalized columns, and loading thousands of raw payloads is what OOM'd/502'd these
      // pages. The single-activity detail path (getActivity) still returns raw.
      const rows = await sql<ActivityRow[]>`
        SELECT user_id, activity_id, sport, name, start_time, start_time_local, distance_m, duration_s,
               moving_s, elevation_gain_m, avg_hr, max_hr, avg_power, max_power, norm_power, calories,
               training_load, has_gps, garmin_workout_id
        FROM synced_activities
        WHERE user_id = ${userId}
          ${query.sport ? sql`AND sport = ${query.sport}` : sql``}
          ${query.sports ? sql`AND sport = ANY(${[...query.sports]})` : sql``}
          ${query.from ? sql`AND left(start_time_local, 10) >= ${query.from}` : sql``}
          ${query.to ? sql`AND left(start_time_local, 10) <= ${query.to}` : sql``}
          ${query.search ? sql`AND (name ILIKE ${'%' + query.search + '%'} OR sport ILIKE ${'%' + query.search + '%'})` : sql``}
        ORDER BY ${orderBy(sql, query)}
        LIMIT ${query.limit ?? 1000} OFFSET ${query.offset ?? 0}`;
      return rows.map((r) => toActivity(userId, r));
    },
    async countActivities(userId, query = {}) {
      const rows = await sql<{ n: number }[]>`
        SELECT count(*)::int AS n FROM synced_activities
        WHERE user_id = ${userId}
          ${query.sport ? sql`AND sport = ${query.sport}` : sql``}
          ${query.sports ? sql`AND sport = ANY(${[...query.sports]})` : sql``}
          ${query.from ? sql`AND left(start_time_local, 10) >= ${query.from}` : sql``}
          ${query.to ? sql`AND left(start_time_local, 10) <= ${query.to}` : sql``}
          ${query.search ? sql`AND (name ILIKE ${'%' + query.search + '%'} OR sport ILIKE ${'%' + query.search + '%'})` : sql``}`;
      return rows[0]?.n ?? 0;
    },
    async listSports(userId) {
      // Ordered by frequency (spec 020): the filter chips show the user's most-used sports first and
      // collapse the tail, so an alphabetical list would bury the sports they actually train.
      const rows = await sql<{ sport: string; n: number }[]>`
        SELECT sport, count(*)::int AS n FROM synced_activities
        WHERE user_id = ${userId}
        GROUP BY sport
        ORDER BY n DESC, sport ASC`;
      return rows.map((r) => ({ sport: r.sport, count: r.n }));
    },

    async putStreams(userId, activityId, s) {
      // One transaction: new samples un-derive the activity's best efforts (spec 054), and clearing
      // `efforts_v` is only half of that. The stored rows were derived from the OLD samples, so they
      // go too — otherwise the all-time board keeps serving them until the next derivation pass, and
      // a reader between the two sees a version saying "not derived" beside rows saying otherwise.
      await sql.begin(async (tx) => {
        await tx`
          INSERT INTO synced_activity_streams (user_id, activity_id, streams, efforts_v, synced_at)
          VALUES (${userId}, ${activityId}, ${sql.json(s as never)}, NULL, now())
          ON CONFLICT (user_id, activity_id) DO UPDATE SET
            streams = EXCLUDED.streams, efforts_v = NULL, synced_at = now()`;
        await tx`
          DELETE FROM synced_activity_best_efforts
          WHERE user_id = ${userId} AND activity_id = ${activityId}`;
      });
    },
    async getStreams(userId, activityId) {
      const rows = await sql<{ streams: ActivityStreams }[]>`
        SELECT streams FROM synced_activity_streams WHERE user_id = ${userId} AND activity_id = ${activityId} LIMIT 1`;
      return rows[0]?.streams ?? null;
    },
    async listStreamVersions(userId) {
      // Only the version scalar, never the blobs: the sync engine calls this once per run over the
      // user's ENTIRE stream table, and loading those jsonb payloads would blow memory on the NAS.
      const rows = await sql<{ activity_id: string; v: string | null }[]>`
        SELECT activity_id, streams->>'v' AS v
        FROM synced_activity_streams WHERE user_id = ${userId}`;
      const out = new Map<string, number>();
      for (const r of rows) {
        const v = Number(r.v);
        out.set(r.activity_id, Number.isFinite(v) ? v : 0);
      }
      return out;
    },
    async getStreamField(userId, activityIds, field) {
      const out = new Map<string, number[]>();
      if (activityIds.length === 0) return out;
      // One query, single array param (= ANY handles large id lists), selecting ONLY the wanted field
      // so we never load gps/other arrays into memory just to read power/HR.
      const rows = await sql<{ activity_id: string; v: number[] | null }[]>`
        SELECT activity_id, streams->${field} AS v
        FROM synced_activity_streams
        WHERE user_id = ${userId} AND activity_id = ANY(${activityIds})`;
      for (const r of rows) if (Array.isArray(r.v) && r.v.length > 0) out.set(r.activity_id, r.v as number[]);
      return out;
    },
    async listGpsTracks(userId, query = {}) {
      // Select ONLY the gps column (not the whole stream blob) — the heatmap never needs HR/power,
      // and loading full blobs for every track is what OOM'd/timed the page out on constrained hosts.
      const rows = await sql<
        { activity_id: string; sport: string; start_time_local: string; gps: ActivityStreams['gps'] }[]
      >`
        SELECT a.activity_id, a.sport, a.start_time_local, s.streams->'gps' AS gps
        FROM synced_activities a
        JOIN synced_activity_streams s ON s.user_id = a.user_id AND s.activity_id = a.activity_id
        WHERE a.user_id = ${userId} AND a.has_gps = true
          ${query.sport ? sql`AND a.sport = ${query.sport}` : sql``}
          ${query.year ? sql`AND left(a.start_time_local, 4) = ${String(query.year)}` : sql``}`;
      return rows
        .map((r) => ({
          activityId: r.activity_id,
          sport: r.sport,
          startTimeLocal: r.start_time_local,
          gps: r.gps
        }))
        .filter(
          (
            t
          ): t is {
            activityId: string;
            sport: string;
            startTimeLocal: string;
            gps: NonNullable<ActivityStreams['gps']>;
          } => Array.isArray(t.gps) && t.gps.length > 0
        );
    },

    async putActivityBestEfforts(userId, input) {
      // One transaction: the activity's whole effort set is rewritten and the version stamped
      // together, so a reader never sees half a set and a crash cannot mark an activity done with
      // rows missing. Small by construction — at most `EFFORT_DISTANCES.length` rows.
      await sql.begin(async (tx) => {
        await tx`
          DELETE FROM synced_activity_best_efforts
          WHERE user_id = ${userId} AND activity_id = ${input.activityId}`;
        for (const e of input.efforts) {
          await tx`
            INSERT INTO synced_activity_best_efforts (
              user_id, activity_id, distance_key, distance_m, duration_s, actual_m,
              pace_sec_per_km, start_s, samples, sport, day, computed_at)
            VALUES (
              ${userId}, ${input.activityId}, ${e.key}, ${e.metres}, ${e.durationS}, ${e.actualM},
              ${e.paceSecPerKm}, ${e.startS}, ${e.samples}, ${input.sport}, ${input.day}, now())`;
        }
        await tx`
          UPDATE synced_activity_streams SET efforts_v = ${input.version}
          WHERE user_id = ${userId} AND activity_id = ${input.activityId}`;
      });
    },
    async listBestEffortVersions(userId) {
      // Only the version scalar, never the stream blobs — the backfill calls this once per run over
      // the user's ENTIRE stream table (same reasoning as `listStreamVersions`).
      const rows = await sql<{ activity_id: string; efforts_v: number | null }[]>`
        SELECT activity_id, efforts_v FROM synced_activity_streams WHERE user_id = ${userId}`;
      const out = new Map<string, number>();
      for (const r of rows) out.set(r.activity_id, r.efforts_v ?? 0);
      return out;
    },
    async listTopBestEfforts(userId, query) {
      // Top-N per distance in ONE query: ranking in SQL means the app never loads a career of efforts
      // just to keep three of them. Ties go to the earlier day — the record belongs to whoever set it
      // first — with the activity id as a final deterministic tiebreak.
      const rows = await sql<TopEffortRow[]>`
        SELECT distance_key, distance_m, duration_s, actual_m, pace_sec_per_km, start_s, samples,
               activity_id, activity_name, sport, day
        FROM (
          SELECT e.distance_key, e.distance_m, e.duration_s, e.actual_m, e.pace_sec_per_km,
                 e.start_s, e.samples, e.activity_id, a.name AS activity_name, e.sport, e.day,
                 row_number() OVER (
                   PARTITION BY e.distance_key
                   ORDER BY e.duration_s ASC, e.day ASC, e.activity_id ASC
                 ) AS rn
          FROM synced_activity_best_efforts e
          JOIN synced_activities a ON a.user_id = e.user_id AND a.activity_id = e.activity_id
          WHERE e.user_id = ${userId}
            ${query.sports ? sql`AND e.sport = ANY(${[...query.sports]})` : sql``}
            ${query.until ? sql`AND e.day <= ${query.until}` : sql``}
        ) ranked
        WHERE rn <= ${query.limit}
        ORDER BY distance_m ASC, duration_s ASC, day ASC, activity_id ASC`;
      return rows.map((r) => ({
        key: r.distance_key,
        metres: r.distance_m,
        durationS: r.duration_s,
        actualM: r.actual_m,
        paceSecPerKm: r.pace_sec_per_km,
        startS: r.start_s,
        samples: r.samples,
        activityId: r.activity_id,
        activityName: r.activity_name,
        sport: r.sport,
        day: isoDay(r.day)
      }));
    },

    async listBestEffortProgression(userId, query = {}) {
      // The record progression in ONE query (spec 087). A running MINIMUM over everything that came
      // BEFORE each row (`ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING`, so the row itself is
      // excluded) says what the record was the instant that effort was set; the row survives only if
      // it beat that, or if it is the first effort at its distance (`prev_best IS NULL`).
      //
      // The window's ORDER BY is the chronology, not the ranking: day first, activity id as the
      // deterministic tiebreak within a day — the same tiebreak `listTopBestEfforts` uses. Because
      // the comparison is STRICT `<`, an equal time set later is not a new record, which is the same
      // "the record belongs to whoever set it first" rule the leaderboard applies.
      const rows = await sql<TopEffortRow[]>`
        SELECT distance_key, distance_m, duration_s, actual_m, pace_sec_per_km, start_s, samples,
               activity_id, activity_name, sport, day
        FROM (
          SELECT e.distance_key, e.distance_m, e.duration_s, e.actual_m, e.pace_sec_per_km,
                 e.start_s, e.samples, e.activity_id, a.name AS activity_name, e.sport, e.day,
                 min(e.duration_s) OVER (
                   PARTITION BY e.distance_key
                   ORDER BY e.day ASC, e.activity_id ASC
                   ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                 ) AS prev_best
          FROM synced_activity_best_efforts e
          JOIN synced_activities a ON a.user_id = e.user_id AND a.activity_id = e.activity_id
          WHERE e.user_id = ${userId}
            ${query.sports ? sql`AND e.sport = ANY(${[...query.sports]})` : sql``}
        ) progression
        WHERE prev_best IS NULL OR duration_s < prev_best
        ORDER BY distance_m ASC, distance_key ASC, day ASC, activity_id ASC`;
      return rows.map((r) => ({
        key: r.distance_key,
        metres: r.distance_m,
        durationS: r.duration_s,
        actualM: r.actual_m,
        paceSecPerKm: r.pace_sec_per_km,
        startS: r.start_s,
        samples: r.samples,
        activityId: r.activity_id,
        activityName: r.activity_name,
        sport: r.sport,
        day: isoDay(r.day)
      }));
    },

    async replacePlannedEvents(userId, from, to, events) {
      // One transaction: the window is emptied and rewritten, so a plan the user deleted in Garmin
      // vanishes here too and no reader ever sees a half-written window.
      await sql.begin(async (tx) => {
        await tx`DELETE FROM synced_planned_events WHERE user_id = ${userId} AND day >= ${from} AND day <= ${to}`;
        for (const e of events) {
          await tx`
            INSERT INTO synced_planned_events (
              user_id, event_id, day, time_local, kind, title, sport, description,
              duration_s, distance_m, target_load, source, synced_at)
            VALUES (
              ${userId}, ${e.id}, ${e.day}, ${e.time}, ${e.kind}, ${e.title}, ${e.sport}, ${e.description},
              ${e.estimatedDurationS}, ${e.estimatedDistanceM}, ${e.targetLoad}, ${e.source}, now())
            ON CONFLICT (user_id, event_id) DO UPDATE SET
              day = EXCLUDED.day, time_local = EXCLUDED.time_local, kind = EXCLUDED.kind,
              title = EXCLUDED.title, sport = EXCLUDED.sport, description = EXCLUDED.description,
              duration_s = EXCLUDED.duration_s, distance_m = EXCLUDED.distance_m,
              target_load = EXCLUDED.target_load, source = EXCLUDED.source, synced_at = now()`;
        }
      });
    },
    async listPlannedEvents(userId, from, to) {
      const rows = await sql<PlannedRow[]>`
        SELECT event_id, day, time_local, kind, title, sport, description, duration_s, distance_m, target_load, source
        FROM synced_planned_events
        WHERE user_id = ${userId} AND day >= ${from} AND day <= ${to}
        ORDER BY day ASC, time_local ASC NULLS FIRST, event_id ASC`;
      return rows.map(toPlanned);
    },

    async createWorkout(userId, input) {
      const rows = await sql<AuthoredWorkoutRow[]>`
        INSERT INTO authored_workouts (
          id, user_id, day, time_local, sport, title, steps, note,
          push_state, created_at, updated_at)
        VALUES (
          ${input.id}, ${userId}, ${input.day}, ${input.time}, ${input.sport}, ${input.title},
          ${sql.json(input.steps as never)}, ${input.note},
          'pending', ${input.createdAt}, ${input.createdAt})
        RETURNING ${sql(AUTHORED_COLUMNS)}`;
      return toAuthored(userId, rows[0]!);
    },
    async getWorkout(userId, id) {
      const rows = await sql<AuthoredWorkoutRow[]>`
        SELECT ${sql(AUTHORED_COLUMNS)} FROM authored_workouts
        WHERE user_id = ${userId} AND id = ${id}`;
      return rows.length > 0 ? toAuthored(userId, rows[0]!) : null;
    },
    async listWorkouts(userId, query: ListWorkoutsQuery = {}) {
      // Bounds are optional, so each is applied as its own always-true-when-absent fragment rather
      // than by concatenating SQL text (parameterized templates only — see the module header).
      const rows = await sql<AuthoredWorkoutRow[]>`
        SELECT ${sql(AUTHORED_COLUMNS)} FROM authored_workouts
        WHERE user_id = ${userId}
          AND (${query.from ?? null}::date IS NULL OR day >= ${query.from ?? null}::date)
          AND (${query.to ?? null}::date IS NULL OR day <= ${query.to ?? null}::date)
          AND (${query.pushState ?? null}::text IS NULL OR push_state = ${query.pushState ?? null}::text)
        ORDER BY day ASC, time_local ASC NULLS FIRST, created_at ASC, id ASC
        LIMIT ${query.limit ?? null}`;
      return rows.map((r) => toAuthored(userId, r));
    },
    async updateWorkout(userId, id, patch) {
      // Only the keys PRESENT in the patch are written. A COALESCE-per-column form would be wrong
      // here: clearing `push_error` back to null is a real update, indistinguishable from "absent".
      const set: Record<string, unknown> = { updated_at: patch.updatedAt };
      if (patch.day !== undefined) set.day = patch.day;
      if (patch.time !== undefined) set.time_local = patch.time;
      if (patch.sport !== undefined) set.sport = patch.sport;
      if (patch.title !== undefined) set.title = patch.title;
      if (patch.steps !== undefined) set.steps = sql.json(patch.steps as never);
      if (patch.note !== undefined) set.note = patch.note;
      if (patch.pushState !== undefined) set.push_state = patch.pushState;
      if (patch.pushError !== undefined) set.push_error = patch.pushError;
      if (patch.garminWorkoutId !== undefined) set.garmin_workout_id = patch.garminWorkoutId;
      if (patch.garminScheduleId !== undefined) set.garmin_schedule_id = patch.garminScheduleId;
      if (patch.contentPushed !== undefined) set.content_pushed = patch.contentPushed;
      if (patch.matchedActivityId !== undefined) set.matched_activity_id = patch.matchedActivityId;
      const rows = await sql<AuthoredWorkoutRow[]>`
        UPDATE authored_workouts SET ${sql(set)}
        WHERE user_id = ${userId} AND id = ${id}
        RETURNING ${sql(AUTHORED_COLUMNS)}`;
      return rows.length > 0 ? toAuthored(userId, rows[0]!) : null;
    },
    async deleteWorkout(userId, id) {
      const rows = await sql<AuthoredWorkoutRow[]>`
        DELETE FROM authored_workouts WHERE user_id = ${userId} AND id = ${id}
        RETURNING ${sql(AUTHORED_COLUMNS)}`;
      return rows.length > 0 ? toAuthored(userId, rows[0]!) : null;
    },

    /* ---- workout library (spec 069) ---- */
    async createWorkoutTemplate(userId, input) {
      const rows = await sql<WorkoutTemplateRow[]>`
        INSERT INTO workout_templates (id, user_id, sport, title, steps, note, created_at, updated_at)
        VALUES (
          ${input.id}, ${userId}, ${input.sport}, ${input.title},
          ${sql.json(input.steps as never)}, ${input.note}, ${input.createdAt}, ${input.createdAt})
        RETURNING ${sql(TEMPLATE_COLUMNS)}`;
      return toTemplate(userId, rows[0]!);
    },
    async getWorkoutTemplate(userId, id) {
      const rows = await sql<WorkoutTemplateRow[]>`
        SELECT ${sql(TEMPLATE_COLUMNS)} FROM workout_templates
        WHERE user_id = ${userId} AND id = ${id}`;
      return rows.length > 0 ? toTemplate(userId, rows[0]!) : null;
    },
    async listWorkoutTemplates(userId) {
      const rows = await sql<WorkoutTemplateRow[]>`
        SELECT ${sql(TEMPLATE_COLUMNS)} FROM workout_templates
        WHERE user_id = ${userId}
        ORDER BY title ASC, id ASC`;
      return rows.map((r) => toTemplate(userId, r));
    },
    async findWorkoutTemplateByTitle(userId, sport, title) {
      // `lower(btrim(...))` on both sides, matching the memory adapter: an assistant is handed a name
      // by a human, and humans do not reproduce capitalisation (spec 069).
      const rows = await sql<WorkoutTemplateRow[]>`
        SELECT ${sql(TEMPLATE_COLUMNS)} FROM workout_templates
        WHERE user_id = ${userId}
          AND sport = ${sport}
          AND lower(btrim(title)) = ${title.trim().toLowerCase()}
        ORDER BY id ASC
        LIMIT 1`;
      return rows.length > 0 ? toTemplate(userId, rows[0]!) : null;
    },
    async updateWorkoutTemplate(userId, id, patch) {
      // Only the keys PRESENT in the patch are written — same reasoning as `updateWorkout`: clearing
      // `note` back to null is a real update and must not be confused with "absent".
      const set: Record<string, unknown> = { updated_at: patch.updatedAt };
      if (patch.sport !== undefined) set.sport = patch.sport;
      if (patch.title !== undefined) set.title = patch.title;
      if (patch.steps !== undefined) set.steps = sql.json(patch.steps as never);
      if (patch.note !== undefined) set.note = patch.note;
      const rows = await sql<WorkoutTemplateRow[]>`
        UPDATE workout_templates SET ${sql(set)}
        WHERE user_id = ${userId} AND id = ${id}
        RETURNING ${sql(TEMPLATE_COLUMNS)}`;
      return rows.length > 0 ? toTemplate(userId, rows[0]!) : null;
    },
    async deleteWorkoutTemplate(userId, id) {
      const rows = await sql<WorkoutTemplateRow[]>`
        DELETE FROM workout_templates WHERE user_id = ${userId} AND id = ${id}
        RETURNING ${sql(TEMPLATE_COLUMNS)}`;
      return rows.length > 0 ? toTemplate(userId, rows[0]!) : null;
    },

    async createGoal(userId, input) {
      /*
       * `ON CONFLICT … DO NOTHING` against the partial unique index, then an empty RETURNING means
       * the synced race was already adopted. Checking first and inserting after would leave the
       * window two concurrent imports need to both succeed; the index is the only real guard.
       */
      const rows = await sql<SeasonGoalRow[]>`
        INSERT INTO season_goals (
          id, user_id, day, sport, title, kind, priority, distance_m, target_time_s, target_ctl,
          note, source, garmin_event_id, created_at, updated_at)
        VALUES (
          ${input.id}, ${userId}, ${input.day}, ${input.sport}, ${input.title}, ${input.kind},
          ${input.priority}, ${input.distanceM}, ${input.targetTimeS}, ${input.targetCtl},
          ${input.note}, ${input.source}, ${input.garminEventId}, ${input.createdAt}, ${input.createdAt})
        ON CONFLICT (user_id, garmin_event_id) WHERE garmin_event_id IS NOT NULL DO NOTHING
        RETURNING ${sql(GOAL_COLUMNS)}`;
      if (rows.length === 0) throw new DuplicateGoalError(input.garminEventId ?? '');
      return toGoal(userId, rows[0]!);
    },
    async getGoal(userId, id) {
      const rows = await sql<SeasonGoalRow[]>`
        SELECT ${sql(GOAL_COLUMNS)} FROM season_goals
        WHERE user_id = ${userId} AND id = ${id}`;
      return rows.length > 0 ? toGoal(userId, rows[0]!) : null;
    },
    async listGoals(userId, query: ListGoalsQuery = {}) {
      const rows = await sql<SeasonGoalRow[]>`
        SELECT ${sql(GOAL_COLUMNS)} FROM season_goals
        WHERE user_id = ${userId}
          AND (${query.from ?? null}::date IS NULL OR day >= ${query.from ?? null}::date)
          AND (${query.to ?? null}::date IS NULL OR day <= ${query.to ?? null}::date)
          AND (${query.sport ?? null}::text IS NULL OR sport = ${query.sport ?? null}::text)
        ORDER BY day ASC, id ASC
        LIMIT ${query.limit ?? null}`;
      return rows.map((r) => toGoal(userId, r));
    },
    async updateGoal(userId, id, patch) {
      // Only the keys PRESENT in the patch are written — clearing a target back to null is a real
      // update, indistinguishable from "absent" under a COALESCE-per-column form.
      const set: Record<string, unknown> = { updated_at: patch.updatedAt };
      if (patch.day !== undefined) set.day = patch.day;
      if (patch.sport !== undefined) set.sport = patch.sport;
      if (patch.title !== undefined) set.title = patch.title;
      if (patch.kind !== undefined) set.kind = patch.kind;
      if (patch.priority !== undefined) set.priority = patch.priority;
      if (patch.distanceM !== undefined) set.distance_m = patch.distanceM;
      if (patch.targetTimeS !== undefined) set.target_time_s = patch.targetTimeS;
      if (patch.targetCtl !== undefined) set.target_ctl = patch.targetCtl;
      if (patch.note !== undefined) set.note = patch.note;
      const rows = await sql<SeasonGoalRow[]>`
        UPDATE season_goals SET ${sql(set)}
        WHERE user_id = ${userId} AND id = ${id}
        RETURNING ${sql(GOAL_COLUMNS)}`;
      return rows.length > 0 ? toGoal(userId, rows[0]!) : null;
    },
    async deleteGoal(userId, id) {
      const rows = await sql<SeasonGoalRow[]>`
        DELETE FROM season_goals WHERE user_id = ${userId} AND id = ${id}
        RETURNING ${sql(GOAL_COLUMNS)}`;
      return rows.length > 0 ? toGoal(userId, rows[0]!) : null;
    },

    async createBlock(userId, input) {
      /*
       * The overlap guard is a conditional INSERT, not a SELECT-then-INSERT: two concurrent creates
       * would both pass a prior check and both land. Postgres has no exclusion constraint we can
       * express over "start_day + weeks*7 days" without a generated column, so the guard lives in
       * the WHERE — one statement, so one of the two racers finds the other's row.
       */
      const endDay = blockEndDay({ startDay: input.startDay, weeks: input.weeks });
      const rows = await sql<TrainingBlockRow[]>`
        INSERT INTO training_blocks (
          id, user_id, goal_id, name, start_day, weeks, paces, constraints, note, created_at, updated_at)
        SELECT
          ${input.id}, ${userId}, ${input.goalId}, ${input.name}, ${input.startDay}, ${input.weeks},
          ${sql.json(input.paces as never)}, ${sql.json([...input.constraints] as never)},
          ${input.note}, ${input.createdAt}, ${input.createdAt}
        WHERE NOT EXISTS (
          SELECT 1 FROM training_blocks
          WHERE user_id = ${userId}
            AND start_day <= ${endDay}::date
            AND (start_day + (weeks * 7 - 1)) >= ${input.startDay}::date)
        RETURNING ${sql(BLOCK_COLUMNS)}`;
      if (rows.length === 0) {
        // Nothing inserted means something already covers those days; read it back so the error can
        // name it. If it has since been deleted the caller may simply retry, which is what the
        // fallback message says rather than inventing a block that is not there.
        const clash = await sql<TrainingBlockRow[]>`
          SELECT ${sql(BLOCK_COLUMNS)} FROM training_blocks
          WHERE user_id = ${userId}
            AND start_day <= ${endDay}::date
            AND (start_day + (weeks * 7 - 1)) >= ${input.startDay}::date
          ORDER BY start_day ASC LIMIT 1`;
        if (clash.length === 0) throw new Error('block insert raced a concurrent delete — retry');
        throw new OverlappingBlockError(toBlock(userId, clash[0]!));
      }
      return toBlock(userId, rows[0]!);
    },
    async getBlock(userId, id) {
      const rows = await sql<TrainingBlockRow[]>`
        SELECT ${sql(BLOCK_COLUMNS)} FROM training_blocks
        WHERE user_id = ${userId} AND id = ${id}`;
      return rows.length > 0 ? toBlock(userId, rows[0]!) : null;
    },
    async listBlocks(userId, query = {}) {
      const rows = await sql<TrainingBlockRow[]>`
        SELECT ${sql(BLOCK_COLUMNS)} FROM training_blocks
        WHERE user_id = ${userId}
          AND (${query.goalId ?? null}::text IS NULL OR goal_id = ${query.goalId ?? null}::text)
        ORDER BY start_day ASC, id ASC`;
      return rows.map((r) => toBlock(userId, r));
    },
    async findBlockForDay(userId, day) {
      const rows = await sql<TrainingBlockRow[]>`
        SELECT ${sql(BLOCK_COLUMNS)} FROM training_blocks
        WHERE user_id = ${userId}
          AND start_day <= ${day}::date
          AND (start_day + (weeks * 7 - 1)) >= ${day}::date
        ORDER BY start_day ASC LIMIT 1`;
      return rows.length > 0 ? toBlock(userId, rows[0]!) : null;
    },
    async updateBlock(userId, id, patch) {
      // Only the keys PRESENT in the patch are written — same reasoning as `updateGoal`.
      const set: Record<string, unknown> = { updated_at: patch.updatedAt };
      if (patch.goalId !== undefined) set.goal_id = patch.goalId;
      if (patch.name !== undefined) set.name = patch.name;
      if (patch.startDay !== undefined) set.start_day = patch.startDay;
      if (patch.weeks !== undefined) set.weeks = patch.weeks;
      if (patch.paces !== undefined) set.paces = sql.json(patch.paces as never);
      if (patch.constraints !== undefined) set.constraints = sql.json([...patch.constraints] as never);
      if (patch.note !== undefined) set.note = patch.note;

      /*
       * Moving or lengthening a block can push it onto another one, so the UPDATE carries the same
       * guard the INSERT does — in the WHERE, so a concurrent create cannot slip between a check and
       * a write. `weeks`/`start_day` inside the NOT EXISTS refer to the OTHER rows, which is why the
       * new span has to be passed as literals rather than read off the row being updated.
       */
      const startDay = patch.startDay ?? null;
      const weeks = patch.weeks ?? null;
      const rows = await sql<TrainingBlockRow[]>`
        UPDATE training_blocks b SET ${sql(set)}
        WHERE b.user_id = ${userId} AND b.id = ${id}
          AND NOT EXISTS (
            SELECT 1 FROM training_blocks o
            WHERE o.user_id = ${userId} AND o.id <> ${id}
              AND o.start_day <= (COALESCE(${startDay}::date, b.start_day)
                                  + (COALESCE(${weeks}::int, b.weeks) * 7 - 1))
              AND (o.start_day + (o.weeks * 7 - 1)) >= COALESCE(${startDay}::date, b.start_day))
        RETURNING ${sql(BLOCK_COLUMNS)}`;
      if (rows.length === 0) {
        // No row updated is either "not this user's block" or "the new span collides". Only the
        // second deserves an error, so distinguish them rather than reporting a missing block.
        const own = await sql<TrainingBlockRow[]>`
          SELECT ${sql(BLOCK_COLUMNS)} FROM training_blocks WHERE user_id = ${userId} AND id = ${id}`;
        if (own.length === 0) return null;
        const current = toBlock(userId, own[0]!);
        const span = { startDay: patch.startDay ?? current.startDay, weeks: patch.weeks ?? current.weeks };
        const clash = await sql<TrainingBlockRow[]>`
          SELECT ${sql(BLOCK_COLUMNS)} FROM training_blocks
          WHERE user_id = ${userId} AND id <> ${id}
            AND start_day <= ${blockEndDay(span)}::date
            AND (start_day + (weeks * 7 - 1)) >= ${span.startDay}::date
          ORDER BY start_day ASC LIMIT 1`;
        if (clash.length === 0) throw new Error('block update raced a concurrent write — retry');
        throw new OverlappingBlockError(toBlock(userId, clash[0]!));
      }
      const block = toBlock(userId, rows[0]!);
      // A shrink drops the week rows it removed, so lengthening the block again cannot silently
      // resurrect targets nobody re-approved. Mirrored in the memory adapter.
      await sql`DELETE FROM training_block_weeks WHERE block_id = ${id} AND week_number > ${block.weeks}`;
      return block;
    },
    async deleteBlock(userId, id) {
      // training_block_weeks goes with it via ON DELETE CASCADE.
      const rows = await sql<TrainingBlockRow[]>`
        DELETE FROM training_blocks WHERE user_id = ${userId} AND id = ${id}
        RETURNING ${sql(BLOCK_COLUMNS)}`;
      return rows.length > 0 ? toBlock(userId, rows[0]!) : null;
    },
    async listBlockWeeks(userId, blockId) {
      // Joined through the block so a week list is scoped to the owner, never to a bare block id.
      const rows = await sql<TrainingBlockWeekRow[]>`
        SELECT w.block_id, w.week_number, w.phase, w.volume_target_km, w.focus, w.note
        FROM training_block_weeks w
        JOIN training_blocks b ON b.id = w.block_id
        WHERE b.user_id = ${userId} AND w.block_id = ${blockId}
        ORDER BY w.week_number ASC`;
      return rows.map(toBlockWeek);
    },
    async putBlockWeeks(userId, blockId, weeks) {
      const owner = await sql<{ weeks: number }[]>`
        SELECT weeks FROM training_blocks WHERE user_id = ${userId} AND id = ${blockId}`;
      if (owner.length === 0) return null;
      const maxWeeks = owner[0]!.weeks;

      /*
       * Read-merge-write rather than a clever ON CONFLICT expression.
       *
       * The semantics are three-valued: an ABSENT key keeps what is stored, an explicit `null`
       * clears it, and a value sets it. No single upsert expression says that — `COALESCE(EXCLUDED,
       * stored)` cannot clear, and a blanket overwrite cannot keep. Merging in TypeScript is the
       * only form where the memory adapter and this one are provably the same, which is what the
       * shared contract test asserts.
       */
      const current = await sql<TrainingBlockWeekRow[]>`
        SELECT block_id, week_number, phase, volume_target_km, focus, note
        FROM training_block_weeks WHERE block_id = ${blockId}`;
      const byWeek = new Map(current.map((r) => [r.week_number, r]));

      for (const w of weeks) {
        if (w.weekNumber < 1 || w.weekNumber > maxWeeks) continue;
        const prev = byWeek.get(w.weekNumber);
        const phase = w.phase !== undefined ? w.phase : (prev?.phase ?? null);
        const volume = w.volumeTargetKm !== undefined ? w.volumeTargetKm : (prev?.volume_target_km ?? null);
        const focus = w.focus !== undefined ? w.focus : (prev?.focus ?? null);
        const note = w.note !== undefined ? w.note : (prev?.note ?? null);
        await sql`
          INSERT INTO training_block_weeks (block_id, week_number, phase, volume_target_km, focus, note)
          VALUES (${blockId}, ${w.weekNumber}, ${phase}, ${volume}, ${focus}, ${note})
          ON CONFLICT (block_id, week_number) DO UPDATE SET
            phase = EXCLUDED.phase,
            volume_target_km = EXCLUDED.volume_target_km,
            focus = EXCLUDED.focus,
            note = EXCLUDED.note`;
      }
      const rows = await sql<TrainingBlockWeekRow[]>`
        SELECT block_id, week_number, phase, volume_target_km, focus, note
        FROM training_block_weeks WHERE block_id = ${blockId} ORDER BY week_number ASC`;
      return rows.map(toBlockWeek);
    },

    async putJournalEntry(userId, input) {
      /*
       * Read-merge-write, the same shape `putBlockWeeks` uses and for the same reason: the semantics
       * are three-valued (absent keeps, null clears, value sets) and no single upsert expression can
       * say that. The unique index is NULLS NOT DISTINCT, so the day-level row (activity_id NULL) is
       * one row that gets corrected rather than a new row on every check-in.
       */
      const current = await sql<JournalRow[]>`
        SELECT ${sql(JOURNAL_COLUMNS)} FROM journal_entries
        WHERE user_id = ${userId} AND day = ${input.day}::date
          AND activity_id IS NOT DISTINCT FROM ${input.activityId}`;
      const prev = current[0] ? toJournal(userId, current[0]) : null;

      const merged = {
        id: prev?.id ?? input.id,
        rpe: input.rpe !== undefined ? input.rpe : (prev?.rpe ?? null),
        soreness: input.soreness !== undefined ? input.soreness : (prev?.soreness ?? null),
        location: input.location !== undefined ? input.location : (prev?.location ?? null),
        mood: input.mood !== undefined ? input.mood : (prev?.mood ?? null),
        note: input.note !== undefined ? input.note : (prev?.note ?? null),
        illness: input.illness !== undefined ? input.illness : (prev?.illness ?? false),
        injury: input.injury !== undefined ? input.injury : (prev?.injury ?? false)
      };

      const rows = await sql<JournalRow[]>`
        INSERT INTO journal_entries (
          id, user_id, day, activity_id, rpe, soreness, location, mood, note, illness, injury,
          created_at, updated_at)
        VALUES (
          ${merged.id}, ${userId}, ${input.day}, ${input.activityId}, ${merged.rpe},
          ${merged.soreness}, ${merged.location}, ${merged.mood}, ${merged.note}, ${merged.illness},
          ${merged.injury}, ${prev?.createdAt ?? input.at}, ${input.at})
        ON CONFLICT (user_id, day, activity_id) DO UPDATE SET
          rpe = EXCLUDED.rpe, soreness = EXCLUDED.soreness, location = EXCLUDED.location,
          mood = EXCLUDED.mood, note = EXCLUDED.note, illness = EXCLUDED.illness,
          injury = EXCLUDED.injury, updated_at = EXCLUDED.updated_at
        RETURNING ${sql(JOURNAL_COLUMNS)}`;
      return toJournal(userId, rows[0]!);
    },
    async listJournalEntries(userId, query: ListJournalQuery = {}) {
      // Day ascending, and within a day the day-level row (NULL activity) before the session rows.
      const rows = await sql<JournalRow[]>`
        SELECT ${sql(JOURNAL_COLUMNS)} FROM journal_entries
        WHERE user_id = ${userId}
          AND (${query.from ?? null}::date IS NULL OR day >= ${query.from ?? null}::date)
          AND (${query.to ?? null}::date IS NULL OR day <= ${query.to ?? null}::date)
        ORDER BY day ASC, activity_id ASC NULLS FIRST, id ASC
        LIMIT ${query.limit ?? null}`;
      return rows.map((r) => toJournal(userId, r));
    },
    async getJournalEntry(userId, id) {
      const rows = await sql<JournalRow[]>`
        SELECT ${sql(JOURNAL_COLUMNS)} FROM journal_entries
        WHERE user_id = ${userId} AND id = ${id}`;
      return rows.length > 0 ? toJournal(userId, rows[0]!) : null;
    },
    async deleteJournalEntry(userId, id) {
      const rows = await sql<JournalRow[]>`
        DELETE FROM journal_entries WHERE user_id = ${userId} AND id = ${id}
        RETURNING ${sql(JOURNAL_COLUMNS)}`;
      return rows.length > 0 ? toJournal(userId, rows[0]!) : null;
    },
    async worstSoreness(userId, from, to, min): Promise<SorenessSignal | null> {
      // Worst first; ties to the MORE RECENT day, because that is the one still true today.
      const rows = await sql<{ day: Date | string; soreness: number; location: string | null }[]>`
        SELECT day, soreness, location FROM journal_entries
        WHERE user_id = ${userId} AND day >= ${from}::date AND day <= ${to}::date
          AND soreness IS NOT NULL AND soreness >= ${min}
        ORDER BY soreness DESC, day DESC
        LIMIT 1`;
      const r = rows[0];
      return r ? { day: isoDay(r.day), soreness: r.soreness, location: r.location } : null;
    },

    async putWeight(userId, points) {
      for (const p of points) {
        await sql`
          INSERT INTO synced_weight (user_id, day, source, weight_kg, raw, synced_at)
          VALUES (${userId}, ${p.day}, ${p.source}, ${p.weightKg}, ${sql.json((p.raw ?? null) as never)}, now())
          ON CONFLICT (user_id, day, source) DO UPDATE SET weight_kg = EXCLUDED.weight_kg, raw = EXCLUDED.raw, synced_at = now()`;
      }
    },
    async getWeightRange(userId, start, end) {
      const rows = await sql<{ day: Date; source: DataSource; weight_kg: number; raw: unknown }[]>`
        SELECT day, source, weight_kg, raw FROM synced_weight
        WHERE user_id = ${userId} AND day >= ${start} AND day <= ${end} ORDER BY day ASC`;
      return rows.map((r) => ({ day: isoDay(r.day), source: r.source, weightKg: r.weight_kg, raw: r.raw }));
    },

    async coverage(userId): Promise<CoverageSnapshot> {
      // EVERY aggregate here filters on presence. The sync engine writes a row for every day it
      // *checked*, data or not (that is how the backfill knows where it has been), so an unfiltered
      // min(day) named a day that holds nothing — "Dane od 2019-07-16" for a day with no payload —
      // while `present_days` counted only real data. The in-memory fake always filtered, so the two
      // adapters disagreed and the tests could never see it (spec 019).
      //
      // Presence is `has_value`, not `data IS NOT NULL` (spec 072): Garmin answers a day it has
      // nothing for with a *present* object of all-null fields, and counting those is how a day the
      // watch never uploaded still read as "dzień z danymi". `COALESCE` keeps rows written before
      // the column existed on the old rule instead of blanking coverage until the next full sync.
      const metricRows = await sql<
        { metric: string; first_day: Date | null; last_day: Date | null; present_days: number }[]
      >`
        SELECT metric,
               min(day) FILTER (WHERE COALESCE(has_value, data IS NOT NULL)) AS first_day,
               max(day) FILTER (WHERE COALESCE(has_value, data IS NOT NULL)) AS last_day,
               count(*) FILTER (WHERE COALESCE(has_value, data IS NOT NULL))::int AS present_days
        FROM synced_metric_days WHERE user_id = ${userId} GROUP BY metric ORDER BY metric ASC`;
      const metrics: MetricCoverage[] = metricRows.map((r) => ({
        metric: r.metric as GarminMetricName,
        firstDay: r.first_day ? isoDay(r.first_day) : null,
        lastDay: r.last_day ? isoDay(r.last_day) : null,
        presentDays: r.present_days
      }));
      const actRows = await sql<
        {
          count: number;
          with_gps: number;
          with_workout_id: number;
          first_start: string | null;
          last_start: string | null;
          dist: number;
        }[]
      >`
        SELECT count(*)::int AS count, count(*) FILTER (WHERE has_gps)::int AS with_gps,
               count(*) FILTER (WHERE garmin_workout_id IS NOT NULL)::int AS with_workout_id,
               min(start_time_local) AS first_start, max(start_time_local) AS last_start,
               coalesce(sum(distance_m), 0)::float AS dist
        FROM synced_activities WHERE user_id = ${userId}`;
      const a = actRows[0]!;
      const wRows = await sql<{ count: number; first_day: Date | null; last_day: Date | null }[]>`
        SELECT count(*)::int AS count, min(day) AS first_day, max(day) AS last_day FROM synced_weight WHERE user_id = ${userId}`;
      const w = wRows[0]!;

      // Per-user row counts + a real on-disk footprint (whole synced_* tables; table size isn't
      // cheaply sliceable per user, so we report the tables' total bytes).
      const rowRows = await sql<{ metric_days: number; streams: number }[]>`
        SELECT
          (SELECT count(*) FROM synced_metric_days WHERE user_id = ${userId})::int AS metric_days,
          (SELECT count(*) FROM synced_activity_streams WHERE user_id = ${userId})::int AS streams`;
      const rc = rowRows[0]!;
      const sizeRows = await sql<{ bytes: string }[]>`
        SELECT coalesce(sum(pg_total_relation_size(c.oid)), 0)::bigint AS bytes
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname IN ('synced_metric_days', 'synced_activities', 'synced_activity_streams', 'synced_weight')`;
      const totalBytes = Number(sizeRows[0]?.bytes ?? 0);

      const earliestCandidates = [
        ...metrics.map((m) => m.firstDay),
        a.first_start ? a.first_start.slice(0, 10) : null,
        w.first_day ? isoDay(w.first_day) : null
      ].filter((d): d is string => !!d);

      return {
        metrics,
        activities: {
          count: a.count,
          withGps: a.with_gps,
          withWorkoutId: a.with_workout_id,
          firstStart: a.first_start,
          lastStart: a.last_start,
          totalDistanceM: a.dist
        },
        weight: {
          count: w.count,
          firstDay: w.first_day ? isoDay(w.first_day) : null,
          lastDay: w.last_day ? isoDay(w.last_day) : null
        },
        earliest: earliestCandidates.length ? earliestCandidates.sort()[0]! : null,
        // `staleDays` needs a clock, which the store does not have — the API layer fills it in.
        freshness: { lastDataDay: lastDataDayOf(metrics), staleDays: null },
        storage: {
          totalBytes,
          rows: { metricDays: rc.metric_days, activities: a.count, streams: rc.streams, weight: w.count }
        }
      };
    },

    async getSyncState(userId, source: DataSource) {
      const rows = await sql<
        {
          source: DataSource;
          cursor: Record<string, unknown>;
          last_full_sync_at: Date | null;
          last_sync_at: Date | null;
        }[]
      >`
        SELECT source, cursor, last_full_sync_at, last_sync_at FROM sync_state
        WHERE user_id = ${userId} AND source = ${source} LIMIT 1`;
      const r = rows[0];
      if (!r) return null;
      return {
        source: r.source,
        cursor: r.cursor ?? {},
        lastFullSyncAt: r.last_full_sync_at ? r.last_full_sync_at.toISOString() : null,
        lastSyncAt: r.last_sync_at ? r.last_sync_at.toISOString() : null
      };
    },
    async setSyncState(userId, state: SyncState) {
      await sql`
        INSERT INTO sync_state (user_id, source, cursor, last_full_sync_at, last_sync_at)
        VALUES (${userId}, ${state.source}, ${sql.json(state.cursor as never)}, ${state.lastFullSyncAt}, ${state.lastSyncAt})
        ON CONFLICT (user_id, source) DO UPDATE SET
          cursor = EXCLUDED.cursor, last_full_sync_at = EXCLUDED.last_full_sync_at, last_sync_at = EXCLUDED.last_sync_at`;
    },

    async startRun(input) {
      await sql`
        INSERT INTO sync_runs (id, user_id, kind, status, started_at, total, done)
        VALUES (${input.id}, ${input.userId}, ${input.kind}, 'running', ${input.startedAt}, ${input.total}, 0)`;
    },
    async updateRun(id, patch) {
      await sql`
        UPDATE sync_runs SET
          done = ${patch.done ?? sql`done`},
          total = ${patch.total ?? sql`total`},
          step = ${patch.step !== undefined ? patch.step : sql`step`},
          status = ${(patch.status as SyncRunStatus | undefined) ?? sql`status`},
          finished_at = ${patch.finishedAt !== undefined ? patch.finishedAt : sql`finished_at`},
          error = ${patch.error !== undefined ? patch.error : sql`error`},
          detail = ${patch.detail !== undefined ? sql.json(patch.detail as never) : sql`detail`}
        WHERE id = ${id}`;
    },
    async getRun(id) {
      const rows = await sql<SyncRunRow[]>`SELECT * FROM sync_runs WHERE id = ${id} LIMIT 1`;
      return rows[0] ? toRun(rows[0]) : null;
    },
    async getLatestRun(userId) {
      const rows = await sql<SyncRunRow[]>`
        SELECT * FROM sync_runs WHERE user_id = ${userId} ORDER BY started_at DESC LIMIT 1`;
      return rows[0] ? toRun(rows[0]) : null;
    },
    async failRunningRuns(reason, finishedAt) {
      const rows = await sql<{ id: string }[]>`
        UPDATE sync_runs SET status = 'failed', error = ${reason}, finished_at = ${finishedAt}
        WHERE status = 'running' RETURNING id`;
      return rows.length;
    }
  };
}

/** Columns of `authored_workouts`, in one place so SELECT/RETURNING can never drift apart. */
const AUTHORED_COLUMNS = [
  'id',
  'day',
  'time_local',
  'sport',
  'title',
  'steps',
  'note',
  'push_state',
  'push_error',
  'garmin_workout_id',
  'garmin_schedule_id',
  'content_pushed',
  'matched_activity_id',
  'created_at',
  'updated_at'
] as const;

interface AuthoredWorkoutRow {
  id: string;
  day: Date | string;
  time_local: string | null;
  sport: string;
  title: string;
  steps: unknown;
  note: string | null;
  push_state: string;
  push_error: string | null;
  garmin_workout_id: string | null;
  garmin_schedule_id: string | null;
  content_pushed: boolean;
  matched_activity_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const PUSH_STATES: readonly WorkoutPushState[] = ['pending', 'pushed', 'failed', 'unsupported'];

interface WorkoutTemplateRow {
  id: string;
  sport: string;
  title: string;
  steps: unknown;
  note: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

const TEMPLATE_COLUMNS = ['id', 'sport', 'title', 'steps', 'note', 'created_at', 'updated_at'];

function toTemplate(userId: string, r: WorkoutTemplateRow): WorkoutTemplate {
  return {
    id: r.id,
    userId,
    sport: r.sport,
    title: r.title,
    // Same degradation as `toAuthored`: a jsonb shape we did not write must not throw in a read path.
    steps: Array.isArray(r.steps) ? (r.steps as WorkoutStep[]) : [],
    note: r.note,
    createdAt: isoInstant(r.created_at),
    updatedAt: isoInstant(r.updated_at)
  };
}

function toAuthored(userId: string, r: AuthoredWorkoutRow): AuthoredWorkout {
  return {
    id: r.id,
    userId,
    day: isoDay(r.day),
    time: r.time_local,
    sport: r.sport,
    title: r.title,
    // The column is jsonb written from a validated tree; an unexpected shape degrades to no steps
    // rather than throwing inside a read path.
    steps: Array.isArray(r.steps) ? (r.steps as WorkoutStep[]) : [],
    note: r.note,
    pushState: PUSH_STATES.includes(r.push_state as WorkoutPushState)
      ? (r.push_state as WorkoutPushState)
      : 'pending',
    pushError: r.push_error,
    garminWorkoutId: r.garmin_workout_id,
    garminScheduleId: r.garmin_schedule_id,
    contentPushed: r.content_pushed,
    matchedActivityId: r.matched_activity_id,
    createdAt: isoInstant(r.created_at),
    updatedAt: isoInstant(r.updated_at)
  };
}

function isoInstant(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

interface TopEffortRow {
  distance_key: string;
  distance_m: number;
  duration_s: number;
  actual_m: number;
  pace_sec_per_km: number;
  start_s: number;
  samples: number;
  activity_id: string;
  activity_name: string | null;
  sport: string;
  day: Date | string;
}

/* ---- season goals (spec 060) ---- */

const GOAL_COLUMNS = [
  'id',
  'day',
  'sport',
  'title',
  'kind',
  'priority',
  'distance_m',
  'target_time_s',
  'target_ctl',
  'note',
  'source',
  'garmin_event_id',
  'created_at',
  'updated_at'
] as const;

interface SeasonGoalRow {
  id: string;
  day: Date | string;
  sport: string;
  title: string;
  kind: string;
  priority: string;
  distance_m: number | null;
  target_time_s: number | null;
  target_ctl: number | null;
  note: string | null;
  source: string;
  garmin_event_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const GOAL_KINDS: readonly GoalKind[] = ['race', 'fitness'];
const GOAL_PRIORITIES: readonly GoalPriority[] = ['a', 'b', 'c'];

function toGoal(userId: string, r: SeasonGoalRow): SeasonGoal {
  return {
    id: r.id,
    userId,
    day: isoDay(r.day),
    // Every enum-ish column degrades to its safe default rather than throwing inside a read path —
    // the same rule `toAuthored` follows for `push_state`.
    sport: isSportGroup(r.sport) ? r.sport : 'other',
    title: r.title,
    kind: GOAL_KINDS.includes(r.kind as GoalKind) ? (r.kind as GoalKind) : 'race',
    priority: GOAL_PRIORITIES.includes(r.priority as GoalPriority) ? (r.priority as GoalPriority) : 'a',
    distanceM: r.distance_m,
    targetTimeS: r.target_time_s,
    targetCtl: r.target_ctl,
    note: r.note,
    source: r.source === 'garmin' ? 'garmin' : 'manual',
    garminEventId: r.garmin_event_id,
    createdAt: isoInstant(r.created_at),
    updatedAt: isoInstant(r.updated_at)
  };
}

/* ---- training blocks (spec 073) ---- */

const BLOCK_COLUMNS = [
  'id',
  'goal_id',
  'name',
  'start_day',
  'weeks',
  'paces',
  'constraints',
  'note',
  'created_at',
  'updated_at'
] as const;

interface TrainingBlockRow {
  id: string;
  goal_id: string | null;
  name: string;
  start_day: Date | string;
  weeks: number;
  paces: unknown;
  constraints: unknown;
  note: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface TrainingBlockWeekRow {
  block_id: string;
  week_number: number;
  phase: string | null;
  volume_target_km: number | null;
  focus: string | null;
  note: string | null;
}

function toBlock(userId: string, r: TrainingBlockRow): TrainingBlock {
  return {
    id: r.id,
    userId,
    goalId: r.goal_id,
    name: r.name,
    startDay: isoDay(r.start_day),
    weeks: r.weeks,
    // jsonb columns degrade to empty rather than throwing inside a read path — the rule `toGoal`
    // follows for its enums. A block with a corrupt paces blob still reports its weeks.
    paces: (typeof r.paces === 'object' && r.paces !== null && !Array.isArray(r.paces)
      ? r.paces
      : {}) as BlockPaces,
    constraints: Array.isArray(r.constraints)
      ? (r.constraints as string[]).filter((c) => typeof c === 'string')
      : [],
    note: r.note,
    createdAt: isoInstant(r.created_at),
    updatedAt: isoInstant(r.updated_at)
  };
}

function toBlockWeek(r: TrainingBlockWeekRow): TrainingBlockWeek {
  return {
    blockId: r.block_id,
    weekNumber: r.week_number,
    phase: r.phase,
    volumeTargetKm: r.volume_target_km,
    focus: r.focus,
    note: r.note
  };
}

/* ---- subjective journal (spec 062) ---- */

const JOURNAL_COLUMNS = [
  'id',
  'day',
  'activity_id',
  'rpe',
  'soreness',
  'location',
  'mood',
  'note',
  'illness',
  'injury',
  'created_at',
  'updated_at'
] as const;

interface JournalRow {
  id: string;
  day: Date | string;
  activity_id: string | null;
  rpe: number | null;
  soreness: number | null;
  location: string | null;
  mood: number | null;
  note: string | null;
  illness: boolean;
  injury: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

function toJournal(userId: string, r: JournalRow): JournalEntry {
  return {
    id: r.id,
    userId,
    day: isoDay(r.day),
    activityId: r.activity_id,
    rpe: r.rpe,
    soreness: r.soreness,
    location: r.location,
    mood: r.mood,
    note: r.note,
    illness: r.illness,
    injury: r.injury,
    createdAt: isoInstant(r.created_at),
    updatedAt: isoInstant(r.updated_at)
  };
}

interface PlannedRow {
  event_id: string;
  day: Date | string;
  time_local: string | null;
  kind: string;
  title: string | null;
  sport: string | null;
  description: string | null;
  duration_s: number | null;
  distance_m: number | null;
  target_load: number | null;
  source: DataSource;
}

function toPlanned(r: PlannedRow): PlannedEvent {
  return {
    id: r.event_id,
    day: isoDay(r.day),
    time: r.time_local,
    kind: r.kind === 'race' || r.kind === 'note' ? r.kind : 'workout',
    title: r.title ?? '',
    sport: r.sport,
    description: r.description,
    estimatedDurationS: r.duration_s,
    estimatedDistanceM: r.distance_m,
    targetLoad: r.target_load,
    source: r.source
  };
}

interface SyncRunRow {
  id: string;
  user_id: string;
  kind: 'full' | 'incremental';
  status: SyncRunStatus;
  started_at: Date;
  finished_at: Date | null;
  total: number;
  done: number;
  step: string | null;
  error: string | null;
  detail: SyncRun['detail'];
}

function toRun(r: SyncRunRow): SyncRun {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind,
    status: r.status,
    startedAt: r.started_at instanceof Date ? r.started_at.toISOString() : String(r.started_at),
    finishedAt: r.finished_at ? r.finished_at.toISOString() : null,
    total: r.total,
    done: r.done,
    step: r.step,
    error: r.error,
    detail: r.detail ?? null
  };
}

/** Whitelisted ORDER BY (never interpolate user input into SQL text). */
function orderBy(sql: Sql, q: ListActivitiesQuery) {
  const dir = q.dir === 'asc' ? sql`ASC` : sql`DESC`;
  switch (q.sort) {
    case 'distance':
      return sql`distance_m ${dir} NULLS LAST`;
    case 'duration':
      return sql`duration_s ${dir} NULLS LAST`;
    default:
      return sql`start_time_local ${dir}`;
  }
}
