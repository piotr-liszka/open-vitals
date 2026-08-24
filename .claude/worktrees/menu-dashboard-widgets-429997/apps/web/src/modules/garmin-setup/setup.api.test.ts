import { describe, it, expect } from 'vitest';
import { setupGarmin } from './setup.api';
import { createGarminMock } from '$lib/server/garmin/mock-adapter';
import { GarminUnavailableError, type GarminService } from '$lib/server/interfaces';

const creds = { email: 'a@b.co', password: 'pw' };

describe('garmin setup handler', () => {
  it('returns success and the display name', async () => {
    const garmin = createGarminMock({ status: { authenticated: false, displayName: 'Ada' } });
    const res = await setupGarmin(garmin, creds);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ outcome: 'success' });
    expect(garmin.calls.login[0]).toMatchObject({ email: 'a@b.co' });
  });

  it('signals mfa_required with 202', async () => {
    const garmin = createGarminMock({ loginOutcome: 'mfa_required' });
    const res = await setupGarmin(garmin, creds);
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ outcome: 'mfa_required' });
  });

  it('maps invalid credentials to 401', async () => {
    const garmin = createGarminMock({ loginOutcome: 'invalid_credentials' });
    const res = await setupGarmin(garmin, creds);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ outcome: 'invalid_credentials' });
  });

  it('validates the request body', async () => {
    const garmin = createGarminMock();
    const res = await setupGarmin(garmin, { email: 'not-an-email', password: '' });
    expect(res.status).toBe(400);
  });

  it('maps a sidecar outage to 503', async () => {
    const garmin: GarminService = {
      ...createGarminMock(),
      login: async () => {
        throw new GarminUnavailableError();
      }
    };
    const res = await setupGarmin(garmin, creds);
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'Usługa Garmin jest niedostępna. Spróbuj za chwilę.' });
  });

  it('names a web<->sidecar key mismatch instead of telling the user to retry', async () => {
    // This misconfiguration is not transient and is not the user's password; "spróbuj za chwilę"
    // would send them round the same loop forever.
    const garmin: GarminService = {
      ...createGarminMock(),
      login: async () => {
        throw new GarminUnavailableError(undefined, {
          code: 'internal_key_rejected',
          retryable: false,
          status: 403
        });
      }
    };
    const res = await setupGarmin(garmin, creds);
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ error: expect.stringContaining('INTERNAL_API_KEY') });
    expect((res.body as { error: string }).error).not.toContain('Spróbuj za chwilę');
  });
});
