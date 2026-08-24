/**
 * Spec 071: Settings is a list of integrations, and each card owns its own switches. The loader is
 * what makes that true — it splits the registry by owning integration so the page never has to
 * decide where a switch belongs, and a new switch lands on the right card by declaring one field.
 */
import { describe, it, expect } from 'vitest';
import { createTestContainer } from '$lib/server/container';
import { createGarminMock } from '$lib/server/garmin/mock-adapter';
import type { FeatureView } from '$modules/features/features.types';
import type { IntegrationsStatus } from '$modules/integrations/integrations.types';
import type { HealthStatus } from '$modules/healthcheck/health.types';
import type { AthleteProfile } from '$modules/settings/profile.types';
import { load as loadSettings } from './+page.server';

const USER = 'user-1';

function event() {
  const c = createTestContainer({
    garmin: createGarminMock({ status: { authenticated: true, displayName: 'Ada' } })
  });
  return {
    locals: {
      user: { id: USER },
      garmin: c.garminFor(USER),
      features: c.featuresFor(USER),
      container: c
    },
    container: c
  };
}

/** The loader's declared return is `PageServerLoad`, which widens to void here — name the shape. */
interface SettingsData {
  health: HealthStatus;
  mcpUrl: string;
  integrations: IntegrationsStatus;
  profile: AthleteProfile;
  garminFeatures: FeatureView[];
  mcpFeatures: FeatureView[];
}

describe('settings payload', () => {
  it('carries one payload per integration card', async () => {
    const { locals } = event();
    const data = (await loadSettings({ locals } as never)) as unknown as SettingsData;

    // Garmin card: connection + its own three switches.
    expect(data.health).toMatchObject({ connected: true });
    expect(data.garminFeatures.map((f) => f.id)).toEqual(['auto_sync', 'workout_write', 'workout_auto_push']);
    // MCP card: the URL + its own switch.
    expect(data.mcpUrl).toContain('/mcp?token=');
    expect(data.mcpFeatures.map((f) => f.id)).toEqual(['mcp']);
    // Strava + Withings cards.
    expect(data.integrations.strava).toMatchObject({ connected: false });
    expect(data.integrations.withings).toMatchObject({ connected: false });
    // Athlete card: three numbers, each unset until the athlete says otherwise (spec 090).
    expect(data.profile).toEqual({ ftpWatts: null, maxHrBpm: null, weightKg: null });
  });

  it('carries the stored athlete profile so the card renders already filled in (spec 090)', async () => {
    const { locals, container } = event();
    await container.repo.settings.set(USER, { ftpWatts: 250, maxHrBpm: 175, weightKg: 72.5 });

    const data = (await loadSettings({ locals } as never)) as unknown as SettingsData;
    expect(data.profile).toEqual({ ftpWatts: 250, maxHrBpm: 175, weightKg: 72.5 });
  });

  it('reflects a switch the user turned off', async () => {
    const { locals } = event();
    await locals.features.setEnabled('auto_sync', false);

    const data = (await loadSettings({ locals } as never)) as unknown as SettingsData;
    expect(data.garminFeatures.find((f) => f.id === 'auto_sync')?.enabled).toBe(false);
    expect(data.garminFeatures.find((f) => f.id === 'workout_write')?.enabled).toBe(true);
  });

  it('carries nothing about tiers, terms or consent any more', async () => {
    const { locals } = event();
    const data = (await loadSettings({ locals } as never)) as Record<string, unknown>;

    expect(Object.keys(data).sort()).toEqual([
      'garminFeatures',
      'health',
      'integrations',
      'mcpFeatures',
      'mcpUrl',
      'profile'
    ]);
    // Nothing in the switch views carries terms text or a version to accept.
    const serialized = JSON.stringify(data);
    for (const dead of ['termsVersion', 'termsText', 'requiresConsent', 'detailed_analytics']) {
      expect(serialized, dead).not.toContain(dead);
    }
  });

  it('loads integrations for everyone — it used to be Advanced-only (spec 071)', async () => {
    const { locals } = event();
    // Every switch off: the integrations block must still be there. It was `null` for Base users.
    for (const id of ['auto_sync', 'workout_write', 'mcp']) await locals.features.setEnabled(id, false);

    const data = (await loadSettings({ locals } as never)) as unknown as SettingsData;
    expect(data.integrations).not.toBeNull();
  });
});
