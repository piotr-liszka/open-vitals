/**
 * Training block handler (spec 073) — the plan's memory.
 *
 * `loadCurrentWeek` answers the one question every coaching conversation used to start by
 * re-deriving from 90 days of raw activities: which week of which plan is today, what was this week
 * supposed to be, and what has actually happened in it so far.
 *
 * Pure over injected deps (store + clock + random): no live Garmin, no `Date.now()`, no env.
 */
import type { Clock } from '$lib/server/clock';
import type { Random } from '$lib/server/random';
import {
  OverlappingBlockError,
  type ActivitySummary,
  type AuthoredWorkout,
  type LocalStore,
  type SeasonGoal,
  type TrainingBlock,
  type TrainingBlockWeek
} from '$lib/server/store/types';
import { daysOutTo, goalPhase } from '$lib/server/analytics/season';
import { todayKey, toDayKey, type DayKey } from '$lib/date';
import { sportLabel } from '$lib/sport-labels';
import { estimateWorkoutDistanceM, estimateWorkoutDurationS, type WorkoutStep } from '$lib/workouts';
import { blockEndDay, blocksOverlap, positionOf, startsInDays, weekBounds, weekNumberOf } from '$lib/blocks';
import { recentSoreness } from '$modules/journal/journal.api';
import { parseBlockPatch, parseNewBlock } from './block.validate';
import type {
  BlockSummary,
  BlockWeek,
  CurrentWeekData,
  HandlerResult,
  TrainingBlock as BlockType,
  WeekGoal,
  WeekSession
} from './block.types';

/** Week targets indexed by week number. Trivial, but it keeps the resolver readable. */
function weekTargetFor(targets: readonly TrainingBlockWeek[], weekNumber: number): TrainingBlockWeek | null {
  return targets.find((t) => t.weekNumber === weekNumber) ?? null;
}

export interface BlockDeps {
  store: LocalStore;
  clock: Clock;
  random: Random;
  /** IANA zone "today" resolves in — a UTC today lags the athlete by up to two hours (spec 018). */
  timeZone?: string;
}

