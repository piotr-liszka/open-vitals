/**
 * In-memory LocalStore fake (spec 015). Hermetic backing for tests and the `mock` runtime. Mirrors
 * the pg adapter's semantics: idempotent upserts, per-user isolation, same query/sort/coverage logic.
 */
import type { GarminMetricName, GarminMetricRange } from '../interfaces';
import { blockEndDay, blocksOverlap } from '../../blocks';
import { DuplicateGoalError, OverlappingBlockError, lastDataDayOf } from './types';
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
  NewTrainingBlock,
  PlannedEvent,
  RankedBestEffort,
  SeasonGoal,
  SeasonGoalPatch,
  NewWorkoutTemplate,
  JournalEntry,
  JournalEntryInput,
  ListJournalQuery,
  SorenessSignal,
  SyncRun,
  SyncState,
  TrainingBlock,
  TrainingBlockPatch,
  TrainingBlockWeek,
  TrainingBlockWeekInput,
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
  /**
   * Days the writer explicitly classified as holding NO reading (spec 072): `userId\0metric\0day`.
   * A set of the hollow ones rather than a flag on every day, so days never classified fall back to
   * `data != null` — exactly what `COALESCE(has_value, data IS NOT NULL)` does in the pg adapter.
   */
  const hollowDays = new Set<string>();
  // activities: userId -> Map<activityId, ActivitySummary>
  const activities = new Map<string, Map<string, ActivitySummary>>();
  // streams: userId\0activityId -> ActivityStreams
  const streams = new Map<string, ActivityStreams>();
  // best efforts (spec 054): userId\0activityId -> the activity's whole derived set. The pg adapter
  // keeps the version on the stream ROW and the efforts in their own table; here both ride along on
  // one entry, which `putStreams` drops — same observable semantics: rewriting streams un-derives the
  // efforts, version and rows together.
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
  // training blocks: userId\0id -> TrainingBlock (spec 073)
  const blocks = new Map<string, TrainingBlock>();
  // journal entries: userId\0id -> JournalEntry (spec 062)
  const journal = new Map<string, JournalEntry>();
  // per-week targets: blockId -> Map<weekNumber, TrainingBlockWeek> (spec 073)
  const blockWeeks = new Map<string, Map<number, TrainingBlockWeek>>();
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
      hollowDays.delete(key(userId, `${metric}\0${day}`));
    },
    async putMetricDays(userId, metric, days) {
      const m = metricMap(userId, metric);
      for (const { day, data, hasValue } of days) {
        m.set(day, data);
        const k = key(userId, `${metric}\0${day}`);
        if (hasValue === false) hollowDays.add(k);
        else hollowDays.delete(k);
      }
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
      // Parity with the pg adapter, which clears `efforts_v` AND deletes the derived rows in one
      // transaction: new samples, so any derived efforts are stale.
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

    async createBlock(userId, input: NewTrainingBlock): Promise<TrainingBlock> {
      const row: TrainingBlock = {
        id: input.id,
        userId,
        goalId: input.goalId,
        name: input.name,
        startDay: input.startDay,
        weeks: input.weeks,
        paces: input.paces,
        constraints: [...input.constraints],
        note: input.note,
        createdAt: input.createdAt,
        updatedAt: input.createdAt
      };
      // Mirrors the pg adapter's overlap guard: two live plans over the same days would force
      // `findBlockForDay` to pick one, and any rule for picking is a guess about which plan was meant.
      const clash = [...blocks.values()].find((b) => b.userId === userId && blocksOverlap(b, row));
      if (clash) throw new OverlappingBlockError(clash);
      blocks.set(key(userId, input.id), row);
      return structuredClone(row);
    },
    async getBlock(userId, id) {
      const row = blocks.get(key(userId, id));
      return row ? structuredClone(row) : null;
    },
    async listBlocks(userId, query = {}) {
      let list = [...blocks.values()].filter((b) => b.userId === userId);
      if (query.goalId) list = list.filter((b) => b.goalId === query.goalId);
      list.sort((a, b) => a.startDay.localeCompare(b.startDay) || a.id.localeCompare(b.id));
      return list.map((b) => structuredClone(b));
    },
    async findBlockForDay(userId, day) {
      const found = [...blocks.values()].find(
        (b) => b.userId === userId && day >= b.startDay && day <= blockEndDay(b)
      );
      return found ? structuredClone(found) : null;
    },
    async updateBlock(userId, id, patch: TrainingBlockPatch) {
      const k = key(userId, id);
      const current = blocks.get(k);
      if (!current) return null;
      // Only keys PRESENT in the patch are touched — `undefined` must not blank a column.
      const next: TrainingBlock = {
        ...current,
        ...(patch.goalId !== undefined ? { goalId: patch.goalId } : {}),
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.startDay !== undefined ? { startDay: patch.startDay } : {}),
        ...(patch.weeks !== undefined ? { weeks: patch.weeks } : {}),
        ...(patch.paces !== undefined ? { paces: patch.paces } : {}),
        ...(patch.constraints !== undefined ? { constraints: [...patch.constraints] } : {}),
        ...(patch.note !== undefined ? { note: patch.note } : {}),
        updatedAt: patch.updatedAt
      };
      const clash = [...blocks.values()].find(
        (b) => b.userId === userId && b.id !== id && blocksOverlap(b, next)
      );
      if (clash) throw new OverlappingBlockError(clash);
      blocks.set(k, next);
      /*
       * Shrinking a block drops the week rows the shrink removed. Keeping them would mean a block
       * lengthened again silently resurrects targets nobody re-approved.
       */
      const weeks = blockWeeks.get(id);
      if (weeks) for (const n of [...weeks.keys()]) if (n > next.weeks) weeks.delete(n);
      return structuredClone(next);
    },
    async deleteBlock(userId, id) {
      const k = key(userId, id);
      const current = blocks.get(k);
      if (!current) return null;
      blocks.delete(k);
      blockWeeks.delete(id); // the pg adapter gets this from ON DELETE CASCADE
      return structuredClone(current);
    },
    async listBlockWeeks(userId, blockId) {
      if (!blocks.get(key(userId, blockId))) return [];
      const weeks = blockWeeks.get(blockId);
      if (!weeks) return [];
      return [...weeks.values()].sort((a, b) => a.weekNumber - b.weekNumber).map((w) => structuredClone(w));
    },
    async putBlockWeeks(userId, blockId, weeks: readonly TrainingBlockWeekInput[]) {
      const block = blocks.get(key(userId, blockId));
      if (!block) return null;
      const map = blockWeeks.get(blockId) ?? new Map<number, TrainingBlockWeek>();
      blockWeeks.set(blockId, map);
      for (const input of weeks) {
        if (input.weekNumber < 1 || input.weekNumber > block.weeks) continue;
        const current = map.get(input.weekNumber);
        map.set(input.weekNumber, {
          blockId,
          weekNumber: input.weekNumber,
          phase: input.phase !== undefined ? input.phase : (current?.phase ?? null),
          volumeTargetKm:
            input.volumeTargetKm !== undefined ? input.volumeTargetKm : (current?.volumeTargetKm ?? null),
          focus: input.focus !== undefined ? input.focus : (current?.focus ?? null),
          note: input.note !== undefined ? input.note : (current?.note ?? null)
        });
      }
      return [...map.values()].sort((a, b) => a.weekNumber - b.weekNumber).map((w) => structuredClone(w));
    },

    async putJournalEntry(userId, input: JournalEntryInput): Promise<JournalEntry> {
      /*
       * Mirrors the pg adapter's NULLS NOT DISTINCT unique index: `(day, activityId)` identifies the
       * entry, with "no activity" a real value rather than a wildcard. Without this the day row
       * would be inserted afresh on every check-in instead of being corrected.
       */
      const existing = [...journal.values()].find(
        (e) => e.userId === userId && e.day === input.day && e.activityId === input.activityId
      );
      // Absent keys keep what is stored; an explicit null clears. Same three-valued rule as blocks.
      const next: JournalEntry = {
        id: existing?.id ?? input.id,
        userId,
        day: input.day,
        activityId: input.activityId,
        rpe: input.rpe !== undefined ? input.rpe : (existing?.rpe ?? null),
        soreness: input.soreness !== undefined ? input.soreness : (existing?.soreness ?? null),
        location: input.location !== undefined ? input.location : (existing?.location ?? null),
        mood: input.mood !== undefined ? input.mood : (existing?.mood ?? null),
        note: input.note !== undefined ? input.note : (existing?.note ?? null),
        illness: input.illness !== undefined ? input.illness : (existing?.illness ?? false),
        injury: input.injury !== undefined ? input.injury : (existing?.injury ?? false),
        createdAt: existing?.createdAt ?? input.at,
        updatedAt: input.at
      };
      journal.set(key(userId, next.id), next);
      return structuredClone(next);
    },
    async listJournalEntries(userId, query: ListJournalQuery = {}) {
      let list = [...journal.values()].filter((e) => e.userId === userId);
      if (query.from) list = list.filter((e) => e.day >= query.from!);
      if (query.to) list = list.filter((e) => e.day <= query.to!);
      // Day ascending, and within a day the day-level row before the session rows.
      list.sort(
        (a, b) =>
          a.day.localeCompare(b.day) ||
          (a.activityId ?? '').localeCompare(b.activityId ?? '') ||
          a.id.localeCompare(b.id)
      );
      const out = query.limit != null ? list.slice(0, query.limit) : list;
      return out.map((e) => structuredClone(e));
    },
    async getJournalEntry(userId, id) {
      const row = journal.get(key(userId, id));
      return row ? structuredClone(row) : null;
    },
    async deleteJournalEntry(userId, id) {
      const k = key(userId, id);
      const row = journal.get(k);
      if (!row) return null;
      journal.delete(k);
      return structuredClone(row);
    },
    async worstSoreness(userId, from, to, min): Promise<SorenessSignal | null> {
      const hits = [...journal.values()].filter(
        (e) => e.userId === userId && e.day >= from && e.day <= to && e.soreness !== null && e.soreness >= min
      );
      if (hits.length === 0) return null;
      // Worst first; ties go to the MORE RECENT day, because that is the one still true today.
      hits.sort((a, b) => b.soreness! - a.soreness! || b.day.localeCompare(a.day));
      const worst = hits[0]!;
      return { day: worst.day, soreness: worst.soreness!, location: worst.location };
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
      //
      // "Real data" also excludes a present-but-hollow payload (spec 072) — Garmin's all-null daily
      // summary for a day it has nothing for.
      let storedDayRows = 0;
      for (const [k, m] of metrics) {
        const [uid, metric] = k.split('\0');
        if (uid !== userId) continue;
        storedDayRows += m.size;
        const present = [...m.entries()]
          .filter(([d, v]) => v != null && !hollowDays.has(key(userId, `${metric}\0${d}`)))
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
        // `staleDays` needs a clock, which the store does not have — the API layer fills it in.
        freshness: { lastDataDay: lastDataDayOf(metricCov), staleDays: null },
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
