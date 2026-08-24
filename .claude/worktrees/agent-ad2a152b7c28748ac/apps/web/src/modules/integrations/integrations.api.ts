/**
 * Pure integrations API handlers (start-auth, callback-exchange, run-sync, status, disconnect).
 * Everything runs over the injected {@link Integrations} bundle — no `fetch`/`env`/`Date.now()` — so
 * they're testable with mock clients + the memory store. Routes stay thin: they translate these
 * results into cookies + redirects + JSON.
 *
 * Security (AGENTS.md §10): OAuth `state` is validated constant-time; PKCE verifier + tokens never
 * appear in responses or logs; error strings are localized + secret-free.
 */
import { safeEqual } from '$lib/server/crypto';
import { codeChallengeS256 } from '$lib/server/auth/pkce';
import {
  IntegrationNotConnectedError,
  IntegrationRemoteError,
  type Integrations,
  type IntegrationProvider
} from '$lib/server/integrations/types';
import { syncWithingsWeight, linkStravaActivities } from '$lib/server/integrations/sync';
import type {
  BeginAuthResult,
  CompleteAuthResult,
  IntegrationsStatus,
  IntegrationTransaction,
  SyncActionResult
} from './integrations.types';

/** Widest safe date bounds for "all-time" store reads. */
const MIN_DAY = '0001-01-01';
const MAX_DAY = '9999-12-31';

/** Build the connection + provenance summary shown on both cards. */
export async function getIntegrationsStatus(deps: Integrations, userId: string): Promise<IntegrationsStatus> {
  const [stravaTokens, withingsTokens, links, weights] = await Promise.all([
    deps.tokens.get(userId, 'strava'),
    deps.tokens.get(userId, 'withings'),
    deps.links.list(userId),
    deps.store.getWeightRange(userId, MIN_DAY, MAX_DAY)
  ]);

  const withingsWeights = weights.filter((w) => w.source === 'withings');
  const days = withingsWeights.map((w) => w.day).sort();

  return {
    strava: {
      connected: stravaTokens !== null,
      athleteId: stravaTokens?.providerUserId ?? null,
      linkedCount: links.length
    },
    withings: {
      connected: withingsTokens !== null,
      weightCount: withingsWeights.length,
      firstDay: days[0] ?? null,
      lastDay: days[days.length - 1] ?? null
    }
  };
}

/** Mint state + PKCE and return the provider authorization URL + the transaction to stash. */
export async function beginAuth(deps: Integrations, provider: IntegrationProvider): Promise<BeginAuthResult> {
  const state = deps.random.token(24);
  const codeVerifier = deps.random.token(32);
  const codeChallenge = codeChallengeS256(codeVerifier);
  const client = provider === 'strava' ? deps.strava : deps.withings;
  const location = client.buildAuthUrl(state, codeChallenge);
  return { location, transaction: { state, codeVerifier } };
}

/**
 * Complete the OAuth callback: validate `state`, exchange the code, store the tokens. Missing code /
 * expired-or-mismatched transaction → localized failure (no throw); a provider rejection → failure.
 */
export async function completeAuth(
  deps: Integrations,
  provider: IntegrationProvider,
  input: { code: string | null; state: string | null; transaction: IntegrationTransaction | null },
  userId: string
): Promise<CompleteAuthResult> {
  const { transaction } = input;
  if (!transaction || !transaction.state || !transaction.codeVerifier) {
    return { ok: false, provider, error: 'Sesja połączenia wygasła. Spróbuj ponownie.' };
  }
  if (!input.code) {
    return { ok: false, provider, error: 'Brak kodu autoryzacji.' };
  }
  if (!input.state || !safeEqual(input.state, transaction.state)) {
    return { ok: false, provider, error: 'Nieprawidłowy stan połączenia. Spróbuj ponownie.' };
  }

  try {
    const client = provider === 'strava' ? deps.strava : deps.withings;
    const tokens = await client.exchangeCode(input.code, transaction.codeVerifier);
    await deps.tokens.set(userId, provider, tokens);
    return { ok: true, provider };
  } catch (err) {
    if (err instanceof IntegrationRemoteError) {
      return { ok: false, provider, error: 'Nie udało się połączyć z dostawcą. Spróbuj ponownie.' };
    }
    throw err;
  }
}

/** Run the provider's sync action. Throws {@link IntegrationNotConnectedError} when not connected. */
export async function runProviderSync(
  deps: Integrations,
  provider: IntegrationProvider,
  userId: string
): Promise<SyncActionResult> {
  if (provider === 'withings') {
    const r = await syncWithingsWeight(deps, userId);
    return { provider: 'withings', imported: r.imported, firstDay: r.firstDay, lastDay: r.lastDay };
  }
  const r = await linkStravaActivities(deps, userId);
  return { provider: 'strava', scanned: r.scanned, matched: r.matched, links: r.links };
}

/** Disconnect a provider: drop tokens (and Strava links, which are meaningless without them). */
export async function disconnect(
  deps: Integrations,
  provider: IntegrationProvider,
  userId: string
): Promise<void> {
  await deps.tokens.clear(userId, provider);
  if (provider === 'strava') await deps.links.clear(userId);
}

export { IntegrationNotConnectedError };
