/**
 * Training-block tools (spec 073) — the part of the MCP surface that remembers the plan.
 *
 * `get_goal_plan` (spec 060) knows the phase because it derives it from the countdown to a race. It
 * does not know THIS athlete's plan: that week 7 is 2×10 min at threshold, that volume should land
 * at 34 km, that there are four runs a week and no bike in winter. Without that, every conversation
 * re-derives the state of the block from 90 days of raw activities and gets a slightly different
 * answer each time.
 *
 * The write tools go through the SAME validator the HTTP boundary uses, the rule spec 060 set: a
 * block created by an assistant is held to exactly what a block typed into the form is.
 */
import { z } from 'zod';
import type { Clock } from '../server/clock';
import type { Random } from '../server/random';
import type { LocalStore, TrainingBlockWeek } from '../server/store/types';
import {
  createBlock,
  listBlockSummaries,
  loadCurrentWeek,
  patchBlock,
  removeBlock,
  type BlockDeps
} from '$modules/block/block.api';
import { loadWeekReview, type WeekReviewDeps } from '$modules/week-review/week-review.api';
import type { BlockWeek } from '$modules/block/block.types';
import type { ToolResult } from './tools';

/** Everything the block tools need. All injected (AGENTS.md §2 rule 4). */
export interface BlockToolDeps {
  store: LocalStore;
  /** The ONE user these tools may touch — resolved from the MCP token, never from an argument. */
  userId: string;
  clock: Clock;
  random: Random;
  timeZone?: string;
}

export interface BlockTool {
  name: string;
  description: string;
  inputShape: z.ZodRawShape;
  handler(deps: BlockToolDeps, args: Record<string, unknown>): Promise<ToolResult>;
}

function text(value: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }]
  };
}

function errorText(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

const api = (deps: BlockToolDeps): BlockDeps => ({
  store: deps.store,
  clock: deps.clock,
  random: deps.random,
  ...(deps.timeZone ? { timeZone: deps.timeZone } : {})
});

const paceRangeArg = z.object({
  lowS: z.number().positive().describe('fast end, seconds per km'),
  highS: z.number().positive().describe('slow end, seconds per km')
});

const pacesArg = z
  .object({
    easy: paceRangeArg.nullish(),
    long: paceRangeArg.nullish(),
    threshold: paceRangeArg.nullish(),
    interval: paceRangeArg.nullish(),
    goal: paceRangeArg.nullish()
  })
  .describe('Pace bands in SECONDS PER KILOMETRE. 6:10/km is 370.');

const weekTargetArg = z.object({
  weekNumber: z.number().int().min(1),
  phase: z.string().max(40).nullish(),
  volumeTargetKm: z.number().positive().nullish(),
  focus: z.string().max(200).nullish().describe('What the week is for, e.g. "2×10 min @ próg"'),
  note: z.string().max(500).nullish()
});

/** Seconds per km as `m:ss`, so the model never has to divide to read a pace aloud. */
function mmss(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Paces flattened: the raw seconds stay (for arithmetic) and a label rides along (for speech). */
function pacesView(paces: BlockWeek['paces']): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, range] of Object.entries(paces)) {
    if (!range) continue;
    out[key] = {
      lowS: range.lowS,
      highS: range.highS,
      label: `${mmss(range.lowS)}–${mmss(range.highS)}/km`
    };
  }
  return out;
}

/**
 * A week flattened for a model: no nested chart objects, numbers pre-rounded, the comparison already
 * made. An assistant should be able to read this aloud without doing arithmetic (spec 061's rule).
 */
