/** GarminService adapter that talks to the internal Python sidecar over HTTP. */
import type { Logger } from '../logger';
import {
  GarminNotAuthenticatedError,
  GarminUnavailableError,
  type ActivityLap,
  type GarminActivityDetails,
  type GarminFailure,
  type GarminFailureCode,
  type GarminLoginInput,
  type GarminLoginResult,
  type GarminMetricName,
  type GarminMetricRange,
  type GarminPlannedEvent,
  type GarminPlannedFeed,
  type GarminSyncSource,
  type GarminStatus,
  type GarminWeighIn,
  type GarminWorkoutDeleteResult,
  type GarminWorkoutInput,
  type GarminWorkoutScheduleResult,
  type GarminWorkoutWriteResult,
  type SidecarLogEntry
} from '../interfaces';

/** Subset of the fetch signature we depend on (injected so tests can mock it). */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface GarminHttpDeps {
  baseUrl: string;
  fetch: FetchLike;
  logger: Logger;
  /**
   * Internal user id sent as `X-User-Id` on EVERY sidecar call — the shared multi-tenant contract
   * (spec 012). The sidecar keys its per-user token store by this and returns 400 if it is missing.
   */
  userId: string;
  /**
   * Shared secret sent as `X-Internal-Key` (spec 055). Omitted when empty/undefined, which is the
   * "guardrail not configured" state both sides tolerate. Never logged.
   */
  internalKey?: string;
  /**
   * Per-request timeout (ms). A hung Garmin request must NOT freeze a whole sync (spec 019), so each
   * call is aborted after this and surfaces as GarminUnavailableError for the caller to record.
   */
  timeoutMs?: number;
}

interface RawStatus {
  authenticated?: boolean;
  display_name?: string;
  expires_at?: string;
}

