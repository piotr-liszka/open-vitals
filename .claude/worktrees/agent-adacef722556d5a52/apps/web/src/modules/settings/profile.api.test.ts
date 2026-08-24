/**
 * Spec 090 — `GET`/`PUT /api/settings/profile` against the in-memory settings repo.
 *
 * The last test in this file is the one that matters most. A form that writes three numbers nothing
 * reads is the anti-pattern AGENTS.md §11a bans outright, and every other assertion here would still
 * pass if the handler wrote its values under keys no consumer looks at. So the round trip is carried
 * all the way through `loadActivityDetail` — the module boundary is crossed in the TEST, on purpose,
 * because the storage keys are the contract between the two slices.
 */
import { describe, it, expect } from 'vitest';
import { createTestContainer } from '$lib/server/container';
import { createMemoryStore } from '$lib/server/store/memory';
import type { SettingsRepo } from '$lib/server/repo/types';
import type { ActivitySummary } from '$lib/server/store/types';
import { loadActivityDetail } from '$modules/activity-detail/activity-detail.api';
import { getProfile, putProfile } from './profile.api';

const USER = 'user-1';

/** A fresh in-memory settings repo per test, so one test's write cannot leak into the next. */
function settings(): SettingsRepo {
  return createTestContainer().repo.settings;
}

describe('GET /api/settings/profile', () => {
  it('reports every unset field as null — "estimate it", not "unknown"', async () => {
    expect(await getProfile(settings(), USER)).toEqual({
      ftpWatts: null,
      maxHrBpm: null,
      weightKg: null
    });
  });

  it('never leaks another user profile', async () => {
    const repo = settings();
    await putProfile(repo, USER, { ftpWatts: 250, maxHrBpm: 175, weightKg: 72 });

    expect(await getProfile(repo, 'someone-else')).toEqual({
      ftpWatts: null,
      maxHrBpm: null,
      weightKg: null
    });
  });
});

describe('PUT /api/settings/profile', () => {
  it('round-trips all three values', async () => {
    const repo = settings();
    const res = await putProfile(repo, USER, { ftpWatts: 250, maxHrBpm: 175, weightKg: 72.5 });

    expect(res).toEqual({ ok: true, body: { ftpWatts: 250, maxHrBpm: 175, weightKg: 72.5 } });
    expect(await getProfile(repo, USER)).toEqual({ ftpWatts: 250, maxHrBpm: 175, weightKg: 72.5 });
  });

  it('stores under the keys the analysis reads, and merges into the shared bag', async () => {
    const repo = settings();
    await repo.set(USER, { locale: 'pl' });
    await putProfile(repo, USER, { ftpWatts: 250, maxHrBpm: 175, weightKg: 72 });

    expect(await repo.get(USER)).toEqual({
      locale: 'pl',
      ftpWatts: 250,
      maxHrBpm: 175,
      weightKg: 72
    });
  });

  it('clears a field by DELETING the key, so the estimate takes over again', async () => {
    const repo = settings();
    await putProfile(repo, USER, { ftpWatts: 250, maxHrBpm: 175, weightKg: 72 });
    const res = await putProfile(repo, USER, { ftpWatts: null, maxHrBpm: 175, weightKg: null });

    expect(res).toEqual({ ok: true, body: { ftpWatts: null, maxHrBpm: 175, weightKg: null } });
    // Absent, not `null`: every consumer treats an absent key as "no value stored".
    expect(await repo.get(USER)).toEqual({ maxHrBpm: 175 });
  });

  it.each([
    ['an FTP below the floor', { ftpWatts: 49 }, { ftpWatts: 'out_of_range' }],
    ['an FTP above the ceiling', { ftpWatts: 601 }, { ftpWatts: 'out_of_range' }],
    ['a max HR below the floor', { maxHrBpm: 99 }, { maxHrBpm: 'out_of_range' }],
    ['a max HR above the ceiling', { maxHrBpm: 231 }, { maxHrBpm: 'out_of_range' }],
    ['a weight below the floor', { weightKg: 29 }, { weightKg: 'out_of_range' }],
    ['a weight above the ceiling', { weightKg: 251 }, { weightKg: 'out_of_range' }],
    ['a number sent as text', { ftpWatts: '250' }, { ftpWatts: 'not_a_number' }],
    [
      'two bad fields at once',
      { ftpWatts: 5000, weightKg: 'ciężki' },
      { ftpWatts: 'out_of_range', weightKg: 'not_a_number' }
    ]
  ])('rejects %s with 400 and writes nothing', async (_label, body, fields) => {
    const repo = settings();
    await putProfile(repo, USER, { ftpWatts: 250, maxHrBpm: 175, weightKg: 72 });

    const res = await putProfile(repo, USER, { ftpWatts: 250, maxHrBpm: 175, weightKg: 72, ...body });

    expect(res.ok).toBe(false);
    expect(res).toMatchObject({ status: 400, body: { error: 'invalid_profile', fields } });
    // All-or-nothing: the previously stored profile survives a rejected write untouched.
    expect(await getProfile(repo, USER)).toEqual({ ftpWatts: 250, maxHrBpm: 175, weightKg: 72 });
  });

  it.each([
    ['null', null],
    ['a bare string', 'ftp=250'],
    ['an array', [250]]
  ])('rejects %s as a body', async (_label, body) => {
    const repo = settings();
    const res = await putProfile(repo, USER, body);

    expect(res).toEqual({
      ok: false,
      status: 400,
      body: { error: 'invalid_profile', fields: {} }
    });
    expect(await repo.get(USER)).toEqual({});
  });
});