function weekView(week: BlockWeek): Record<string, unknown> {
  const remainingKm =
    week.volumeTargetKm === null ? null : Math.round((week.volumeTargetKm - week.volumeActualKm) * 10) / 10;
  return {
    blockName: week.blockName,
    weekNumber: week.weekNumber,
    weeks: week.weeks,
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
    phase: week.phase,
    phaseLabel: week.phaseLabel,
    phaseDerived: week.phaseDerived,
    focus: week.focus,
    volumeTargetKm: week.volumeTargetKm,
    volumeActualKm: week.volumeActualKm,
    volumeRemainingKm: remainingKm,
    sessions: week.sessions.map((s) => ({
      id: s.id,
      day: s.day,
      title: s.title,
      sport: s.sportLabel,
      estimatedDistanceM: s.estimatedDistanceM,
      estimatedDurationS: s.estimatedDurationS,
      onWatch: s.pushState === 'pushed',
      pushState: s.pushState
    })),
    paces: pacesView(week.paces),
    constraints: week.constraints,
    note: week.note,
    ...(week.goal
      ? { goal: { id: week.goal.id, title: week.goal.title, day: week.goal.day, daysOut: week.goal.daysOut } }
      : {}),
    /*
     * Spec 062. Present ONLY when something actually hurts, so its presence is the signal — an
     * always-there `soreness: null` is a field a reader learns to skip.
     */
    ...(week.soreness
      ? {
          soreness: {
            ...week.soreness,
            advice:
              'Reported soreness at or above the threshold in the last 7 days. Treat cutting volume ' +
              'as the conservative call before adding any.'
          }
        }
      : {})
  };
}

const currentWeekTool: BlockTool = {
  name: 'get_current_week',
  description:
    'WHERE THE ATHLETE IS IN THEIR OWN PLAN — call this before advising on any session, before ' +
    'writing a workout, and before reading training history. Returns the training block and which ' +
    'week of it today is, the phase, the volume target for the week against what has actually been ' +
    'run so far, the sessions already scheduled (and whether each has reached the watch), the pace ' +
    'bands the block is run at, and the standing constraints the athlete should not have to repeat ' +
    '("4 runs a week", "no bike Dec–Feb", "knees"), and any soreness reported in the last week. ' +
    'Takes no arguments: today resolves the week. ' +
    'Returns block: null when no block covers today — say so rather than inferring a plan from ' +
    'recent activities.',
  inputShape: {},
  async handler(deps) {
    const data = await loadCurrentWeek(api(deps), deps.userId);
    if (!data.week) {
      return text({
        today: data.today,
        block: null,
        message:
          'No training block covers today. create_training_block sets one up; until then there is no ' +
          'plan to be on or off.'
      });
    }
    return text({ today: data.today, ...weekView(data.week) });
  }
};

const createBlockTool: BlockTool = {
  name: 'create_training_block',
  description:
    'Start a training block: a named span of weeks the athlete is working through, optionally ' +
    'attached to a season goal so phases follow the countdown to the race. `startDate` is snapped ' +
    'to the Monday of its week. `paces` are bands in SECONDS PER KILOMETRE (6:10/km is 370) and ' +
    '`constraints` are standing rules in plain words. Blocks may not overlap — one plan covers a ' +
    'given day. Set the per-week volume targets afterwards with update_training_block.',
  inputShape: {
    name: z.string().min(1).max(120),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
    weeks: z.number().int().min(1).max(52),
    goalId: z.string().max(120).nullish().describe('Goal id from list_goals'),
    paces: pacesArg.nullish(),
    constraints: z.array(z.string().max(200)).max(20).nullish(),
    note: z.string().max(500).nullish()
  },
  async handler(deps, args) {
    const result = await createBlock(api(deps), deps.userId, { ...args, startDay: args.startDate });
    if (!result.ok) return errorText(result.error);
    return text({
      created: result.block,
      next: 'Set the week targets with update_training_block, then call get_current_week.'
    });
  }
};