/** The Polish phase labels the season view already uses — one phase, spelled one way, everywhere. */
const PHASE_LABELS: Readonly<Record<string, string>> = {
  done: 'Po starcie',
  'race-week': 'Tydzień startowy',
  taper: 'Tapering',
  peak: 'Szczyt formy',
  build: 'Budowanie',
  base: 'Baza',
  far: 'Daleko'
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

function labelFor(phase: string): string {
  return PHASE_LABELS[phase] ?? phase;
}

function today(deps: BlockDeps): DayKey {
  return todayKey(deps.clock, deps.timeZone);
}

/** The local calendar day an activity was trained on — `startTimeLocal` is wall clock, not UTC. */
function activityDay(a: ActivitySummary): DayKey {
  return toDayKey(a.startTimeLocal.slice(0, 10));
}

function sessionView(w: AuthoredWorkout): WeekSession {
  const steps = w.steps as readonly WorkoutStep[];
  return {
    id: w.id,
    day: w.day,
    time: w.time,
    sport: w.sport,
    sportLabel: sportLabel(w.sport),
    title: w.title,
    estimatedDistanceM: estimateWorkoutDistanceM(steps),
    estimatedDurationS: estimateWorkoutDurationS(steps),
    pushState: w.pushState,
    note: w.note
  };
}

/**
 * Resolve one week of a block against a day: targets, sessions and what has actually been run.
 *
 * Plan and reality come back in ONE payload on purpose. Splitting them into two calls is how the
 * coach ended up assembling the comparison by hand, which is exactly what this spec removes.
 */
async function resolveWeek(
  deps: BlockDeps,
  userId: string,
  block: TrainingBlock,
  day: DayKey,
  targets: readonly TrainingBlockWeek[],
  goal: SeasonGoal | null
): Promise<BlockWeek> {
  const weekNumber = weekNumberOf(block, day);
  const { start, end } = weekBounds(block, weekNumber);
  const target = weekTargetFor(targets, weekNumber);

  const [workouts, activities, soreness] = await Promise.all([
    deps.store.listWorkouts(userId, { from: start, to: end, limit: 100 }),
    deps.store.listActivities(userId, { from: start, to: end, limit: 500 }),
    // Measured from TODAY, not from the week bounds: "has anything hurt lately" is a question about
    // now, and asking it of a week already over would answer about the wrong seven days (spec 062).
    recentSoreness(
      { store: deps.store, clock: deps.clock, ...(deps.timeZone ? { timeZone: deps.timeZone } : {}) },
      userId,
      day
    )
  ]);

  /*
   * The phase falls back to the goal countdown (spec 060) so a block attached to a race gets its
   * phases without anyone typing them — but measured to the END of the week, not to today. A week is
   * planned as a unit, and "taper" that flips mid-week would describe two different weeks by one name.
   */
  const derived = goal ? goalPhase(daysOutTo(end, goal.day)) : 'far';
  const phase = target?.phase ?? derived;

  const volumeActualKm = round1(
    activities
      .filter((a) => activityDay(a) >= start && activityDay(a) <= end)
      .reduce((sum, a) => sum + (a.distanceM ?? 0), 0) / 1000
  );

  return {
    blockId: block.id,
    blockName: block.name,
    weekNumber,
    weeks: block.weeks,
    weekStart: start,
    weekEnd: end,
    position: positionOf(block, day),
    startsInDays: startsInDays(block, day),
    phase,
    phaseLabel: labelFor(phase),
    phaseDerived: target?.phase == null,
    volumeTargetKm: target?.volumeTargetKm ?? null,
    volumeActualKm,
    focus: target?.focus ?? null,
    note: target?.note ?? null,
    sessions: workouts.map(sessionView),
    paces: block.paces,
    constraints: block.constraints,
    goal: goal ? goalOf(goal, day) : null,
    soreness
  };
}

function goalOf(goal: SeasonGoal, day: DayKey): WeekGoal {
  return { id: goal.id, title: goal.title, day: goal.day, daysOut: daysOutTo(day, goal.day) };
}

async function goalFor(deps: BlockDeps, userId: string, block: TrainingBlock): Promise<SeasonGoal | null> {
  return block.goalId ? await deps.store.getGoal(userId, block.goalId) : null;
}

/**
 * The current week, or an honest empty payload.
 *
 * When no block covers today we do NOT fall back to the nearest one. A plan that silently reports
 * last winter's block as "this week" is worse than saying there is no block: the athlete would act
 * on it.
 */
export async function loadCurrentWeek(deps: BlockDeps, userId: string): Promise<CurrentWeekData> {
  const day = today(deps);
  const block = await deps.store.findBlockForDay(userId, day);
  if (!block) return { today: day, block: null, week: null };
  const [targets, goal] = await Promise.all([
    deps.store.listBlockWeeks(userId, block.id),
    goalFor(deps, userId, block)
  ]);
  return { today: day, block, week: await resolveWeek(deps, userId, block, day, targets, goal) };
}

/** Every block, with its span resolved. Used by the list tool and the settings surface. */
export async function listBlockSummaries(
  deps: BlockDeps,
  userId: string,
  query: { goalId?: string } = {}
): Promise<{ today: DayKey; blocks: BlockSummary[] }> {
  const day = today(deps);
  const blocks = await deps.store.listBlocks(userId, query);
  const summaries = await Promise.all(
    blocks.map(async (block) => {
      const position = positionOf(block, day);
      return {
        block,
        endDay: blockEndDay(block),
        position,
        currentWeek: position === 'live' ? weekNumberOf(block, day) : null,
        weekTargets: await deps.store.listBlockWeeks(userId, block.id)
      };
    })
  );
  return { today: day, blocks: summaries };
}

export async function createBlock(
  deps: BlockDeps,
  userId: string,
  body: unknown
): Promise<HandlerResult<{ block: BlockType }>> {
  const parsed = parseNewBlock(body);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  const input = parsed.value;

  if (input.goalId) {
    const goal = await deps.store.getGoal(userId, input.goalId);
    if (!goal) return { ok: false, status: 400, error: 'nie ma celu o tym identyfikatorze' };
  }

  /*
   * Overlap is checked here for the MESSAGE and again in the store for the RACE. The validator can
   * name the block in the way; only a constraint inside the write can stop two concurrent creates.
   */
  const existing = await deps.store.listBlocks(userId);
  const clash = existing.find((b) => blocksOverlap(b, input));
  if (clash) {
    return {
      ok: false,
      status: 400,
      error: `te tygodnie należą już do bloku „${clash.name}" (${clash.startDay}, ${clash.weeks} tyg.)`
    };
  }

  try {
    const block = await deps.store.createBlock(userId, {
      id: `tb_${deps.random.token(12)}`,
      goalId: input.goalId,
      name: input.name,
      startDay: input.startDay,
      weeks: input.weeks,
      paces: input.paces,
      constraints: input.constraints,
      note: input.note,
      createdAt: deps.clock.now().toISOString()
    });
    return { ok: true, block };
  } catch (err) {
    if (err instanceof OverlappingBlockError) {
      return { ok: false, status: 400, error: err.message };
    }
    throw err;
  }
}

export async function patchBlock(
  deps: BlockDeps,
  userId: string,
  id: string,
  body: unknown
): Promise<HandlerResult<{ block: BlockType; weekTargets: readonly TrainingBlockWeek[] }>> {
  const current = await deps.store.getBlock(userId, id);
  if (!current) return { ok: false, status: 404, error: 'nie ma bloku o tym identyfikatorze' };

  const parsed = parseBlockPatch(body, current.weeks);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  const patch = parsed.value;

  if (patch.goalId) {
    const goal = await deps.store.getGoal(userId, patch.goalId);
    if (!goal) return { ok: false, status: 400, error: 'nie ma celu o tym identyfikatorze' };
  }

  // Moving or lengthening a block can push it into another one; check against every block but itself.
  if (patch.startDay !== undefined || patch.weeks !== undefined) {
    const span = { startDay: patch.startDay ?? current.startDay, weeks: patch.weeks ?? current.weeks };
    const others = (await deps.store.listBlocks(userId)).filter((b) => b.id !== id);
    const clash = others.find((b) => blocksOverlap(b, span));
    if (clash) {
      return {
        ok: false,
        status: 400,
        error: `te tygodnie należą już do bloku „${clash.name}" (${clash.startDay}, ${clash.weeks} tyg.)`
      };
    }
  }

  const { weekTargets, ...fields } = patch;
  const updatedAt = deps.clock.now().toISOString();

  let block = current;
  if (Object.keys(fields).length > 0) {
    const next = await deps.store.updateBlock(userId, id, { ...fields, updatedAt });
    if (!next) return { ok: false, status: 404, error: 'nie ma bloku o tym identyfikatorze' };
    block = next;
  }

  let targets = await deps.store.listBlockWeeks(userId, id);
  if (weekTargets && weekTargets.length > 0) {
    const written = await deps.store.putBlockWeeks(userId, id, weekTargets);
    if (!written) return { ok: false, status: 404, error: 'nie ma bloku o tym identyfikatorze' };
    targets = written;
  }

  return { ok: true, block, weekTargets: targets };
}

export async function removeBlock(
  deps: BlockDeps,
  userId: string,
  id: string
): Promise<HandlerResult<{ deleted: BlockType }>> {
  const deleted = await deps.store.deleteBlock(userId, id);
  if (!deleted) return { ok: false, status: 404, error: 'nie ma bloku o tym identyfikatorze' };
  return { ok: true, deleted };
}
