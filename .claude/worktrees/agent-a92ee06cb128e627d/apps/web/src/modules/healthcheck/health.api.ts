/** Derive the Garmin health status from the sidecar, tolerating an unreachable sidecar. */
import { GarminUnavailableError, type GarminService } from '$lib/server/interfaces';
import type { HealthStatus } from './health.types';

export async function getHealth(garmin: GarminService): Promise<HealthStatus> {
  try {
    const status = await garmin.getStatus();
    return {
      connected: status.authenticated,
      displayName: status.displayName ?? null,
      expiresAt: status.expiresAt ?? null,
      reachable: true
    };
  } catch (err) {
    if (err instanceof GarminUnavailableError) {
      return { connected: false, displayName: null, expiresAt: null, reachable: false };
    }
    throw err;
  }
}