const updateBlockTool: BlockTool = {
  name: 'update_training_block',
  description:
    'Correct a block — after a test, after illness, after a plan change. Pass only what changes. ' +
    "`weekTargets` upserts per-week targets: volume in km, a `focus` in the coach's own words, and " +
    'a `phase` override when the week is not what the race countdown implies. Absent keys are left ' +
    'alone; an explicit null clears. Recalculating `paces` after a time trial is a patch here.',
  inputShape: {
    blockId: z.string().min(1),
    name: z.string().min(1).max(120).nullish(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullish(),
    weeks: z.number().int().min(1).max(52).nullish(),
    goalId: z.string().max(120).nullish(),
    paces: pacesArg.nullish(),
    constraints: z.array(z.string().max(200)).max(20).nullish(),
    note: z.string().max(500).nullish(),
    weekTargets: z.array(weekTargetArg).max(52).nullish()
  },
  async handler(deps, args) {
    const { blockId, startDate, ...rest } = args;
    // Only keys the caller actually sent reach the validator — an absent key must leave the column
    // alone, and `undefined` spread into the body would be indistinguishable from a null clear.
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) if (value !== undefined) body[key] = value;
    if (startDate !== undefined && startDate !== null) body.startDay = startDate;

    const result = await patchBlock(api(deps), deps.userId, String(blockId ?? ''), body);
    if (!result.ok) return errorText(result.error);
    return text({ updated: result.block, weekTargets: result.weekTargets });
  }
};

const listBlocksTool: BlockTool = {
  name: 'list_training_blocks',
  description:
    'Every training block, past and planned, with its span and which week today falls in. Use it to ' +
    'find a blockId, or to see what the athlete has already worked through this season.',
  inputShape: {
    goalId: z.string().max(120).nullish().describe('Only blocks attached to this goal')
  },
  async handler(deps, args) {
    const goalId = args.goalId == null ? undefined : String(args.goalId);
    const data = await listBlockSummaries(api(deps), deps.userId, goalId ? { goalId } : {});
    return text({
      today: data.today,
      count: data.blocks.length,
      blocks: data.blocks.map((b) => ({
        id: b.block.id,
        name: b.block.name,
        startDay: b.block.startDay,
        endDay: b.endDay,
        weeks: b.block.weeks,
        position: b.position,
        currentWeek: b.currentWeek,
        goalId: b.block.goalId,
        constraints: b.block.constraints,
        weekTargets: b.weekTargets.map((w: TrainingBlockWeek) => ({
          weekNumber: w.weekNumber,
          phase: w.phase,
          volumeTargetKm: w.volumeTargetKm,
          focus: w.focus
        }))
      }))
    });
  }
};

const deleteBlockTool: BlockTool = {
  name: 'delete_training_block',
  description:
    'Remove a training block and its week targets. Sessions already scheduled are NOT deleted — they ' +
    'are authored workouts in their own right and may already be on the watch.',
  inputShape: { blockId: z.string().min(1) },
  async handler(deps, args) {
    const result = await removeBlock(api(deps), deps.userId, String(args.blockId ?? ''));
    if (!result.ok) return errorText(result.error);
    return text({ deleted: true, name: result.deleted.name });
  }
};

const reviewApi = (deps: BlockToolDeps): WeekReviewDeps => ({
  store: deps.store,
  clock: deps.clock,
  ...(deps.timeZone ? { timeZone: deps.timeZone } : {})
});

/** One sentence a coach can read without decoding the numbers under it. */
function reviewVerdict(data: Awaited<ReturnType<typeof loadWeekReview>>): string {
  if (data.empty) return 'Nothing planned and nothing recorded for this week.';
  const { matched, missed, unplanned } = data.match;
  const shortened = matched.filter((m) => m.adherence === 'shortened').length;
  const parts = [`${matched.length} of ${matched.length + missed.length} planned sessions done`];
  if (shortened > 0) parts.push(`${shortened} shortened`);
  if (missed.length > 0) parts.push(`${missed.length} missed`);
  if (unplanned.length > 0) parts.push(`${unplanned.length} unplanned`);
  const target = data.planned.volumeTargetKm;
  parts.push(
    target === null
      ? `${data.actual.volumeKm} km covered (no weekly target set)`
      : `${data.actual.volumeKm} km against a target of ${target} km`
  );
  return `${parts.join(', ')}.`;
}

