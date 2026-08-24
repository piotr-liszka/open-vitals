/**
 * Product tier (spec 014). The app has two tiers:
 *   - **base**     — the user connects Garmin and gets a personal MCP URL; we process/display nothing.
 *   - **advanced** — the user accepts one "przetwarzanie danych" gate, unlocking pulpit/analityka/wnioski.
 *
 * The gate IS the single `detailed_analytics` consent (see consent/registry.ts). This helper keeps the
 * mapping in one place so loaders and the shell agree on what "advanced" means.
 */
import type { ConsentService } from './consent/types';

export type Tier = 'base' | 'advanced';

/** The consent feature id that gates the Advanced tier. */
export const ADVANCED_FEATURE = 'detailed_analytics';

/** True when the signed-in user has accepted the Advanced (data-processing) terms. */
export async function isAdvanced(consent: ConsentService): Promise<boolean> {
  return consent.isEnabled(ADVANCED_FEATURE);
}

/** Resolve the current tier for a user's consent state. */
export async function resolveTier(consent: ConsentService): Promise<Tier> {
  return (await isAdvanced(consent)) ? 'advanced' : 'base';
}
