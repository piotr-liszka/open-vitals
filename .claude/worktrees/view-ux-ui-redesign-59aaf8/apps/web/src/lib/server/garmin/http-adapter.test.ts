import { describe, it, expect, vi } from 'vitest';
import { createGarminHttpAdapter, parseActivityDetails, type FetchLike } from './http-adapter';
import { GarminNotAuthenticatedError, GarminUnavailableError } from '../interfaces';
import { nullLogger } from '../logger';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function adapterWith(fetchImpl: FetchLike, userId = 'user-1') {
  return createGarminHttpAdapter({
    baseUrl: 'http://garmin:8081',
    fetch: fetchImpl,
    logger: nullLogger,
    userId
  });
}

describe('GarminHttpAdapter', () => {
  it('sends the X-User-Id header on every sidecar call (multi-tenant contract)', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ authenticated: true }));
    const garmin = adapterWith(fetchImpl, 'user-abc');
    await garmin.getStatus();
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)['X-User-Id']).toBe('user-abc');
  });

  it('maps a successful login and forwards mfa_code only when present', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ status: { authenticated: true, display_name: 'Ada' } })
    );
    const garmin = adapterWith(fetchImpl);

    const result = await garmin.login({ email: 'a@b.co', password: 'pw' });

    expect(result).toEqual({ outcome: 'success', status: { authenticated: true, displayName: 'Ada' } });
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toEqual({ email: 'a@b.co', password: 'pw' });
    expect('mfa_code' in body).toBe(false);
  });

  it('detects an MFA challenge', async () => {
    const garmin = adapterWith(async () => jsonResponse({ mfa_required: true }, 409));
    expect(await garmin.login({ email: 'a@b.co', password: 'pw' })).toEqual({ outcome: 'mfa_required' });
  });

  it('reports invalid credentials on 401', async () => {
    const garmin = adapterWith(async () => jsonResponse({ error: 'bad' }, 401));
    expect(await garmin.login({ email: 'a@b.co', password: 'nope' })).toEqual({
      outcome: 'invalid_credentials'
    });
  });

  it('does NOT blame the user credentials when the sidecar rejects our internal key', async () => {
    // Regression (spec 055 fallout): the sidecar's caller guardrail used to answer 401, which this
    // adapter mapped to `invalid_credentials` — so a web<->sidecar key mismatch reached the user as
    // "Garmin odrzucił te dane. Sprawdź adres e-mail, hasło." It answers 403 now; keep it distinct.
    const garmin = adapterWith(async () => jsonResponse({ detail: 'unauthorized' }, 403));
    await expect(garmin.login({ email: 'a@b.co', password: 'pw' })).rejects.toMatchObject({
      name: 'GarminUnavailableError',
      failure: { code: 'internal_key_rejected', retryable: false, status: 403 }
    });
  });

  it('sends X-Internal-Key when configured, and omits it when empty', async () => {
    const withKey = vi.fn(async () => jsonResponse({ authenticated: true }));
    await createGarminHttpAdapter({
      baseUrl: 'http://garmin:8081',
      fetch: withKey,
      logger: nullLogger,
      userId: 'user-1',
      internalKey: 'shared-secret'
    }).getStatus();
    const sent = (withKey.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((sent.headers as Record<string, string>)['X-Internal-Key']).toBe('shared-secret');

    const noKey = vi.fn(async () => jsonResponse({ authenticated: true }));
    await adapterWith(noKey).getStatus();
    const bare = (noKey.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect('X-Internal-Key' in (bare.headers as Record<string, string>)).toBe(false);
  });

  it('returns metric data when authenticated', async () => {
    const garmin = adapterWith(async () => jsonResponse({ totalSteps: 8421 }));
    expect(await garmin.getMetric('steps', '2026-08-01')).toEqual({ totalSteps: 8421 });
  });

  it('throws GarminNotAuthenticatedError on 409 metric', async () => {
    const garmin = adapterWith(async () => jsonResponse({ error: 'not connected' }, 409));
    await expect(garmin.getMetric('sleep')).rejects.toBeInstanceOf(GarminNotAuthenticatedError);
  });

  it('wraps transport failures as GarminUnavailableError', async () => {
    const garmin = adapterWith(async () => {
      throw new Error('ECONNREFUSED');
    });
    await expect(garmin.getStatus()).rejects.toBeInstanceOf(GarminUnavailableError);
  });

  it('treats a 404 on disconnect as success (already cleared)', async () => {
    const garmin = adapterWith(async () => new Response(null, { status: 404 }));
    await expect(garmin.disconnect()).resolves.toBeUndefined();
  });

  it('reads the camelCase stream contract the sidecar emits — including heartRate', async () => {
    // Regression guard for the spec-023 data-loss bug: the sidecar sent `heart_rate`, this side read
    // `heartRate`, and HR was silently dropped from every synced activity. The sidecar has a mirror
    // test asserting it never emits a snake_case key again.
    const garmin = adapterWith(async () =>
      jsonResponse({
        activityId: 1000,
        summary: { averageHR: 150 },
        heartRate: [140, 145],
        power: [210, 215],
        time: [0, 1],
        respirationRate: [16, 17],
        groundContactTime: [250, 252],
        moving: [1, 0],
        gps: [
          [52.1, 21, 100],
          [52.2, 21.1]
        ]
      })
    );

    const d = await garmin.getActivityDetails('1000');

    expect(d.activityId).toBe('1000');
    expect(d.heartRate).toEqual([140, 145]);
    expect(d.power).toEqual([210, 215]);
    expect(d.respirationRate).toEqual([16, 17]);
    expect(d.groundContactTime).toEqual([250, 252]);
    expect(d.moving).toEqual([1, 0]);
    expect(d.gps).toEqual([
      [52.1, 21, 100],
      [52.2, 21.1]
    ]);
  });
});

