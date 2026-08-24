/**
 * In-memory LocalStore fake (spec 015). Hermetic backing for tests and the `mock` runtime. Mirrors
 * the pg adapter's semantics: idempotent upserts, per-user isolation, same query/sort/coverage logic.
 */
import type { GarminMetricName, GarminMetricRange } from '../interfaces';
import { DuplicateGoalError } from './types';
import type {
  ActivityBestEfforts,
  ActivityStreams,
  ActivitySummary,
  AuthoredWorkout,
  AuthoredWorkoutPatch,
  CoverageSnapshot,
  DataSource,
  ListActivitiesQuery,
  ListGoalsQuery,
  ListWorkoutsQuery,
  LocalStore,
  MetricCoverage,
  NewAuthoredWorkout,
  NewSeasonGoal,
  PlannedEvent,
  RankedBestEffort,
  SeasonGoal,
  SeasonGoalPatch,
  NewWorkoutTemplate,
  SyncRun,
  SyncState,
  WeightPoint,
  WorkoutTemplate,
  WorkoutTemplatePatch
} from './types';

const key = (a: string, b: string): string => `${a}\0${b}`;

function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d.getTime() <= last.getTime()) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** local `YYYY-MM-DD HH:MM:SS` (or ISO) → `YYYY-MM-DD`. */
const localDay = (s: string): string => s.slice(0, 10);

/** Leaderboard order (spec 054): fastest first, ties to the EARLIER day, then a stable id tiebreak. */
const rankOrder = (a: RankedBestEffort, b: RankedBestEffort): number =>
  a.durationS - b.durationS || a.day.localeCompare(b.day) || a.activityId.localeCompare(b.activityId);

