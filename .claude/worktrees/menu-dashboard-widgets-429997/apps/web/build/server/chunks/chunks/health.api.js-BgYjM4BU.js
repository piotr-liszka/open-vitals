import { G as GarminUnavailableError } from './interfaces.js-CRv0EuSy.js';

async function getHealth(garmin) {
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

export { getHealth as g };
//# sourceMappingURL=health.api.js-BgYjM4BU.js.map
