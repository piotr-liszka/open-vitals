import { describe, it, expect } from 'vitest';
import { createDevGarminMock } from './dev-mock';
import { createTestContainer } from '../container';
import type { Config } from '../config';

const DATE = '2026-08-01';

/** Pull a numeric field out of a `{ metric, date, data }` dev-mock payload. */
async function stepsFor(userId: string): Promise<unknown> {
  const g = createDevGarminMock(userId);
  const raw = (await g.getMetric('steps', DATE)) as { data: { totalSteps: number } };
  return raw.data.totalSteps;
}

describe('createDevGarminMock (per-user fixtures)', () => {
  it('is deterministic for a given user', async () => {
    expect(await stepsFor('alice')).toBe(await stepsFor('alice'));
  });

  it('produces DIFFERENT data for different users (isolation is visible)', async () => {
    const alice = await stepsFor('alice');
    const bob = await stepsFor('bob');
    expect(alice).not.toBe(bob);
  });

  it('varies the display name per user', async () => {
    const a = await createDevGarminMock('alice').getStatus();
    const b = await createDevGarminMock('bob').getStatus();
    expect(a.displayName).not.toBe(b.displayName);
  });
});

describe('container.garminSyncFor isolation (mock adapter)', () => {
  /** A test container wired to the dev Garmin mock adapter (no http/sidecar). */
  function mockAdapterContainer() {
    const base = createTestContainer();
    const config: Config = { ...base.config, garminAdapter: 'mock' };
    return createTestContainer({ config });
  }

  // Spec 015: the READ path (`garminFor`) resolves from the local store; the dev mock is now the
  // SYNC SOURCE (`garminSyncFor`), so per-user isolation of the fixture data is asserted there.
  it('garminSyncFor(userA) and garminSyncFor(userB) serve different data', async () => {
    const c = mockAdapterContainer();
    const a = (await c.garminSyncFor('alice').getMetric('steps', DATE)) as { data: { totalSteps: number } };
    const b = (await c.garminSyncFor('bob').getMetric('steps', DATE)) as { data: { totalSteps: number } };
    expect(a.data.totalSteps).not.toBe(b.data.totalSteps);
  });

  it('garminFor read path resolves from the local store (empty until synced)', async () => {
    const c = mockAdapterContainer();
    // Nothing synced yet → the store-backed read returns a null-data envelope, never the sidecar.
    const before = (await c.garminFor('alice').getMetric('steps', DATE)) as { data: unknown };
    expect(before.data).toBeNull();
    // After writing that day to the store, the same read path returns it.
    await c.store.putMetricDay('alice', 'steps', DATE, { totalSteps: 12345 });
    const after = (await c.garminFor('alice').getMetric('steps', DATE)) as { data: { totalSteps: number } };
    expect(after.data.totalSteps).toBe(12345);
  });
});
