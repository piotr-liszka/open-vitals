/**
 * Power Profile data handler (PWRX §5). Reads only the local store: pulls every activity's power
 * stream and builds the mean-max curve, all-time bests, per-year curves, FTP + zones and the rider
 * radar. Weight/FTP come from settings, else are derived (weight from the latest weigh-in, FTP from
 * the 20-min best). Pure over injected deps — no live Garmin.
 */
import type { SettingsRepo } from '$lib/server/repo/types';
import type { ListActivitiesQuery, LocalStore } from '$lib/server/store/types';
import { buildPowerProfile, type PowerActivity } from '$lib/server/analytics/power-profile';
import { sportKeysInGroup } from '$lib/sport-labels';
import { toDayKey } from '$lib/date';
import type { PowerData, PowerRequest } from './power.types';

export interface PowerDeps {
  store: LocalStore;
  settings: SettingsRepo;
}

function numberSetting(settings: Record<string, unknown>, key: string): number | null {
  const v = settings[key];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

export async function loadPower(deps: PowerDeps, req: PowerRequest): Promise<PowerData> {
  // The sport-family filter runs IN the store (spec 025): the cycling page must not fold a
  // running-power activity into the rider-type radar, and the page no longer reads all history.
  const query: ListActivitiesQuery = {
    limit: 100000,
    ...(req.group ? { sports: sportKeysInGroup(req.group) } : {})
  };
  const [activities, userSettings, weighins] = await Promise.all([
    deps.store.listActivities(req.userId, query),
    deps.settings.get(req.userId),
    deps.store.getWeightRange(req.userId, '1900-01-01', '2999-12-31')
  ]);

  const ftpSetting = numberSetting(userSettings, 'ftpWatts');
  const weightSetting = numberSetting(userSettings, 'weightKg');

  // Weight: settings win; else the most recent weigh-in.
  let weightKg = weightSetting;
  let weightSource: PowerData['weightSource'] = weightSetting != null ? 'settings' : null;
  if (weightKg == null && weighins.length > 0) {
    weightKg = weighins[weighins.length - 1]!.weightKg;
    weightSource = 'measured';
  }

  // One batched query for just the power arrays (not full stream blobs) — avoids the N+1 + memory
  // blow-up that 502'd this page on the NAS. Only activities with a power stream come back.
  const powerById = await deps.store.getStreamField(
    req.userId,
    activities.map((a) => a.activityId),
    'power'
  );
  const powerActs: PowerActivity[] = activities.map((a) => ({
    activityId: a.activityId,
    day: toDayKey(a.startTimeLocal),
    power: powerById.get(a.activityId) ?? null
  }));

  const profile = buildPowerProfile(powerActs, {
    weightKg,
    ...(ftpSetting != null ? { ftpOverride: ftpSetting } : {})
  });

  return { ...profile, weightSource };
}
