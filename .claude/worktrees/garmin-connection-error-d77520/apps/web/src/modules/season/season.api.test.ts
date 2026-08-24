import { describe, it, expect } from 'vitest';
import { createMemoryStore } from '$lib/server/store/memory';
import { fixedClock } from '$lib/server/clock';
import { sequenceRandom } from '$lib/server/random';
import type { SettingsRepo, UserSettings } from '$lib/server/repo/types';
import type { ActivitySummary, LocalStore, PlannedEvent } from '$lib/server/store/types';
import { MIN_HISTORY_DAYS, RAMP_HIGH } from '$lib/server/analytics/load-risk';
import { addDays } from '$lib/date';
import { createGoal, deleteGoal, loadSeason, updateGoal, type SeasonDeps } from './season.api';

const USER = 'u1';
const OTHER = 'u2';
const clock = fixedClock(new Date('2026-08-15T08:00:00.000Z'));
const TODAY = '2026-08-15';

function act(id: string, over: Partial<ActivitySummary> = {}): ActivitySummary {
  return {
    userId: USER,
    activityId: id,
    sport: 'running',
    name: null,
    startTime: `${TODAY}T09:00:00Z`,
    startTimeLocal: `${TODAY} 09:00:00`,
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
    raw: {},
    ...over
  };
}

/** `days` days of daily running, ending yesterday — enough continuous history for CTL to converge. */
function history(days: number, trainingLoad = 60): ActivitySummary[] {
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(TODAY, -(days - i));
    return act(`a-${i}`, { startTimeLocal: `${day} 09:00:00`, startTime: `${day}T09:00:00Z`, trainingLoad });
  });
}

function fakeSettings(bag: UserSettings = {}): SettingsRepo {
  return {
    async get() {
      return bag;
    },
    async set() {
      /* no-op */
    }
  };
}

function deps(over: { store?: LocalStore; settings?: UserSettings } = {}): SeasonDeps {
  return {
    store: over.store ?? createMemoryStore(),
    settings: fakeSettings(over.settings),
    clock,
    random: sequenceRandom('goal')
  };
}

/** Seed a goal straight through the handler, so validation is exercised on the way in. */
async function seedGoal(d: SeasonDeps, body: Record<string, unknown>): Promise<string> {
  const created = await createGoal(d, USER, {
    day: addDays(TODAY, 60),
    sport: 'run',
    title: 'Półmaraton',
    kind: 'race',
    priority: 'a',
    ...body
  });
  if (!created.ok) throw new Error(`seed failed: ${created.error}`);
  return created.goal.id;
}

