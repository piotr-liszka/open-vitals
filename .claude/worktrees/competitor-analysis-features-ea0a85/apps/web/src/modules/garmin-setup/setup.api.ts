/** Pure Garmin-setup handler: forward credentials once to the sidecar, map the outcome. */
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

export async function setupGarmin(garmin: GarminService, body: unknown): Promise<SetupResult> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, body: { error: 'Wymagany jest prawidłowy adres e-mail i hasło.' } };
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
            error:
              'Błąd konfiguracji serwera: web i sidecar nie mają wspólnego INTERNAL_API_KEY. ' +
              'To nie jest problem z Twoim hasłem.'
          }
        };
      }
      return { status: 503, body: { error: 'Usługa Garmin jest niedostępna. Spróbuj za chwilę.' } };
    }
    throw err;
  }
}