export function createMemoryStore(): LocalStore {
  // metric day: userId\0metric -> Map<day, data>
  const metrics = new Map<string, Map<string, unknown>>();
  // activities: userId -> Map<activityId, ActivitySummary>
  const activities = new Map<string, Map<string, ActivitySummary>>();
  // streams: userId\0activityId -> ActivityStreams
  const streams = new Map<string, ActivityStreams>();
  // best efforts (spec 054): userId\0activityId -> the activity's whole derived set. The pg adapter
  // keeps the version on the stream ROW; here it rides along on the entry, and `putStreams` drops the
  // entry entirely — same observable semantics: rewriting streams un-derives the efforts.
  const bestEffortsByActivity = new Map<string, ActivityBestEfforts>();
  // weight: userId -> Map<`${day}\0${source}`, WeightPoint>
  const weights = new Map<string, Map<string, WeightPoint>>();
  // planned events: userId -> PlannedEvent[] (spec 024)
  const planned = new Map<string, PlannedEvent[]>();
  // authored workouts: userId\0id -> AuthoredWorkout (spec 050)
  const authored = new Map<string, AuthoredWorkout>();
  /** Reusable sessions (spec 069) — the library, keyed by id like `authored`. */
  const templates = new Map<string, WorkoutTemplate>();
  // season goals: userId\0id -> SeasonGoal (spec 060)
  const goals = new Map<string, SeasonGoal>();
  const syncState = new Map<string, SyncState>(); // userId\0source
  const runs = new Map<string, SyncRun>();

  const metricMap = (userId: string, metric: string): Map<string, unknown> => {
    const k = key(userId, metric);
    let m = metrics.get(k);
    if (!m) metrics.set(k, (m = new Map()));
    return m;
  };
  const actMap = (userId: string): Map<string, ActivitySummary> => {
    let m = activities.get(userId);
    if (!m) activities.set(userId, (m = new Map()));
    return m;
  };
  const plannedList = (userId: string): PlannedEvent[] => planned.get(userId) ?? [];
  const weightMap = (userId: string): Map<string, WeightPoint> => {
    let m = weights.get(userId);
    if (!m) weights.set(userId, (m = new Map()));
    return m;
  };

  function filterActs(userId: string, q: ListActivitiesQuery = {}): ActivitySummary[] {
    let list = [...actMap(userId).values()];
    if (q.sport) list = list.filter((a) => a.sport === q.sport);
    if (q.sports) {
      const allowed = new Set(q.sports);
      list = list.filter((a) => allowed.has(a.sport));
    }
    if (q.from) list = list.filter((a) => localDay(a.startTimeLocal) >= q.from!);
    if (q.to) list = list.filter((a) => localDay(a.startTimeLocal) <= q.to!);
    if (q.search) {
      const needle = q.search.toLowerCase();
      list = list.filter(
        (a) => (a.name ?? '').toLowerCase().includes(needle) || a.sport.toLowerCase().includes(needle)
      );
    }
    const sort = q.sort ?? 'date';
    const dir = q.dir ?? 'desc';
    const cmp = (a: ActivitySummary, b: ActivitySummary): number => {
      const va =
        sort === 'distance'
          ? (a.distanceM ?? 0)
          : sort === 'duration'
            ? (a.durationS ?? 0)
            : a.startTimeLocal;
      const vb =
        sort === 'distance'
          ? (b.distanceM ?? 0)
          : sort === 'duration'
            ? (b.durationS ?? 0)
            : b.startTimeLocal;
      const r = va < vb ? -1 : va > vb ? 1 : 0;
      return dir === 'asc' ? r : -r;
    };
    list.sort(cmp);
    return list;
  }

  return {
    async putMetricDay(userId, metric, day, data) {
      metricMap(userId, metric).set(day, data);
    },
    async putMetricDays(userId, metric, days) {
      const m = metricMap(userId, metric);
      for (const { day, data } of days) m.set(day, data);
    },
    async getMetricDay(userId, metric, day) {
      return metricMap(userId, metric).get(day) ?? null;
    },
    async getMetricRange(userId, metric: GarminMetricName, start, end): Promise<GarminMetricRange> {
      const m = metricMap(userId, metric);
      return {
        metric,
        start,
        end,
        days: eachDay(start, end).map((day) => ({ date: day, data: m.get(day) ?? null }))
      };
    },

    async putActivities(userId, list) {
      const m = actMap(userId);
      for (const a of list) m.set(a.activityId, a);
    },
    async getActivity(userId, activityId) {
      return actMap(userId).get(activityId) ?? null;
    },
    async listActivities(userId, query = {}) {
      const all = filterActs(userId, query);
      const offset = query.offset ?? 0;
      const limit = query.limit ?? all.length;
      // Parity with the pg adapter: bulk list reads omit the heavy `raw` blob (detail uses getActivity).
      return all.slice(offset, offset + limit).map((a) => ({ ...a, raw: null }));
    },
    async countActivities(userId, query = {}) {
      return filterActs(userId, query).length;
    },
    async listSports(userId) {
      // Parity with the pg adapter: counts, most frequent first, ties broken by key (spec 020).
      const counts = new Map<string, number>();
      for (const a of actMap(userId).values()) counts.set(a.sport, (counts.get(a.sport) ?? 0) + 1);
      return [...counts.entries()]
        .map(([sport, count]) => ({ sport, count }))
        .sort((x, y) => y.count - x.count || x.sport.localeCompare(y.sport));
    },

    async putStreams(userId, activityId, s) {
      streams.set(key(userId, activityId), s);
      // Parity with the pg adapter's `efforts_v = NULL`: new samples, so any derived efforts are stale.
      bestEffortsByActivity.delete(key(userId, activityId));
    },
    async getStreams(userId, activityId) {
      return streams.get(key(userId, activityId)) ?? null;
    },
    async listStreamVersions(userId) {
      const out = new Map<string, number>();
      // Derive the prefix from the same `key` helper so this cannot drift if the separator changes.
      const prefix = key(userId, '');
      for (const [k, s] of streams) {
        if (!k.startsWith(prefix)) continue;
        out.set(k.slice(prefix.length), typeof s.v === 'number' ? s.v : 0);
      }
      return out;
    },
    async getStreamField(userId, activityIds, field) {
      const out = new Map<string, number[]>();
      for (const id of activityIds) {
        const s = streams.get(key(userId, id));
        const arr = s?.[field];
        if (Array.isArray(arr) && arr.length > 0) out.set(id, arr as number[]);
      }
      return out;
    },
    async listGpsTracks(userId, query = {}) {
      const out: Array<{
        activityId: string;
        sport: string;
        startTimeLocal: string;
        gps: ActivityStreams['gps'];
      }> = [];
      for (const a of actMap(userId).values()) {
        if (query.sport && a.sport !== query.sport) continue;
        if (query.year && Number(localDay(a.startTimeLocal).slice(0, 4)) !== query.year) continue;
        const s = streams.get(key(userId, a.activityId));
        if (s?.gps && s.gps.length > 0)
          out.push({
            activityId: a.activityId,
            sport: a.sport,
            startTimeLocal: a.startTimeLocal,
            gps: s.gps
          });
      }
      return out;
    },

    async putActivityBestEfforts(userId, input: ActivityBestEfforts) {
      // Whole-set replace, exactly like the pg adapter: distances a re-derivation no longer finds
      // must disappear, and re-running the derivation must not accumulate rows.
      bestEffortsByActivity.set(key(userId, input.activityId), {
        ...input,
        efforts: input.efforts.map((e) => ({ ...e }))
      });
    },
    async listBestEffortVersions(userId) {
      const out = new Map<string, number>();
      const prefix = key(userId, '');
      // Keyed off the STREAM rows, like the pg column: an activity with no streams is absent, which
      // is what tells the backfill to skip it instead of retrying it every tick.
      for (const k of streams.keys()) {
        if (!k.startsWith(prefix)) continue;
        const activityId = k.slice(prefix.length);
        out.set(activityId, bestEffortsByActivity.get(k)?.version ?? 0);
      }
      return out;
    },
    async listTopBestEfforts(userId, query) {
      const allowed = query.sports ? new Set(query.sports) : null;
      const acts = actMap(userId);
      const rows: RankedBestEffort[] = [];
      const prefix = key(userId, '');
      for (const [k, entry] of bestEffortsByActivity) {
        if (!k.startsWith(prefix)) continue;
        if (allowed && !allowed.has(entry.sport)) continue;
        // As-of bound (spec 057) applied BEFORE ranking, exactly like the pg WHERE clause: the
        // top-N must be the top-N of the subset, not a filtered slice of the all-time top-N.
        if (query.until && entry.day > query.until) continue;
        const activity = acts.get(entry.activityId);
        // Mirrors the pg adapter's INNER JOIN: an effort whose activity is gone is not a row.
        if (!activity) continue;
        for (const e of entry.efforts) {
          rows.push({
            ...e,
            activityId: entry.activityId,
            activityName: activity.name,
            sport: entry.sport,
            day: entry.day
          });
        }
      }
      const byKey = new Map<string, RankedBestEffort[]>();
      for (const r of rows) {
        const bucket = byKey.get(r.key);
        if (bucket) bucket.push(r);
        else byKey.set(r.key, [r]);
      }
      const kept: RankedBestEffort[] = [];
      for (const bucket of byKey.values()) {
        bucket.sort(rankOrder);
        kept.push(...bucket.slice(0, query.limit));
      }
      // Same output order as the pg query: distance ascending, then fastest first.
      kept.sort((a, b) => a.metres - b.metres || rankOrder(a, b));
      return kept;
    },

    async replacePlannedEvents(userId, from, to, events) {
      // Same semantics as the pg adapter: the window is REPLACED, so a plan deleted upstream goes.
      const kept = plannedList(userId).filter((e) => e.day < from || e.day > to);
      planned.set(userId, [...kept, ...events]);
    },
    async listPlannedEvents(userId, from, to) {
      return plannedList(userId)
        .filter((e) => e.day >= from && e.day <= to)
        .sort(
          (a, b) =>
            a.day.localeCompare(b.day) ||
            (a.time ?? '').localeCompare(b.time ?? '') ||
            a.id.localeCompare(b.id)
        );
    },

    async createWorkout(userId, input: NewAuthoredWorkout): Promise<AuthoredWorkout> {
      const row: AuthoredWorkout = {
        id: input.id,
        userId,
        day: input.day,
        time: input.time,
        sport: input.sport,
        title: input.title,
        // Copied, so a caller mutating its input can never rewrite stored history.
        steps: structuredClone(input.steps) as AuthoredWorkout['steps'],
        note: input.note,
        pushState: 'pending',
        pushError: null,
        garminWorkoutId: null,
        garminScheduleId: null,
        matchedActivityId: null,
        createdAt: input.createdAt,
        updatedAt: input.createdAt
      };
      authored.set(key(userId, input.id), row);
      return row;
    },
    async getWorkout(userId, id) {
      return authored.get(key(userId, id)) ?? null;
    },
    async listWorkouts(userId, query: ListWorkoutsQuery = {}) {
      let list = [...authored.values()].filter((w) => w.userId === userId);
      if (query.from) list = list.filter((w) => w.day >= query.from!);
      if (query.to) list = list.filter((w) => w.day <= query.to!);
      if (query.pushState) list = list.filter((w) => w.pushState === query.pushState);
      list.sort(
        (a, b) =>
          a.day.localeCompare(b.day) ||
          (a.time ?? '').localeCompare(b.time ?? '') ||
          a.createdAt.localeCompare(b.createdAt) ||
          a.id.localeCompare(b.id)
      );
      return query.limit != null ? list.slice(0, query.limit) : list;
    },
    async updateWorkout(userId, id, patch: AuthoredWorkoutPatch) {
      const k = key(userId, id);
      const current = authored.get(k);
      if (!current) return null;
      // Only keys PRESENT in the patch are touched — `undefined` must not blank a column, or a
      // push-state update would wipe the workout's own content.
      const next: AuthoredWorkout = {
        ...current,
        ...(patch.day !== undefined ? { day: patch.day } : {}),
        ...(patch.time !== undefined ? { time: patch.time } : {}),
        ...(patch.sport !== undefined ? { sport: patch.sport } : {}),
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.steps !== undefined
          ? { steps: structuredClone(patch.steps) as AuthoredWorkout['steps'] }
          : {}),
        ...(patch.note !== undefined ? { note: patch.note } : {}),
        ...(patch.pushState !== undefined ? { pushState: patch.pushState } : {}),
        ...(patch.pushError !== undefined ? { pushError: patch.pushError } : {}),
        ...(patch.garminWorkoutId !== undefined ? { garminWorkoutId: patch.garminWorkoutId } : {}),
        ...(patch.garminScheduleId !== undefined ? { garminScheduleId: patch.garminScheduleId } : {}),
        ...(patch.matchedActivityId !== undefined ? { matchedActivityId: patch.matchedActivityId } : {}),
        updatedAt: patch.updatedAt
      };
      authored.set(k, next);
      return next;
    },
    async deleteWorkout(userId, id) {
      const k = key(userId, id);
      const current = authored.get(k);
      if (!current) return null;
      authored.delete(k);
      return current;
    },

    /* ---- workout library (spec 069) ---- */
    async createWorkoutTemplate(userId, input: NewWorkoutTemplate): Promise<WorkoutTemplate> {
      const row: WorkoutTemplate = {
        id: input.id,
        userId,
        sport: input.sport,
        title: input.title,
        // Copied on the way in AND on the way out, so neither the caller nor a consumer can reach
        // back into stored state through the array they handed us or were given.
        steps: structuredClone(input.steps) as WorkoutTemplate['steps'],
        note: input.note,
        createdAt: input.createdAt,
        updatedAt: input.createdAt
      };
      templates.set(row.id, row);
      return structuredClone(row);
    },

    async getWorkoutTemplate(userId, id): Promise<WorkoutTemplate | null> {
      const row = templates.get(id);
      return row && row.userId === userId ? structuredClone(row) : null;
    },

    async listWorkoutTemplates(userId): Promise<WorkoutTemplate[]> {
      return [...templates.values()]
        .filter((t) => t.userId === userId)
        .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
        .map((t) => structuredClone(t));
    },

    async findWorkoutTemplateByTitle(userId, sport, title): Promise<WorkoutTemplate | null> {
      const wanted = title.trim().toLowerCase();
      const row = [...templates.values()].find(
        (t) => t.userId === userId && t.sport === sport && t.title.trim().toLowerCase() === wanted
      );
      return row ? structuredClone(row) : null;
    },

    async updateWorkoutTemplate(userId, id, patch: WorkoutTemplatePatch): Promise<WorkoutTemplate | null> {
      const row = templates.get(id);
      if (!row || row.userId !== userId) return null;
      const next: WorkoutTemplate = {
        ...row,
        ...(patch.sport === undefined ? {} : { sport: patch.sport }),
        ...(patch.title === undefined ? {} : { title: patch.title }),
        ...(patch.steps === undefined
          ? {}
          : { steps: structuredClone(patch.steps) as WorkoutTemplate['steps'] }),
        ...(patch.note === undefined ? {} : { note: patch.note }),
        updatedAt: patch.updatedAt
      };
      templates.set(id, next);
      return structuredClone(next);
    },

    async deleteWorkoutTemplate(userId, id): Promise<WorkoutTemplate | null> {
      const row = templates.get(id);
      if (!row || row.userId !== userId) return null;
      templates.delete(id);
      return structuredClone(row);
    },

    async createGoal(userId, input: NewSeasonGoal): Promise<SeasonGoal> {
      // Mirrors the pg adapter's partial unique index: the same synced race can only ever become one
      // goal, however two imports race.
      if (input.garminEventId !== null) {
        const clash = [...goals.values()].find(
          (g) => g.userId === userId && g.garminEventId === input.garminEventId
        );
        if (clash) throw new DuplicateGoalError(input.garminEventId);
      }
      const row: SeasonGoal = {
        id: input.id,
        userId,
        day: input.day,
        sport: input.sport,
        title: input.title,
        kind: input.kind,
        priority: input.priority,
        distanceM: input.distanceM,
        targetTimeS: input.targetTimeS,
        targetCtl: input.targetCtl,
        note: input.note,
        source: input.source,
        garminEventId: input.garminEventId,
        createdAt: input.createdAt,
        updatedAt: input.createdAt
      };
      goals.set(key(userId, input.id), row);
      return row;
    },
    async getGoal(userId, id) {
      return goals.get(key(userId, id)) ?? null;
    },
    async listGoals(userId, query: ListGoalsQuery = {}) {
      let list = [...goals.values()].filter((g) => g.userId === userId);
      if (query.from) list = list.filter((g) => g.day >= query.from!);
      if (query.to) list = list.filter((g) => g.day <= query.to!);
      if (query.sport) list = list.filter((g) => g.sport === query.sport);
      list.sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));
      return query.limit != null ? list.slice(0, query.limit) : list;
    },
    async updateGoal(userId, id, patch: SeasonGoalPatch) {
      const k = key(userId, id);
      const current = goals.get(k);
      if (!current) return null;
      // Only keys PRESENT in the patch are touched — `undefined` must not blank a column.
      const next: SeasonGoal = {
        ...current,
        ...(patch.day !== undefined ? { day: patch.day } : {}),
        ...(patch.sport !== undefined ? { sport: patch.sport } : {}),
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.distanceM !== undefined ? { distanceM: patch.distanceM } : {}),
        ...(patch.targetTimeS !== undefined ? { targetTimeS: patch.targetTimeS } : {}),
        ...(patch.targetCtl !== undefined ? { targetCtl: patch.targetCtl } : {}),
        ...(patch.note !== undefined ? { note: patch.note } : {}),
        updatedAt: patch.updatedAt
      };
      goals.set(k, next);
      return next;
    },
    async deleteGoal(userId, id) {
      const k = key(userId, id);
      const current = goals.get(k);
      if (!current) return null;
      goals.delete(k);
      return current;
    },

    async putWeight(userId, points) {
      const m = weightMap(userId);
      for (const p of points) m.set(key(p.day, p.source), p);
    },
    async getWeightRange(userId, start, end) {
      return [...weightMap(userId).values()]
        .filter((p) => p.day >= start && p.day <= end)
        .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    },

    async coverage(userId): Promise<CoverageSnapshot> {
      const metricCov: MetricCoverage[] = [];
      // Rows the store holds for this user, INCLUDING the null-payload days the backfill writes to
      // remember where it has been. `presentDays`/`firstDay`/`lastDay` count only real data (a day
      // holding nothing must never be advertised as "Dane od"); this counts storage. Both adapters
      // must answer identically — see coverage-contract.test.ts.
      let storedDayRows = 0;
      for (const [k, m] of metrics) {
        const [uid, metric] = k.split('\0');
        if (uid !== userId) continue;
        storedDayRows += m.size;
        const present = [...m.entries()]
          .filter(([, v]) => v != null)
          .map(([d]) => d)
          .sort();
        metricCov.push({
          metric: metric as GarminMetricName,
          firstDay: present[0] ?? null,
          lastDay: present[present.length - 1] ?? null,
          presentDays: present.length
        });
      }
      metricCov.sort((a, b) => a.metric.localeCompare(b.metric));

      const acts = [...actMap(userId).values()];
      const starts = acts.map((a) => a.startTimeLocal).sort();
      const w = [...weightMap(userId).values()].map((p) => p.day).sort();

      // "data since" = earliest day across metrics / activities / weight.
      const candidates = [
        ...metricCov.map((m) => m.firstDay),
        starts[0] ? starts[0].slice(0, 10) : null,
        w[0] ?? null
      ].filter((d): d is string => !!d);
      const earliest = candidates.length ? candidates.sort()[0]! : null;

      // Rough byte estimate from JSON size (the pg adapter reports real table bytes).
      let streamRows = 0;
      let bytes = 0;
      for (const [k, s] of streams) {
        // Same `key` helper as every write — a hardcoded separator here silently counted zero rows.
        if (k.startsWith(key(userId, ''))) {
          streamRows++;
          bytes += JSON.stringify(s).length;
        }
      }
      const metricDaysRows = storedDayRows;
      bytes += JSON.stringify(acts).length + metricDaysRows * 200 + w.length * 80;

      return {
        metrics: metricCov,
        activities: {
          count: acts.length,
          withGps: acts.filter((a) => a.hasGps).length,
          firstStart: starts[0] ?? null,
          lastStart: starts[starts.length - 1] ?? null,
          totalDistanceM: acts.reduce((s, a) => s + (a.distanceM ?? 0), 0)
        },
        weight: { count: w.length, firstDay: w[0] ?? null, lastDay: w[w.length - 1] ?? null },
        earliest,
        storage: {
          totalBytes: bytes,
          rows: { metricDays: metricDaysRows, activities: acts.length, streams: streamRows, weight: w.length }
        }
      };
    },

    async getSyncState(userId, source: DataSource) {
      return syncState.get(key(userId, source)) ?? null;
    },
    async setSyncState(userId, state) {
      syncState.set(key(userId, state.source), state);
    },

    async startRun(input) {
      runs.set(input.id, {
        id: input.id,
        userId: input.userId,
        kind: input.kind,
        status: 'running',
        startedAt: input.startedAt,
        finishedAt: null,
        total: input.total,
        done: 0,
        step: null,
        error: null,
        detail: null
      });
    },
    async updateRun(id, patch) {
      const cur = runs.get(id);
      if (!cur) return;
      runs.set(id, { ...cur, ...patch });
    },
    async getRun(id) {
      return runs.get(id) ?? null;
    },
    async failRunningRuns(reason, finishedAt) {
      let healed = 0;
      for (const [id, r] of runs) {
        if (r.status === 'running') {
          runs.set(id, { ...r, status: 'failed', error: reason, finishedAt });
          healed++;
        }
      }
      return healed;
    },
    async getLatestRun(userId) {
      return (
        [...runs.values()]
          .filter((r) => r.userId === userId)
          .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))[0] ?? null
      );
    }
  };
}