describe('loadSeason', () => {
  it('is empty for an athlete with no goals', async () => {
    const data = await loadSeason(deps(), { userId: USER });

    expect(data.goals).toEqual([]);
    expect(data.suggestions).toEqual([]);
  });

  it('counts down to a future goal and names its phase', async () => {
    const d = deps();
    await d.store.putActivities(USER, history(120));
    await seedGoal(d, { day: addDays(TODAY, 60), targetCtl: 70 });

    const [goal] = (await loadSeason(d, { userId: USER })).goals;

    expect(goal!.daysOut).toBe(60);
    expect(goal!.weeksOut).toBe(8);
    expect(goal!.phase).toBe('build');
    expect(goal!.phaseLabel).toBe('Budowanie');
    expect(goal!.sportLabel).toBe('Bieg');
    expect(goal!.ctl).toBeGreaterThan(0);
    expect(goal!.requiredRampPerWeek).not.toBeNull();
    expect(goal!.note.length).toBeGreaterThan(0);
  });

  it('reports no trajectory at all for a goal already run', async () => {
    const d = deps();
    await d.store.putActivities(USER, history(120));
    await seedGoal(d, { day: addDays(TODAY, -14) });

    const [goal] = (await loadSeason(d, { userId: USER })).goals;

    expect(goal!.phase).toBe('done');
    expect(goal!.daysOut).toBe(-14);
    expect(goal!.projectedCtl).toBeNull();
    expect(goal!.requiredRampPerWeek).toBeNull();
    expect(goal!.taper).toBeNull();
    expect(goal!.prediction).toBeNull();
    expect(goal!.status).toBe('unknown');
    expect(goal!.note).toBe('Cel jest już za Tobą.');
  });

  it('refuses a verdict for a sport family under the history floor', async () => {
    const d = deps();
    await d.store.putActivities(USER, history(MIN_HISTORY_DAYS - 5));
    await seedGoal(d, { day: addDays(TODAY, 90), targetCtl: 70 });

    const [goal] = (await loadSeason(d, { userId: USER })).goals;

    expect(goal!.status).toBe('unknown');
    expect(goal!.note).toContain('Za mało');
  });

  it('scores a goal against its OWN family, not the whole athlete', async () => {
    const d = deps();
    // A big continuous block of RIDING, and nothing at all on foot.
    await d.store.putActivities(
      USER,
      history(120).map((a, i) => ({ ...a, sport: 'cycling', activityId: `r-${i}` }))
    );
    await seedGoal(d, { day: addDays(TODAY, 90), sport: 'run', targetCtl: 70 });

    const [goal] = (await loadSeason(d, { userId: USER })).goals;

    // The rider's CTL must not be lent to the runner's goal.
    expect(goal!.ctl).toBeNull();
    expect(goal!.status).toBe('unknown');
  });

  it('predicts a run race against the wanted time, naming the best it came from', async () => {
    const d = deps();
    await d.store.putActivities(USER, history(120));
    await seedGoal(d, {
      day: addDays(TODAY, 60),
      distanceM: 21097.5,
      targetTimeS: 5400,
      targetCtl: 70
    });

    const [goal] = (await loadSeason(d, { userId: USER })).goals;

    expect(goal!.prediction).not.toBeNull();
    expect(goal!.prediction!.riegelS).toBeGreaterThan(0);
    expect(goal!.prediction!.fromLabel).not.toBeNull();
    // 10 km in 50:00 ⇒ a half well over 90 minutes, so the target is the faster of the two.
    expect(goal!.prediction!.gapS).toBeLessThan(0);
  });

  it('offers no prediction for a ride, where spec 043‘s models do not apply', async () => {
    const d = deps();
    await d.store.putActivities(
      USER,
      history(120).map((a, i) => ({ ...a, sport: 'cycling', activityId: `r-${i}` }))
    );
    await seedGoal(d, { day: addDays(TODAY, 60), sport: 'ride', distanceM: 120_000 });

    const [goal] = (await loadSeason(d, { userId: USER })).goals;

    expect(goal!.prediction).toBeNull();
  });

  it('checks the taper only inside the taper window, and calls a flat one out', async () => {
    const d = deps();
    // Load that never comes down, with the race six days away.
    await d.store.putActivities(USER, history(120));
    await seedGoal(d, { day: addDays(TODAY, 6), targetCtl: 70 });

    const [goal] = (await loadSeason(d, { userId: USER })).goals;

    expect(goal!.phase).toBe('race-week');
    expect(goal!.taper).not.toBeNull();
    expect(goal!.taper!.tapering).toBe(false);
    expect(goal!.note).toContain('zwykły tydzień');
  });

  it('reports at-risk over behind when the ramp is past the safe ceiling', async () => {
    const d = deps();
    /*
     * A ramp steep enough to trip spec 039: an athlete who has only just started, whose CTL is
     * climbing fast off a low base.
     */
    await d.store.putActivities(USER, history(MIN_HISTORY_DAYS + 10, 220));
    await seedGoal(d, { day: addDays(TODAY, 120), targetCtl: 200 });

    const [goal] = (await loadSeason(d, { userId: USER })).goals;

    expect(goal!.rampPerWeek).toBeGreaterThan(RAMP_HIGH);
    expect(goal!.status).toBe('at-risk');
    expect(goal!.note).toContain('kontuzji');
  });

  it('orders future goals soonest-first, with past ones after', async () => {
    const d = deps();
    await d.store.putActivities(USER, history(120));
    await seedGoal(d, { day: addDays(TODAY, 90), title: 'Późny' });
    await seedGoal(d, { day: addDays(TODAY, 20), title: 'Bliski' });
    await seedGoal(d, { day: addDays(TODAY, -30), title: 'Miniony' });

    const { goals } = await loadSeason(d, { userId: USER });

    expect(goals.map((g) => g.goal.title)).toEqual(['Bliski', 'Późny', 'Miniony']);
  });

  it('offers only the athlete‘s own sport families to the form', async () => {
    const d = deps();
    await d.store.putActivities(USER, [act('a'), act('b', { sport: 'cycling' })]);

    const { sports } = await loadSeason(d, { userId: USER });

    expect(sports.map((s) => s.group).sort()).toEqual(['ride', 'run']);
  });
});