/* ------------------------------------------------------------------------- *
 * The consumers. What the form writes has to be what the analysis reads.
 * ------------------------------------------------------------------------- */

function activity(): ActivitySummary {
  return {
    userId: USER,
    activityId: 'a',
    sport: 'cycling',
    name: 'Test',
    startTime: '2026-05-01T07:00:00Z',
    startTimeLocal: '2026-05-01 09:00:00',
    distanceM: 40000,
    durationS: 3600,
    movingS: 3600,
    elevationGainM: 300,
    avgHr: 150,
    // The session's own peak sits well below a trained athlete's real maximum — which is exactly the
    // case the pre-090 code got wrong.
    maxHr: 160,
    avgPower: 200,
    maxPower: 600,
    normPower: 210,
    calories: 800,
    trainingLoad: 90,
    hasGps: false,
    raw: {}
  };
}

describe('what the profile writes, the activity page reads', () => {
  it('carries FTP, max HR and weight from one PUT into the analysis', async () => {
    const repo = settings();
    const store = createMemoryStore();
    await store.putActivities(USER, [activity()]);
    const power = new Array(3600).fill(200);
    await store.putStreams(USER, 'a', {
      power,
      heartRate: new Array(3600).fill(140),
      time: power.map((_, i) => i)
    });

    await putProfile(repo, USER, { ftpWatts: 250, maxHrBpm: 175, weightKg: 72 });
    const data = await loadActivityDetail({ store, settings: repo }, USER, 'a');

    expect(data!.ftp).toBe(250);
    expect(data!.ftpEstimated).toBe(false);
    // The W/kg column of the mean-max table exists only when this is set.
    expect(data!.weightKg).toBe(72);
    // 140 bpm is 80% of 175 → Z4; against this session's own 160 peak it would have been 87.5%,
    // still Z4 — so assert the reference itself, which is what the popover reports.
    expect(data!.hr?.zoneMax).toBe(175);
    expect(data!.hr?.zoneMaxConfigured).toBe(true);
  });

  it('restores the estimated path when the fields are cleared again', async () => {
    const repo = settings();
    const store = createMemoryStore();
    await store.putActivities(USER, [activity()]);
    const power = new Array(1200).fill(300); // 20 min at 300 W → estimate 285 W
    await store.putStreams(USER, 'a', {
      power,
      heartRate: new Array(1200).fill(140),
      time: power.map((_, i) => i)
    });

    await putProfile(repo, USER, { ftpWatts: 250, maxHrBpm: 175, weightKg: 72 });
    await putProfile(repo, USER, { ftpWatts: null, maxHrBpm: null, weightKg: null });
    const data = await loadActivityDetail({ store, settings: repo }, USER, 'a');

    expect(data!.ftp).toBe(285);
    expect(data!.ftpEstimated).toBe(true);
    expect(data!.weightKg).toBeNull();
    // Back to the session's own peak as the zone reference.
    expect(data!.hr?.zoneMax).toBe(160);
    expect(data!.hr?.zoneMaxConfigured).toBe(false);
  });
});
