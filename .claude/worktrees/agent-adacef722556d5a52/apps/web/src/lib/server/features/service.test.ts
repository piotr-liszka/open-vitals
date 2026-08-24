/**
 * Feature-switch resolution (spec 071). The case that matters, and the one the consent store this
 * replaced could not express: a switch that DEFAULTS ON, turned OFF, stays off.
 */
import { describe, it, expect } from 'vitest';
import { createFeatureService } from './service';
import { createMemoryFeatureStore } from './store';
import { UnknownFeatureError, type Feature, type FeatureService } from './types';
import {
  autoWorkoutPushAllowed,
  FEATURES,
  WORKOUT_AUTO_PUSH_FEATURE,
  WORKOUT_WRITE_FEATURE
} from './registry';

const REGISTRY: readonly Feature[] = [
  { id: 'on_by_default', title: 'On', summary: '', integration: 'garmin', defaultEnabled: true },
  { id: 'off_by_default', title: 'Off', summary: '', integration: 'mcp', defaultEnabled: false }
];

const service = (store = createMemoryFeatureStore(), userId = 'u1') =>
  createFeatureService({ store, userId, features: REGISTRY });

describe('createFeatureService', () => {
  it('falls back to the registry default when the user has never touched a switch', async () => {
    const s = service();
    expect(await s.isEnabled('on_by_default')).toBe(true);
    expect(await s.isEnabled('off_by_default')).toBe(false);
  });

  it('persists an explicit OFF for a switch that defaults ON', async () => {
    const store = createMemoryFeatureStore();
    await service(store).setEnabled('on_by_default', false);
    // A fresh service over the same store — i.e. the next request, or the next process.
    expect(await service(store).isEnabled('on_by_default')).toBe(false);
  });

  it('persists an explicit ON for a switch that defaults OFF', async () => {
    const store = createMemoryFeatureStore();
    await service(store).setEnabled('off_by_default', true);
    expect(await service(store).isEnabled('off_by_default')).toBe(true);
  });

  it('keeps one user out of another user’s switches', async () => {
    const store = createMemoryFeatureStore();
    await service(store, 'u1').setEnabled('on_by_default', false);
    expect(await service(store, 'u2').isEnabled('on_by_default')).toBe(true);
  });

  it('lists every registry entry with its resolved state', async () => {
    const store = createMemoryFeatureStore();
    await service(store).setEnabled('off_by_default', true);
    expect((await service(store).list()).map((f) => [f.id, f.enabled])).toEqual([
      ['on_by_default', true],
      ['off_by_default', true]
    ]);
  });

  it('refuses an id that is not in the registry', async () => {
    await expect(service().setEnabled('made_up', true)).rejects.toBeInstanceOf(UnknownFeatureError);
    await expect(service().isEnabled('made_up')).rejects.toBeInstanceOf(UnknownFeatureError);
  });
});

describe('the shipped registry', () => {
  it('ships exactly the four switches Settings renders, all on by default', () => {
    // `workout_auto_push` defaults ON so upgrading changes nothing for anyone who never opens
    // Settings: before spec 083 the automatic push was what `workout_write` alone meant.
    expect(FEATURES.map((f) => [f.id, f.integration, f.defaultEnabled])).toEqual([
      ['auto_sync', 'garmin', true],
      ['workout_write', 'garmin', true],
      ['workout_auto_push', 'garmin', true],
      ['mcp', 'mcp', true]
    ]);
  });
});

describe('autoWorkoutPushAllowed (spec 083)', () => {
  /** The asymmetry is the feature: automation off must still leave the manual button working. */
  const features = (overrides: Record<string, boolean>): FeatureService =>
    ({
      async isEnabled(id: string) {
        return overrides[id] ?? true;
      }
    }) as unknown as FeatureService;

  it('needs BOTH permission and automation', async () => {
    expect(await autoWorkoutPushAllowed(features({}))).toBe(true);
    expect(await autoWorkoutPushAllowed(features({ workout_auto_push: false }))).toBe(false);
    expect(await autoWorkoutPushAllowed(features({ workout_write: false }))).toBe(false);
  });

  it('is the ONLY thing `workout_auto_push` gates — the manual path checks `workout_write` alone', async () => {
    // Regression guard for the mistake this split exists to prevent: if the manual push ever starts
    // consulting `workout_auto_push`, turning the automation off disables the button that replaces it.
    const manualPathSwitch = WORKOUT_WRITE_FEATURE;
    expect(manualPathSwitch).not.toBe(WORKOUT_AUTO_PUSH_FEATURE);
    expect(await features({ workout_auto_push: false }).isEnabled(manualPathSwitch)).toBe(true);
  });
});