describe('suggestions from the Garmin calendar', () => {
  const race: PlannedEvent = {
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
  };

  async function withRace(d: SeasonDeps, extra: PlannedEvent[] = []): Promise<void> {
    await d.store.replacePlannedEvents(USER, TODAY, addDays(TODAY, 730), [race, ...extra]);
  }

  it('offers a synced race no goal has adopted', async () => {
    const d = deps();
    await withRace(d);

    const { suggestions } = await loadSeason(d, { userId: USER });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.eventId).toBe('ev-9');
    expect(suggestions[0]!.sport).toBe('run');
    expect(suggestions[0]!.distanceM).toBe(10000);
  });

  it('ignores planned workouts — only races are goals', async () => {
    const d = deps();
    await withRace(d, [{ ...race, id: 'ev-10', kind: 'workout', title: 'Interwały' }]);

    const { suggestions } = await loadSeason(d, { userId: USER });

    expect(suggestions.map((s) => s.eventId)).toEqual(['ev-9']);
  });

  it('stops offering a race once it has been adopted, and offers it again after deletion', async () => {
    const d = deps();
    await withRace(d);

    const id = await seedGoal(d, { day: race.day, title: race.title, garminEventId: 'ev-9' });
    expect((await loadSeason(d, { userId: USER })).suggestions).toEqual([]);

    await deleteGoal(d, USER, id);
    // We never owned the planned event, so deleting our goal legitimately returns the offer.
    expect((await loadSeason(d, { userId: USER })).suggestions).toHaveLength(1);
  });

  it('refuses to adopt the same race twice', async () => {
    const d = deps();
    await withRace(d);
    await seedGoal(d, { day: race.day, garminEventId: 'ev-9' });

    const again = await createGoal(d, USER, {
      day: race.day,
      sport: 'run',
      title: 'Znowu',
      garminEventId: 'ev-9'
    });

    expect(again.ok).toBe(false);
    expect(again.ok === false && again.status).toBe(409);
  });
});