export function createGarminHttpAdapter(deps: GarminHttpDeps): GarminSyncSource {
  const url = (path: string): string => `${deps.baseUrl}${path}`;

  const timeoutMs = deps.timeoutMs ?? 45_000;

  const call = async (path: string, init?: RequestInit): Promise<Response> => {
    // Scope every sidecar call to this user (multi-tenant contract). Merge, never clobber, callers' headers.
    // `X-Internal-Key` proves the caller IS the web tier — X-User-Id alone is only an assertion (spec 055).
    const headers = {
      ...(init?.headers as Record<string, string> | undefined),
      'X-User-Id': deps.userId,
      ...(deps.internalKey ? { 'X-Internal-Key': deps.internalKey } : {})
    };
    // Abort a hung request so it can never freeze a sync (a blocked/rate-limited Garmin call would
    // otherwise hang forever). The abort surfaces as GarminUnavailableError, which the caller records.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await deps.fetch(url(path), { ...init, headers, signal: controller.signal });
    } catch (err) {
      // A transport failure is either OUR timeout or the sidecar being unreachable, and the two need
      // different words on /dane ("Garmin nie odpowiedział" vs "sidecar nie działa") — spec 019.
      const timedOut = controller.signal.aborted;
      const failure: GarminFailure = timedOut
        ? {
            code: 'timeout',
            retryable: true,
            endpoint: endpointOf(path),
            reason: `timeout after ${timeoutMs} ms`
          }
        : {
            code: 'sidecar_unreachable',
            retryable: true,
            endpoint: endpointOf(path),
            reason: errorName(err)
          };
      deps.logger.error('garmin sidecar request failed', { path, timedOut, code: failure.code });
      throw new GarminUnavailableError(timedOut ? 'Garmin request timed out' : undefined, failure);
    } finally {
      clearTimeout(timer);
    }
  };

  /**
   * Turn a non-2xx sidecar response into a TYPED error carrying the sidecar's own classification.
   * The body is `{ detail, error: { code, reason, endpoint, retryable, upstreamStatus } }` (spec 019);
   * an older sidecar image sends only `detail`, which degrades to a status-derived code.
   */
  const fail = async (res: Response, path: string): Promise<never> => {
    const failure = await failureOf(res, path);
    deps.logger.error('garmin sidecar call failed', {
      path,
      status: res.status,
      code: failure.code,
      retryable: failure.retryable
    });
    if (failure.code === 'not_connected' || failure.code === 'token_rejected') {
      throw new GarminNotAuthenticatedError(undefined, failure);
    }
    throw new GarminUnavailableError(undefined, failure);
  };

  /** `ok`-or-throw guard used by every read below. */
  const ensureOk = async (res: Response, path: string): Promise<Response> => {
    if (!res.ok) await fail(res, path);
    return res;
  };

  const mapStatus = (raw: RawStatus): GarminStatus => ({
    authenticated: raw.authenticated === true,
    ...(raw.display_name ? { displayName: raw.display_name } : {}),
    ...(raw.expires_at ? { expiresAt: raw.expires_at } : {})
  });

  return {
    async login(input: GarminLoginInput): Promise<GarminLoginResult> {
      const res = await call('/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: input.email,
          password: input.password,
          ...(input.mfaCode ? { mfa_code: input.mfaCode } : {})
        })
      });

      if (res.ok) {
        const body = (await safeJson(res)) as { status?: RawStatus } | null;
        return { outcome: 'success', status: mapStatus(body?.status ?? { authenticated: true }) };
      }
      // 401 here is Garmin's own verdict on the email/password/MFA code. The sidecar's caller
      // guardrail answers 403 (below), so a key mismatch can never masquerade as a bad password.
      if (res.status === 401) return { outcome: 'invalid_credentials' };
      if (res.status === 403) {
        deps.logger.error(
          'sidecar rejected our internal key on login: set the same value for the web ' +
            'GARMIN_INTERNAL_KEY and the sidecar INTERNAL_API_KEY, then recreate both containers'
        );
        throw new GarminUnavailableError(undefined, {
          code: 'internal_key_rejected',
          retryable: false,
          status: 403,
          endpoint: 'login'
        });
      }
      if (res.status === 202 || res.status === 409) {
        const body = (await safeJson(res)) as { mfa_required?: boolean } | null;
        if (body?.mfa_required) return { outcome: 'mfa_required' };
      }
      deps.logger.error('unexpected garmin login response', { status: res.status });
      throw new GarminUnavailableError(undefined, {
        code: statusCode(res.status),
        retryable: res.status >= 500,
        status: res.status,
        endpoint: 'login'
      });
    },

    async getStatus(): Promise<GarminStatus> {
      const res = await ensureOk(await call('/status'), '/status');
      return mapStatus(((await safeJson(res)) as RawStatus | null) ?? {});
    },

    async getMetric(name: GarminMetricName, date?: string): Promise<unknown> {
      const query = date ? `?date=${encodeURIComponent(date)}` : '';
      const path = `/metrics/${name}${query}`;
      const res = await ensureOk(await call(path), path);
      return (await safeJson(res)) ?? null;
    },

    async getMetricRange(name: GarminMetricName, start: string, end: string): Promise<GarminMetricRange> {
      const query = `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
      const path = `/metrics/${name}/range${query}`;
      const res = await ensureOk(await call(path), path);
      const body = (await safeJson(res)) as Partial<GarminMetricRange> | null;
      return {
        metric: name,
        start,
        end,
        days: Array.isArray(body?.days) ? body.days : []
      };
    },

    async disconnect(): Promise<void> {
      const res = await call('/session', { method: 'DELETE' });
      if (!res.ok && res.status !== 404) await fail(res, '/session');
    },

    async listActivitiesPage(limit: number, start: number): Promise<unknown[]> {
      const path = `/activities?limit=${limit}&start=${start}`;
      const res = await ensureOk(await call(path), path);
      const body = await safeJson(res);
      return Array.isArray(body) ? body : [];
    },

    async getActivityDetails(activityId: string): Promise<GarminActivityDetails> {
      const path = `/activities/${encodeURIComponent(activityId)}/details`;
      const res = await ensureOk(await call(path), path);
      return parseActivityDetails(await safeJson(res), activityId);
    },

    async getWeightRange(start: string, end: string): Promise<GarminWeighIn[]> {
      const query = `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
      const path = `/weight/range${query}`;
      const res = await ensureOk(await call(path), path);
      const body = (await safeJson(res)) as { data?: unknown } | null;
      return parseWeighIns(body?.data);
    },

    async getPlannedEvents(start: string, end: string): Promise<GarminPlannedFeed> {
      const query = `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
      const path = `/calendar/planned${query}`;
      const res = await ensureOk(await call(path), path);
      return parsePlannedFeed(await safeJson(res), start, end);
    },

    async createWorkout(input: GarminWorkoutInput): Promise<GarminWorkoutWriteResult> {
      // The only mutating sidecar call besides login/disconnect (spec 050).
      const path = '/workouts';
      const res = await ensureOk(
        await call(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sport: input.sport,
            title: input.title,
            steps: input.steps,
            note: input.note
          })
        }),
        path
      );
      const body = (await safeJson(res)) as {
        supported?: unknown;
        workoutId?: unknown;
        reason?: unknown;
      } | null;
      const supported = body?.supported === true;
      return {
        supported,
        workoutId: supported ? textOrNull(body?.workoutId) : null,
        reason: textOrNull(body?.reason)
      };
    },

    async scheduleWorkout(garminWorkoutId: string, day: string): Promise<GarminWorkoutScheduleResult> {
      const path = `/workouts/${encodeURIComponent(garminWorkoutId)}/schedule`;
      const res = await ensureOk(
        await call(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ day })
        }),
        path
      );
      const body = (await safeJson(res)) as {
        supported?: unknown;
        scheduleId?: unknown;
        reason?: unknown;
      } | null;
      return {
        supported: body?.supported === true,
        scheduleId: textOrNull(body?.scheduleId),
        reason: textOrNull(body?.reason)
      };
    },

    async deleteWorkout(garminWorkoutId: string): Promise<GarminWorkoutDeleteResult> {
      const path = `/workouts/${encodeURIComponent(garminWorkoutId)}`;
      const res = await ensureOk(await call(path, { method: 'DELETE' }), path);
      const body = (await safeJson(res)) as { supported?: unknown; removed?: unknown } | null;
      return { supported: body?.supported === true, removed: body?.removed === true };
    },

    async getDiagnostics(limit = 100): Promise<SidecarLogEntry[]> {
      const path = `/diagnostics?limit=${Math.max(1, Math.min(400, Math.trunc(limit)))}`;
      const res = await ensureOk(await call(path), path);
      const body = (await safeJson(res)) as { entries?: unknown } | null;
      return parseSidecarLog(body?.entries);
    }
  };
}

/* ---------------- error classification ---------------- */

/** Sidecar path without its query string — a route, safe to log and to show. */
function endpointOf(path: string): string {
  return path.split('?')[0] ?? path;
}

function errorName(err: unknown): string {
  return err instanceof Error ? err.name : 'error';
}

/** Fallback classification when only an HTTP status is available. */
function statusCode(status: number): GarminFailureCode {
  if (status === 429) return 'rate_limited';
  if (status === 409) return 'not_connected';
  if (status === 404) return 'not_found';
  // The sidecar reserves 403 for its own internal-key gate — it never proxies a Garmin 403 as one
  // (that arrives classified as `blocked`), so this can only be the web<->sidecar secret (spec 055).
  if (status === 403) return 'internal_key_rejected';
  if (status === 504) return 'timeout';
  if (status >= 500) return 'upstream_error';
  return 'bad_response';
}

const FAILURE_CODES: ReadonlySet<string> = new Set<GarminFailureCode>([
  'timeout',
  'sidecar_unreachable',
  'rate_limited',
  'token_rejected',
  'not_connected',
  'blocked',
  'not_found',
  'bad_response',
  'internal_key_rejected',
  'upstream_error'
]);

/** Read the sidecar's structured `error` object off a failed response (spec 019). */
async function failureOf(res: Response, path: string): Promise<GarminFailure> {
  const body = (await safeJson(res)) as { error?: unknown } | null;
  const raw = isRecord(body?.error) ? body.error : {};
  const code =
    typeof raw.code === 'string' && FAILURE_CODES.has(raw.code)
      ? (raw.code as GarminFailureCode)
      : statusCode(res.status);
  return {
    code,
    retryable: typeof raw.retryable === 'boolean' ? raw.retryable : res.status >= 500 || res.status === 429,
    status: res.status,
    ...(typeof raw.upstreamStatus === 'number' ? { upstreamStatus: raw.upstreamStatus } : {}),
    endpoint: typeof raw.endpoint === 'string' && raw.endpoint ? raw.endpoint : endpointOf(path),
    ...(typeof raw.reason === 'string' && raw.reason ? { reason: raw.reason } : {})
  };
}

/* ---------------- planned events + diagnostics ---------------- */

const PLANNED_KINDS: ReadonlySet<string> = new Set(['workout', 'race', 'note']);

/** Normalize the sidecar's planned-calendar payload; anything malformed is dropped, never guessed. */
export function parsePlannedFeed(body: unknown, start: string, end: string): GarminPlannedFeed {
  const o = isRecord(body) ? body : {};
  const rows = Array.isArray(o.events) ? o.events : [];
  const events: GarminPlannedEvent[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const day = typeof row.day === 'string' ? row.day.slice(0, 10) : '';
    if (day.length !== 10) continue;
    const kind =
      typeof row.kind === 'string' && PLANNED_KINDS.has(row.kind)
        ? (row.kind as GarminPlannedEvent['kind'])
        : 'workout';
    events.push({
      id: typeof row.id === 'string' && row.id ? row.id : `${day}-${events.length}`,
      day,
      time: typeof row.time === 'string' && /^\d{2}:\d{2}$/.test(row.time) ? row.time : null,
      kind,
      title: typeof row.title === 'string' ? row.title : '',
      sport: typeof row.sport === 'string' && row.sport ? row.sport : null,
      description: typeof row.description === 'string' && row.description ? row.description : null,
      estimatedDurationS: finite(row.estimatedDurationS),
      estimatedDistanceM: finite(row.estimatedDistanceM),
      targetLoad: finite(row.targetLoad)
    });
  }
  return {
    start: typeof o.start === 'string' ? o.start : start,
    end: typeof o.end === 'string' ? o.end : end,
    available: o.available === true,
    events
  };
}

/** Normalize the sidecar diagnostics tail. Unknown/extra fields are dropped. */
export function parseSidecarLog(value: unknown): SidecarLogEntry[] {
  if (!Array.isArray(value)) return [];
  const out: SidecarLogEntry[] = [];
  for (const row of value) {
    if (!isRecord(row)) continue;
    const msg = typeof row.msg === 'string' ? row.msg : '';
    if (!msg) continue;
    out.push({
      t: finite(row.t) ?? 0,
      level: typeof row.level === 'string' ? row.level : 'info',
      logger: typeof row.logger === 'string' ? row.logger : 'garmin-sidecar',
      msg,
      ...(typeof row.code === 'string' ? { code: row.code } : {}),
      ...(typeof row.endpoint === 'string' ? { endpoint: row.endpoint } : {})
    });
  }
  return out;
}

/* ---------------- activity details ---------------- */

/**
 * Every numeric stream the details endpoint may carry, in the exact camelCase the sidecar emits.
 * Spelling them out (rather than spreading the body) is deliberate: the sidecar used to send
 * snake_case `heart_rate` while this side read `heartRate`, so HR was silently dropped on every
 * sync. An unknown key is now simply not a stream, and a renamed one fails the adapter test.
 */
const STREAM_KEYS = [
  'time',
  'heartRate',
  'power',
  'cadence',
  'fractionalCadence',
  'speed',
  'elevation',
  'grade',
  'temperature',
  'respirationRate',
  'verticalRatio',
  'verticalOscillation',
  'groundContactTime',
  'groundContactBalance',
  'strideLength',
  'stamina',
  'staminaPotential',
  'performanceCondition',
  'movingDuration',
  'moving'
] as const satisfies ReadonlyArray<keyof GarminActivityDetails>;

/** Legacy snake_case aliases still accepted from an older sidecar image (defence in depth). */
const STREAM_ALIASES: Readonly<Record<string, string>> = {
  heartRate: 'heart_rate',
  fractionalCadence: 'fractional_cadence',
  respirationRate: 'respiration_rate',
  verticalRatio: 'vertical_ratio',
  verticalOscillation: 'vertical_oscillation',
  groundContactTime: 'ground_contact_time',
  groundContactBalance: 'ground_contact_balance',
  strideLength: 'stride_length',
  staminaPotential: 'stamina_potential',
  performanceCondition: 'performance_condition',
  movingDuration: 'moving_duration'
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * An id/reason field as a non-empty string. Garmin returns workout ids as numbers about as often as
 * strings (spec 050), and the store column is text, so both are normalised here rather than at every
 * call site.
 */
function textOrNull(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Coerce an untrusted array into a dense number series. Garmin leaves gaps (nulls) in a column when
 * a sensor dropped out; those are carried forward from the previous sample (0 at the head) so index
 * alignment with the other streams is preserved and no NaN ever reaches the analytics. Returns
 * undefined when the value is not an array or holds no numbers at all.
 */
function numberSeries(value: unknown): number[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const out: number[] = [];
  let last = 0;
  let seen = false;
  for (const entry of value) {
    const n = finite(entry);
    if (n !== null) {
      last = n;
      seen = true;
    }
    out.push(last);
  }
  return seen ? out : undefined;
}

/** `[lat, lng]` / `[lat, lng, elevation]` tuples; malformed points are dropped. */
function gpsSeries(value: unknown): GarminActivityDetails['gps'] {
  if (!Array.isArray(value)) return undefined;
  const out: NonNullable<GarminActivityDetails['gps']> = [];
  for (const point of value) {
    if (!Array.isArray(point)) continue;
    const lat = finite(point[0]);
    const lng = finite(point[1]);
    if (lat === null || lng === null) continue;
    const alt = finite(point[2]);
    out.push(alt === null ? [lat, lng] : [lat, lng, alt]);
  }
  return out.length > 0 ? out : undefined;
}

/** Numeric lap fields, copied only when the sidecar sent a finite number. */
const LAP_NUMBER_KEYS = [
  'distanceM',
  'durationS',
  'movingDurationS',
  'elapsedDurationS',
  'avgSpeedMps',
  'maxSpeedMps',
  'avgHr',
  'maxHr',
  'avgPower',
  'maxPower',
  'normPower',
  'calories',
  'elevationGainM',
  'elevationLossM',
  'minElevationM',
  'maxElevationM',
  'avgRunCadenceSpm',
  'maxRunCadenceSpm',
  'avgStrideLengthCm',
  'avgGroundContactTimeMs',
  'avgGroundContactBalancePct',
  'avgVerticalOscillationCm',
  'avgVerticalRatio',
  'avgTemperatureC',
  'avgRespirationRate',
  'count'
] as const satisfies ReadonlyArray<keyof ActivityLap>;

const LAP_TEXT_KEYS = ['type', 'intensityType', 'startTimeGmt'] as const satisfies ReadonlyArray<
  keyof ActivityLap
>;

function parseLaps(value: unknown): ActivityLap[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const laps: ActivityLap[] = [];
  for (const [i, row] of value.entries()) {
    if (!isRecord(row)) continue;
    const lap: ActivityLap = { index: finite(row.index) ?? i + 1 };
    for (const key of LAP_NUMBER_KEYS) {
      const n = finite(row[key]);
      if (n !== null) lap[key] = n;
    }
    for (const key of LAP_TEXT_KEYS) {
      const v = row[key];
      if (typeof v === 'string' && v.length > 0) lap[key] = v;
    }
    laps.push(lap);
  }
  return laps.length > 0 ? laps : undefined;
}

/**
 * Normalize the sidecar's `/activities/{id}/details` body into `GarminActivityDetails`.
 * Exported for the adapter test; treats the whole payload as untrusted (AGENTS.md §10).
 */
export function parseActivityDetails(body: unknown, activityId: string): GarminActivityDetails {
  const o = isRecord(body) ? body : {};
  const details: GarminActivityDetails = { activityId };
  if (o.summary !== undefined) details.summary = o.summary;

  const gps = gpsSeries(o.gps);
  if (gps) details.gps = gps;

  for (const key of STREAM_KEYS) {
    const alias = STREAM_ALIASES[key];
    const series = numberSeries(o[key] ?? (alias ? o[alias] : undefined));
    if (series) details[key] = series;
  }

  const laps = parseLaps(o.laps);
  if (laps) details.laps = laps;
  const typedSplits = parseLaps(o.typedSplits);
  if (typedSplits) details.typedSplits = typedSplits;

  return details;
}

/**
 * Normalize the sidecar weigh-in payload (garmy's raw `weight/dateRange` shape) into kg points.
 * Garmin reports weight in GRAMS; convert. The payload shape is best-effort so we probe common keys
 * and degrade to an empty list rather than throwing (a missing field yields no point, never a crash).
 */
function parseWeighIns(data: unknown): GarminWeighIn[] {
  const rows = extractWeighInRows(data);
  const out: GarminWeighIn[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const grams = firstNumber(r, ['weight', 'weightGrams']);
    const day = weighInDay(r);
    if (grams === null || day === null) continue;
    out.push({ day, weightKg: Math.round((grams / 1000) * 100) / 100, raw: row });
  }
  return out;
}

/** garmy's weigh-in payload nests day-buckets under `dateWeightList` / `dailyWeightSummaries`; tolerate a few shapes. */
function extractWeighInRows(data: unknown): unknown[] {
  if (Array.isArray(data)) return data.flatMap((d) => extractWeighInRows(d));
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    for (const key of [
      'dateWeightList',
      'allMetrics',
      'measurements',
      'dailyWeightSummaries',
      'weightList'
    ]) {
      if (Array.isArray(o[key])) return (o[key] as unknown[]).flatMap((d) => extractWeighInRows(d));
    }
    if ('weight' in o || 'weightGrams' in o) return [o];
  }
  return [];
}

function firstNumber(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

function weighInDay(o: Record<string, unknown>): string | null {
  const direct = o['calendarDate'] ?? o['date'];
  if (typeof direct === 'string' && direct.length >= 10) return direct.slice(0, 10);
  const epoch = o['date'] ?? o['timestampGMT'] ?? o['weightDate'];
  if (typeof epoch === 'number' && Number.isFinite(epoch)) return new Date(epoch).toISOString().slice(0, 10);
  return null;
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
