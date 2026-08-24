/** Pure Garmin-setup handler: forward credentials once to the sidecar, map the outcome. */
import { createTranslator, type Locale } from '$lib/i18n';
import { z } from 'zod';
import { GarminUnavailableError, type GarminService } from '$lib/server/interfaces';
import type { SetupResponse } from './setup.types';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  mfaCode: z.string().trim().min(1).optional()
});

export interface SetupResult {
  status: number;
  body: SetupResponse;
}

/**
 * `locale` is taken as an argument rather than read from anywhere ambient (spec 076): these error
 * strings are shown to a person, so they must follow the language of the request that produced them.
 */
export async function setupGarmin(
  garmin: GarminService,
  body: unknown,
  locale: Locale
): Promise<SetupResult> {
  const t = createTranslator(locale);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: t('setup.invalidCredentials') } };
  }

  try {
    const result = await garmin.login({
      email: parsed.data.email,
      password: parsed.data.password,
      ...(parsed.data.mfaCode ? { mfaCode: parsed.data.mfaCode } : {})
    });

    switch (result.outcome) {
      case 'success':
        return { status: 200, body: { outcome: 'success', displayName: result.status.displayName ?? null } };
      case 'mfa_required':
        return { status: 202, body: { outcome: 'mfa_required' } };
      case 'invalid_credentials':
        return { status: 401, body: { outcome: 'invalid_credentials' } };
    }
  } catch (err) {
    if (err instanceof GarminUnavailableError) {
      // A key mismatch is a deployment fault: "spróbuj za chwilę" would be a lie, because no amount
      // of retrying fixes it. Name it, so it is never again mistaken for a wrong password.
      if (err.failure.code === 'internal_key_rejected') {
        return {
          status: 503,
          body: {
            error: t('setup.keyMismatch')
          }
        };
      }
      return { status: 503, body: { error: t('setup.serviceUnavailable') } };
    }
    throw err;
  }
}