describe('createGoal', () => {
  it('stores a valid goal and stamps it from the injected ports', async () => {
    const d = deps();

    const created = await createGoal(d, USER, {
      day: addDays(TODAY, 60),
      sport: 'run',
      title: '  Półmaraton  ',
      kind: 'race',
      priority: 'b',
      distanceM: 21097.5,
      targetTimeS: 5400
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.goal.title).toBe('Półmaraton');
    expect(created.goal.priority).toBe('b');
    expect(created.goal.source).toBe('manual');
    expect(created.goal.createdAt).toBe('2026-08-15T08:00:00.000Z');
    expect(created.goal.id).toBe('goal-1');
  });

  it('defaults kind and priority to the common case', async () => {
    const d = deps();

    const created = await createGoal(d, USER, {
      day: addDays(TODAY, 60),
      sport: 'ride',
      title: 'Maraton MTB'
    });

    expect(created.ok && created.goal.kind).toBe('race');
    expect(created.ok && created.goal.priority).toBe('a');
  });

  it.each([
    ['a malformed day', { day: '11.10.2026' }, 'RRRR-MM-DD'],
    ['an unknown sport', { sport: 'quidditch' }, 'dyscyplina'],
    ['an empty title', { title: '   ' }, 'nazwa celu'],
    ['a negative distance', { distanceM: -5 }, 'większe od zera'],
    ['an absurd target time', { targetTimeS: 10_000_000, distanceM: 10_000 }, 'zakresem'],
    ['an unknown kind', { kind: 'party' }, 'rodzaj'],
    ['an unknown priority', { priority: 'z' }, 'priorytet'],
    ['a target time with no distance', { targetTimeS: 5400 }, 'wymaga podania dystansu']
  ])('rejects %s with a 400 before it reaches the store', async (_name, patch, message) => {
    const d = deps();

    const result = await createGoal(d, USER, {
      day: addDays(TODAY, 60),
      sport: 'run',
      title: 'Cel',
      ...patch
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.error).toContain(message);
    expect(await d.store.listGoals(USER)).toEqual([]);
  });

  it('rejects a body that is not an object', async () => {
    const d = deps();
    expect((await createGoal(d, USER, null)).ok).toBe(false);
    expect((await createGoal(d, USER, ['nope'])).ok).toBe(false);
  });
});

describe('updateGoal / deleteGoal', () => {
  it('patches only what was sent', async () => {
    const d = deps();
    const id = await seedGoal(d, { targetCtl: 70, distanceM: 21097.5 });

    const patched = await updateGoal(d, USER, id, { day: addDays(TODAY, 75) });

    expect(patched.ok).toBe(true);
    if (!patched.ok) return;
    expect(patched.goal.day).toBe(addDays(TODAY, 75));
    expect(patched.goal.targetCtl).toBe(70);
    expect(patched.goal.title).toBe('Półmaraton');
  });

  it('clears a target when the patch sends an explicit null', async () => {
    const d = deps();
    const id = await seedGoal(d, { targetCtl: 70 });

    const patched = await updateGoal(d, USER, id, { targetCtl: null });

    expect(patched.ok && patched.goal.targetCtl).toBeNull();
  });

  it('rejects an empty patch and an invalid one', async () => {
    const d = deps();
    const id = await seedGoal(d, {});

    expect((await updateGoal(d, USER, id, {})).ok).toBe(false);
    const bad = await updateGoal(d, USER, id, { day: 'wczoraj' });
    expect(bad.ok === false && bad.status).toBe(400);
  });

  it('answers 404 for an unknown id', async () => {
    const d = deps();
    const missing = await updateGoal(d, USER, 'nope', { title: 'x' });
    expect(missing.ok === false && missing.status).toBe(404);
    const gone = await deleteGoal(d, USER, 'nope');
    expect(gone.ok === false && gone.status).toBe(404);
  });

  it('never lets one user touch another‘s goal', async () => {
    const d = deps();
    const id = await seedGoal(d, {});

    // Indistinguishable from "no such goal" on purpose — a different answer would confirm the id.
    const patched = await updateGoal(d, OTHER, id, { title: 'przejęte' });
    expect(patched.ok === false && patched.status).toBe(404);
    expect((await deleteGoal(d, OTHER, id)).ok).toBe(false);

    const mine = await d.store.getGoal(USER, id);
    expect(mine?.title).toBe('Półmaraton');
  });

  it('removes the goal it deleted and nothing else', async () => {
    const d = deps();
    const keep = await seedGoal(d, { title: 'Zostaje' });
    const drop = await seedGoal(d, { title: 'Znika' });

    expect((await deleteGoal(d, USER, drop)).ok).toBe(true);

    const left = await d.store.listGoals(USER);
    expect(left.map((g) => g.id)).toEqual([keep]);
  });
});