describe('parseActivityDetails', () => {
  it('still accepts the legacy snake_case keys from an older sidecar image', () => {
    const d = parseActivityDetails({ heart_rate: [100, 101], respiration_rate: [15] }, 'a1');
    expect(d.heartRate).toEqual([100, 101]);
    expect(d.respirationRate).toEqual([15]);
  });

  it('carries gaps forward so streams stay index-aligned and NaN-free', () => {
    const d = parseActivityDetails({ heartRate: [null, 120, null, 130], power: [null, null] }, 'a1');
    expect(d.heartRate).toEqual([0, 120, 120, 130]);
    expect(d.power).toBeUndefined(); // no numbers at all → no stream
  });

  it('omits absent streams instead of returning empty arrays', () => {
    const d = parseActivityDetails({ heartRate: [100] }, 'a1');
    expect(d.heartRate).toEqual([100]);
    for (const key of ['power', 'gps', 'cadence', 'time', 'laps', 'typedSplits'] as const) {
      expect(d[key]).toBeUndefined();
    }
  });

  it('parses laps and typed splits, dropping malformed rows and fields', () => {
    const d = parseActivityDetails(
      {
        laps: [
          { index: 1, distanceM: 1000, durationS: 300, avgHr: 148, intensityType: 'ACTIVE', junk: 'x' },
          'not-a-lap',
          { distanceM: 'nope' }
        ],
        typedSplits: [{ index: 1, type: 'RWD_RUN', durationS: 480, count: 4 }]
      },
      'a1'
    );

    expect(d.laps).toHaveLength(2);
    expect(d.laps?.[0]).toEqual({
      index: 1,
      distanceM: 1000,
      durationS: 300,
      avgHr: 148,
      intensityType: 'ACTIVE'
    });
    expect(d.laps?.[1]).toEqual({ index: 3 }); // positional fallback, bad field dropped
    expect(d.typedSplits?.[0]).toEqual({ index: 1, type: 'RWD_RUN', durationS: 480, count: 4 });
  });

  it('never throws on a hostile payload', () => {
    for (const body of [null, undefined, 'nope', 42, [], { gps: 'x', heartRate: {}, laps: 7 }]) {
      expect(parseActivityDetails(body, 'a1')).toEqual({ activityId: 'a1' });
    }
  });
});

