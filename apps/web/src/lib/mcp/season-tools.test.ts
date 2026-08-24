import { describe, it, expect } from 'vitest';
import { createMemoryStore } from '../server/store/memory';
import { fixedClock } from '../server/clock';
import { sequenceRandom } from '../server/random';
import type { SettingsRepo } from '../server/repo/types';
import type { ActivitySummary } from '../server/store/types';
import { addDays } from '$lib/date';
import { SEASON_TOOLS, type SeasonTool, type SeasonToolDeps } from './season-tools';

const USER = 'u1';
const clock = fixedClock(new Date('2026-08-15T08:00:00.000Z'));
const TODAY = '2026-08-15';

const tool = (name: string): SeasonTool => {
  const found = SEASON_TOOLS.find((t) => t.name === name);
  if (!found) throw new Error(`no tool named ${name}`);
  return found;
};

function fakeSettings(): SettingsRepo {
  return {
    async get() {
      return {};
    },
    async set() {
      /* no-op */
    }
  };
}

function deps(): SeasonToolDeps {
  return {
    store: createMemoryStore(),
    settings: fakeSettings(),
    userId: USER,
    clock,
    random: sequenceRandom('goal')
  };
}

/** The tool's JSON payload, parsed back out of its single text block. */
function payload(result: { content: { type: string; text?: string }[] }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text!) as Record<string, unknown>;
}

function act(id: string, day: string): ActivitySummary {
  return {
    userId: USER,
    activityId: id,
    sport: 'running',
    name: null,
    startTime: `${day}T09:00:00Z`,
    startTimeLocal: `${day} 09:00:00`,
    distanceM: 10000,
    durationS: 3000,
    movingS: 3000,
    elevationGainM: 50,
    avgHr: 150,
    maxHr: 180,
    avgPower: null,
    maxPower: null,
    normPower: null,
    calories: 600,
    trainingLoad: 60,
    hasGps: false,
    garminWorkoutId: null,
    raw: {}
  };
}

const history = (days: number): ActivitySummary[] =>
  Array.from({ length: days }, (_, i) => act(`a-${i}`, addDays(TODAY, -(days - i))));

describe('season MCP tools', () => {
  it('registers exactly the four documented tools', () => {
    expect(SEASON_TOOLS.map((t) => t.name)).toEqual([
      'list_goals',
      'get_goal_plan',
      'create_goal',
      'delete_goal'
    ]);
  });

  it('create_goal stores a goal and list_goals reads it back flattened', async () => {
    const d = deps();
    await d.store.putActivities(USER, history(120));

    const created = await tool('create_goal').handler(d, {
      day: addDays(TODAY, 60),
      sport: 'run',
      title: 'Półmaraton',
      distanceM: 21097.5,
      targetCtl: 70
    });
    expect(created.isError).toBeUndefined();

    const listed = payload(await tool('list_goals').handler(d, {}));
    const goals = listed.goals as Record<string, unknown>[];
    expect(goals).toHaveLength(1);
    expect(goals[0]!.title).toBe('Półmaraton');
    expect(goals[0]!.daysOut).toBe(60);
    expect(goals[0]!.phase).toBe('build');
    // The verdict is a sentence, so the assistant can read it aloud without doing arithmetic.
    expect(typeof goals[0]!.verdict).toBe('string');
    expect(listed.today).toBe(TODAY);
  });

  it('create_goal is held to the SAME validator as the HTTP boundary', async () => {
    const d = deps();

    const bad = await tool('create_goal').handler(d, {
      day: '15.08.2026',
      sport: 'run',
      title: 'Cel'
    });

    expect(bad.isError).toBe(true);
    expect(await d.store.listGoals(USER)).toEqual([]);
  });

  it('create_goal rejects a sport family it does not know', async () => {
    const d = deps();
    const bad = await tool('create_goal').handler(d, {
      day: addDays(TODAY, 30),
      sport: 'running', // a sport KEY, not a family — the tool takes families
      title: 'Cel'
    });
    expect(bad.isError).toBe(true);
  });

  it('get_goal_plan returns the full trajectory for one goal', async () => {
    const d = deps();
    await d.store.putActivities(USER, history(120));
    const created = payload(
      await tool('create_goal').handler(d, {
        day: addDays(TODAY, 60),
        sport: 'run',
        title: 'Półmaraton',
        targetCtl: 70
      })
    );
    const id = (created.created as { id: string }).id;

    const plan = payload(await tool('get_goal_plan').handler(d, { goalId: id }));
    const goal = plan.goal as Record<string, unknown>;

    expect(goal.id).toBe(id);
    expect(goal.currentCtl).not.toBeNull();
    expect(goal.projectedCtl).not.toBeNull();
    expect(goal.requiredRampPerWeek).not.toBeNull();
  });

  it('get_goal_plan errors on an unknown id rather than answering about another goal', async () => {
    const d = deps();
    const missing = await tool('get_goal_plan').handler(d, { goalId: 'nope' });
    expect(missing.isError).toBe(true);
    expect(missing.content[0]!.text).toContain('nope');
  });

  it('list_goals surfaces races on the Garmin calendar that are not goals yet', async () => {
    const d = deps();
    await d.store.replacePlannedEvents(USER, TODAY, addDays(TODAY, 730), [
      {
        id: 'ev-9',
        day: addDays(TODAY, 45),
        time: null,
        kind: 'race',
        title: 'Bieg Niepodległości',
        sport: 'running',
        description: null,
        estimatedDurationS: null,
        estimatedDistanceM: 10000,
        targetLoad: null,
        source: 'garmin'
      }
    ]);

    const listed = payload(await tool('list_goals').handler(d, {}));

    expect(listed.unadoptedRaces).toHaveLength(1);
  });

  it('delete_goal removes it, and errors on an id that is not this user‘s', async () => {
    const d = deps();
    const created = payload(
      await tool('create_goal').handler(d, { day: addDays(TODAY, 30), sport: 'run', title: 'Cel' })
    );
    const id = (created.created as { id: string }).id;

    expect((await tool('delete_goal').handler(d, { goalId: id })).isError).toBeUndefined();
    expect(await d.store.listGoals(USER)).toEqual([]);
    expect((await tool('delete_goal').handler(d, { goalId: id })).isError).toBe(true);
  });
});
