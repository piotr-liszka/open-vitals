/**
 * Season-goal tools (spec 060) — the part of the MCP surface that knows what the training is FOR.
 *
 * Every other tool here is retrospective: it reports what the body and the training did. These say
 * where the athlete is going, which is what makes an assistant able to answer "should I do the hard
 * session today" with something better than a guess about this week alone.
 *
 * The write tools go through the SAME validator the HTTP boundary uses (`season.validate`), so a
 * goal created by an assistant is held to exactly the rules a goal typed into the form is. Anything
 * else would make the model the weak point in the contract.
 */
import { z } from 'zod';
import type { Clock } from '../server/clock';
import type { Random } from '../server/random';
import type { SettingsRepo } from '../server/repo/types';
import type { LocalStore } from '../server/store/types';
import { createGoal, deleteGoal, loadSeason, type SeasonDeps } from '$modules/season/season.api';
import type { GoalStatus } from '$modules/season/season.types';
import type { ToolResult } from './tools';

/** Everything the season tools need. All injected (AGENTS.md §2 rule 4). */
export interface SeasonToolDeps {
  store: LocalStore;
  settings: SettingsRepo;
  /** The ONE user these tools may touch — resolved from the MCP token, never from an argument. */
  userId: string;
  clock: Clock;
  random: Random;
}

export interface SeasonTool {
  name: string;
  description: string;
  inputShape: z.ZodRawShape;
  handler(deps: SeasonToolDeps, args: Record<string, unknown>): Promise<ToolResult>;
}

function text(value: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }]
  };
}

function errorText(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

const api = (deps: SeasonToolDeps): SeasonDeps => ({
  store: deps.store,
  settings: deps.settings,
  clock: deps.clock,
  random: deps.random
});

/**
 * A goal flattened for a model: no nested objects, every number already rounded, and the verdict as
 * a sentence. The assistant should be able to read one of these aloud without doing arithmetic.
 */
function view(s: GoalStatus): Record<string, unknown> {
  return {
    id: s.goal.id,
    title: s.goal.title,
    day: s.goal.day,
    sport: s.goal.sport,
    kind: s.goal.kind,
    priority: s.goal.priority,
    daysOut: s.daysOut,
    phase: s.phase,
    status: s.status,
    verdict: s.note,
    distanceM: s.goal.distanceM,
    targetTimeS: s.goal.targetTimeS,
    targetCtl: s.goal.targetCtl,
    currentCtl: s.ctl,
    projectedCtl: s.projectedCtl,
    rampPerWeek: s.rampPerWeek,
    requiredRampPerWeek: s.requiredRampPerWeek,
    ...(s.taper ? { taper: { ratio: s.taper.ratio, tapering: s.taper.tapering } } : {}),
    ...(s.prediction
      ? {
          prediction: {
            riegelS: s.prediction.riegelS,
            criticalSpeedS: s.prediction.criticalSpeedS,
            fromBest: s.prediction.fromLabel,
            confident: s.prediction.confident,
            gapToTargetS: s.prediction.gapS
          }
        }
      : {})
  };
}

const listGoalsTool: SeasonTool = {
  name: 'list_goals',
  description:
    "The athlete's season goals — races and fitness targets — each with days remaining, which phase " +
    'of the block today falls in (base/build/peak/taper/race-week), and a verdict on whether the ' +
    'current training trajectory reaches the target. Also lists races already on their Garmin ' +
    'calendar that have not been adopted as goals yet. Use this before advising on any session: a ' +
    'hard workout eleven days before an A race is a different answer than the same workout in base.',
  inputShape: {},
  async handler(deps) {
    const data = await loadSeason(api(deps), { userId: deps.userId, locale: 'en' });
    return text({
      today: data.today,
      goals: data.goals.map(view),
      unadoptedRaces: data.suggestions
    });
  }
};

const goalPlanTool: SeasonTool = {
  name: 'get_goal_plan',
  description:
    'One goal in full: countdown, phase, the fitness (CTL) it needs versus where the current ramp ' +
    'actually lands by the start of the taper, whether the taper is real (load actually falling), ' +
    'and — for a running race with a distance — the predicted finish time against the wanted one. ' +
    'A status of `at-risk` means the athlete is building faster than is safe and outranks being ' +
    'behind: do not advise adding load in that case.',
  inputShape: {
    goalId: z.string().min(1).describe('Goal id from list_goals')
  },
  async handler(deps, args) {
    const goalId = String(args.goalId ?? '');
    const data = await loadSeason(api(deps), { userId: deps.userId, locale: 'en' });
    const found = data.goals.find((g) => g.goal.id === goalId);
    if (!found) return errorText(`no goal with id ${goalId}`);
    return text({ today: data.today, goal: view(found) });
  }
};

const createGoalTool: SeasonTool = {
  name: 'create_goal',
  description:
    'Add a season goal: a race (with an optional distance in metres and target finish time in ' +
    'seconds) or a fitness target for a date. `sport` is a sport FAMILY — run, ride, walk, swim, ' +
    "strength or other — because the trajectory is scored against that family's own fitness. " +
    '`targetCtl` is optional; without it the goal still gets a countdown and a phase but no ' +
    'on-track verdict. Pass `garminEventId` to adopt a race already on the Garmin calendar.',
  inputShape: {
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'day must be YYYY-MM-DD'),
    sport: z.string().min(1).describe('Sport family: run, ride, walk, swim, strength, other'),
    title: z.string().min(1).max(120),
    kind: z.enum(['race', 'fitness']).nullish(),
    priority: z.enum(['a', 'b', 'c']).nullish(),
    distanceM: z.number().positive().nullish(),
    targetTimeS: z.number().positive().nullish(),
    targetCtl: z.number().positive().nullish(),
    note: z.string().max(500).nullish(),
    garminEventId: z.string().max(120).nullish()
  },
  async handler(deps, args) {
    // Straight through the HTTP handler's own validator — one set of rules, two boundaries.
    const result = await createGoal(api(deps), deps.userId, args);
    if (!result.ok) return errorText(result.error);
    return text({
      created: result.goal,
      next: 'Call get_goal_plan with this id for the trajectory to it.'
    });
  }
};

const deleteGoalTool: SeasonTool = {
  name: 'delete_goal',
  description:
    'Remove a season goal. Only the goal is deleted — a race imported from the Garmin calendar stays ' +
    'on that calendar, and simply becomes available to adopt again.',
  inputShape: {
    goalId: z.string().min(1).describe('Goal id from list_goals')
  },
  async handler(deps, args) {
    const result = await deleteGoal(api(deps), deps.userId, String(args.goalId ?? ''));
    if (!result.ok) return errorText(result.error);
    return text({ deleted: true });
  }
};

export const SEASON_TOOLS: readonly SeasonTool[] = [
  listGoalsTool,
  goalPlanTool,
  createGoalTool,
  deleteGoalTool
];