/* ------------------------------------------------------------------ *
 * Spec 019 — the diagnostic channel across the adapter boundary
 * ------------------------------------------------------------------ */

describe('GarminHttpAdapter — failure classification', () => {
  it("carries the sidecar's structured error through instead of flattening it", async () => {
    const garmin = adapterWith(async () =>
      jsonResponse(
        {
          detail: 'garmin request failed',
          error: {
            code: 'rate_limited',
            reason: 'rate_limited (HTTPError, HTTP 429)',
            endpoint: 'metrics/sleep/range',
            retryable: true,
            upstreamStatus: 429
          }
        },
        429
      )
    );

    await expect(garmin.getMetricRange('sleep', '2026-08-01', '2026-08-02')).rejects.toMatchObject({
      name: 'GarminUnavailableError',
      failure: {
        code: 'rate_limited',
        retryable: true,
        status: 429,
        upstreamStatus: 429,
        endpoint: 'metrics/sleep/range'
      }
    });
  });

  it('maps a rejected token to the not-authenticated error so the run aborts', async () => {
    const garmin = adapterWith(async () =>
      jsonResponse({ detail: 'not authenticated', error: { code: 'token_rejected', retryable: false } }, 409)
    );

    await expect(garmin.getMetric('sleep')).rejects.toMatchObject({
      name: 'GarminNotAuthenticatedError',
      failure: { code: 'token_rejected', retryable: false }
    });
  });

  it('distinguishes an unreachable sidecar from a request we timed out ourselves', async () => {
    const dead = adapterWith(async () => {
      throw new Error('ECONNREFUSED');
    });
    await expect(dead.getStatus()).rejects.toMatchObject({
      failure: { code: 'sidecar_unreachable', retryable: true }
    });

    // An aborted request surfaces as a timeout: the adapter's own AbortController fired.
    const hung = createGarminHttpAdapter({
      baseUrl: 'http://garmin:8081',
      fetch: (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
      logger: nullLogger,
      userId: 'u1',
      timeoutMs: 5
    });
    await expect(hung.getStatus()).rejects.toMatchObject({ failure: { code: 'timeout', retryable: true } });
  });

  it('falls back to a status-derived code for an older sidecar with no error object', async () => {
    const garmin = adapterWith(async () => jsonResponse({ detail: 'garmin request failed' }, 502));
    await expect(garmin.getMetric('sleep')).rejects.toMatchObject({
      failure: { code: 'upstream_error', retryable: true, status: 502, endpoint: '/metrics/sleep' }
    });
  });

  it('never puts credentials or a query string into the reported endpoint', async () => {
    const garmin = adapterWith(async () => jsonResponse({ detail: 'boom' }, 500));
    await expect(garmin.getWeightRange('2026-01-01', '2026-01-31')).rejects.toMatchObject({
      failure: { endpoint: '/weight/range' }
    });
  });
});

describe('GarminHttpAdapter — planned events + diagnostics (specs 019/024)', () => {
  it('normalizes the planned calendar and drops malformed rows', async () => {
    const garmin = adapterWith(async () =>
      jsonResponse({
        start: '2026-08-09',
        end: '2026-08-16',
        available: true,
        events: [
          {
            id: '5001',
            day: '2026-08-10',
            time: '18:00',
            kind: 'workout',
            title: 'Interwały',
            sport: 'running',
            description: null,
            estimatedDurationS: 3600,
            estimatedDistanceM: 12000,
            targetLoad: null
          },
          { day: 'nope' },
          'not-an-event'
        ]
      })
    );

    const feed = await garmin.getPlannedEvents!('2026-08-09', '2026-08-16');

    expect(feed.available).toBe(true);
    expect(feed.events).toHaveLength(1);
    expect(feed.events[0]).toMatchObject({
      id: '5001',
      kind: 'workout',
      time: '18:00',
      estimatedDistanceM: 12000
    });
  });

  it('reports an unavailable calendar as unavailable, never as an empty plan', async () => {
    const garmin = adapterWith(async () => jsonResponse({ available: false, events: [] }));
    const feed = await garmin.getPlannedEvents!('2026-08-09', '2026-08-16');
    expect(feed).toMatchObject({ available: false, events: [] });
  });

  /* ---- workout writes (spec 050) ---- */

  it('posts a workout and normalises a numeric Garmin id to text', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ supported: true, workoutId: 424242 }));
    const garmin = adapterWith(fetchImpl);

    const result = await garmin.createWorkout!({
      sport: 'running',
      title: '5x1km',
      steps: [
        {
          kind: 'work',
          durationType: 'distance',
          durationValue: 1000,
          target: { type: 'pace', low: 240, high: 250 },
          repeats: null,
          steps: null,
          note: null
        }
      ]
    });

    // The store column is text, and Garmin answers with a number about as often as a string.
    expect(result).toEqual({ supported: true, workoutId: '424242', reason: null });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://garmin:8081/workouts');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as { sport: string; steps: unknown[] };
    expect(body.sport).toBe('running');
    expect(body.steps).toHaveLength(1);
  });

  it('keeps an unsupported create unsupported, with no id', async () => {
    const garmin = adapterWith(async () =>
      jsonResponse({ supported: false, reason: 'unsupported_endpoint', workoutId: 999 })
    );

    // A `supported: false` answer must never yield an id — storing one would make the row look pushed.
    expect(await garmin.createWorkout!({ sport: 'running', title: 'x', steps: [] })).toEqual({
      supported: false,
      workoutId: null,
      reason: 'unsupported_endpoint'
    });
  });

  it('schedules a workout on a day and url-encodes the id', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ supported: true, scheduleId: 777 }));
    const garmin = adapterWith(fetchImpl);

    const result = await garmin.scheduleWorkout!('4242 42', '2026-08-20');

    expect(result).toEqual({ supported: true, scheduleId: '777', reason: null });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://garmin:8081/workouts/4242%2042/schedule');
    expect(JSON.parse(init.body as string)).toEqual({ day: '2026-08-20' });
  });

  it('deletes a workout upstream', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ supported: true, removed: true }));
    const garmin = adapterWith(fetchImpl);

    expect(await garmin.deleteWorkout!('424242')).toEqual({ supported: true, removed: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://garmin:8081/workouts/424242');
    expect(init.method).toBe('DELETE');
  });

  it('surfaces a sidecar failure on a write instead of pretending it landed', async () => {
    const garmin = adapterWith(async () => jsonResponse({ detail: 'nope', error: { code: 'blocked' } }, 502));

    await expect(garmin.createWorkout!({ sport: 'running', title: 'x', steps: [] })).rejects.toThrow(
      GarminUnavailableError
    );
  });

  it('reads the sidecar log tail and drops entries without a message', async () => {
    const garmin = adapterWith(async () =>
      jsonResponse({
        capacity: 400,
        entries: [
          {
            t: 1786434000,
            level: 'warning',
            logger: 'garmin-sidecar.metrics',
            msg: 'Upstream call failed (rate_limited).',
            code: 'rate_limited',
            endpoint: 'metrics/sleep'
          },
          { t: 1786434001, level: 'info', logger: 'garmin-sidecar' },
          'junk'
        ]
      })
    );

    const entries = await garmin.getDiagnostics!(50);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ level: 'warning', code: 'rate_limited', endpoint: 'metrics/sleep' });
  });
});