const weekReviewTool: BlockTool = {
  name: 'get_week_review',
  description:
    'PLAN AGAINST REALITY for one week, already reconciled: which planned session each activity ' +
    'fulfilled, which were shortened, which were missed, and what was done that was never planned. ' +
    'Volume comes back twice on purpose — the block target for the week and the sum of the sessions ' +
    'actually written down are different numbers, and conflating them is how a review lies. A ' +
    'session moved by a day still counts as done and reports `dayShift`, so a week that simply ' +
    'shifted does not read as chaos. Every pairing says HOW it was made in `matchedBy`: ' +
    '`workout-id` is what the watch itself linked (the athlete started that scheduled session), ' +
    '`heuristic` is inferred from sport, day and size — a good guess, not a fact. ' +
    'Any RPE logged for a session rides along. Omit weekStart for ' +
    'the current week; any day inside a week resolves to that week.',
  inputShape: {
    weekStart: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'weekStart must be YYYY-MM-DD')
      .nullish()
      .describe('Any day in the week under review; snapped to its Monday')
  },
  async handler(deps, args) {
    const data = await loadWeekReview(
      reviewApi(deps),
      deps.userId,
      args.weekStart == null ? undefined : String(args.weekStart)
    );

    if (data.empty) {
      return text({
        weekStart: data.weekStart,
        weekEnd: data.weekEnd,
        empty: true,
        message:
          'Nothing was planned and nothing was recorded for this week. Say so rather than reading ' +
          'it as a failed week.'
      });
    }

    return text({
      weekStart: data.weekStart,
      weekEnd: data.weekEnd,
      ...(data.block
        ? {
            block: {
              name: data.block.name,
              weekNumber: data.block.weekNumber,
              weeks: data.block.weeks,
              focus: data.block.focus
            }
          }
        : {}),
      planned: {
        volumeTargetKm: data.planned.volumeTargetKm,
        sessionsVolumeKm: data.planned.sessionsVolumeKm,
        sessions: data.planned.sessions
      },
      actual: { volumeKm: data.actual.volumeKm, sessions: data.actual.sessions },
      matched: data.match.matched.map((m) => ({
        day: m.planned.day,
        planned: m.planned.title,
        completed: m.completed.name,
        activityId: m.completed.id,
        adherence: m.adherence,
        adherenceRatio: m.adherenceRatio,
        // spec 081: `workout-id` means Garmin itself linked this activity to that scheduled
        // session; `heuristic` means we inferred it from sport, day and size. Reporting the two
        // identically would let a guess be read as a fact.
        matchedBy: m.matchedBy,
        plannedDistanceM: m.planned.estimatedDistanceM,
        actualDistanceM: m.completed.distanceM,
        ...(m.dayShift !== 0 ? { dayShift: m.dayShift, doneOn: m.completed.day } : {}),
        ...(data.rpeByActivity[m.completed.id] !== undefined
          ? { rpe: data.rpeByActivity[m.completed.id] }
          : {})
      })),
      missed: data.match.missed.map((p) => ({
        day: p.day,
        title: p.title,
        plannedDistanceM: p.estimatedDistanceM
      })),
      unplanned: data.match.unplanned.map((a) => ({
        day: a.day,
        activityId: a.id,
        name: a.name,
        distanceM: a.distanceM,
        ...(data.rpeByActivity[a.id] !== undefined ? { rpe: data.rpeByActivity[a.id] } : {})
      })),
      verdict: reviewVerdict(data)
    });
  }
};

export const BLOCK_TOOLS: readonly BlockTool[] = [
  currentWeekTool,
  createBlockTool,
  updateBlockTool,
  listBlocksTool,
  deleteBlockTool,
  weekReviewTool
];
