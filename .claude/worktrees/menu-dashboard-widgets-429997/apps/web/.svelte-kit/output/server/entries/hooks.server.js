import { redirect } from "@sveltejs/kit";
import { z } from "zod";
import { D as DEFAULT_TIME_ZONE, t as toDayKey, a as todayKey, m as maxDay, b as minDay, c as addDays, d as daysBetween } from "../chunks/date.js";
import { s as systemRandom, a as safeEqual } from "../chunks/crypto.js";
import { G as GarminUnavailableError, a as GarminNotAuthenticatedError, g as garminFailureOf, b as GARMIN_METRICS } from "../chunks/interfaces.js";
import { F as FEATURES } from "../chunks/registry.js";
import { T as TermsVersionMismatchError, U as UnknownFeatureError } from "../chunks/types.js";
import postgres from "postgres";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { A as AuthExchangeError } from "../chunks/types2.js";
import { i as isSportGroup, s as sportKeysInGroup } from "../chunks/sport-labels.js";
import { D as DuplicateGoalError, B as BEST_EFFORTS_VERSION, S as STREAMS_SCHEMA_VERSION } from "../chunks/types3.js";
import { e as extractMetricValue } from "../chunks/metric-specs.js";
import { b as bestEfforts } from "../chunks/best-efforts.js";
import { s as streamLength, e as elapsedSeconds, c as cumulativeDistance } from "../chunks/stream-axes.js";
function isKnownTimeZone(tz) {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /** Public origin (host:port) shown in the MCP URL card, e.g. http://192.168.1.10:3000 */
  PUBLIC_BASE_URL: z.string().url(),
  /** Internal URL of the Python Garmin sidecar (never LAN-exposed). */
  GARMIN_SIDECAR_URL: z.string().url().default("http://garmin:8081"),
  /**
   * Shared secret sent to the sidecar as `X-Internal-Key` on every call (spec 055). The sidecar
   * trusts `X-User-Id` to name a user, so reaching its port used to be enough to read anyone's
   * Garmin data; this makes network reachability insufficient on its own.
   *
   * Empty means "not configured": the header is omitted and the sidecar (which also treats it as
   * optional) stays open. That is deliberately NOT a hard boot failure — an in-place upgrade lands
   * on exactly that state, and refusing to start would take a running deployment down before its
   * `.env` could be edited. The container logs a warning in production instead; the guardrail is
   * live only once BOTH services have the same value set.
   */
  GARMIN_INTERNAL_KEY: z.string().default(""),
  /**
   * Which Garmin adapter to wire. `http` (default) talks to the real sidecar.
   * `mock` serves in-memory fixtures — DEV ONLY, for UI work without Garmin credentials.
   * A mock adapter in production is refused in loadConfig().
   */
  GARMIN_ADAPTER: z.enum(["http", "mock"]).default("http"),
  /** Session lifetime in seconds. */
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 12),
  /* ---- Dates (spec 018) ---- */
  /**
   * IANA timezone the app resolves "today" and renders timestamps in. App-scoped, not per-user:
   * this is a self-hosted single-household deployment and Garmin already reports days in the
   * wearer's local zone, so one configured zone is both correct and cheap. Default Europe/Warsaw.
   */
  APP_TIMEZONE: z.string().min(1).default(DEFAULT_TIME_ZONE),
  /* ---- Background sync (spec 027) ---- */
  /**
   * How often the background scheduler checks each user for new Garmin data, in minutes. A tick is
   * cheap because it fast-returns on an unchanged probe (spec 027), so the default is 30 minutes
   * rather than the nightly run this replaced. Floored at 5 so a typo cannot hammer Garmin.
   */
  SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(30),
  /* ---- Authored workouts (spec 050) ---- */
  /**
   * Whether the sync may PUSH locally authored workouts to Garmin. Off by default, because it is the
   * only code in this system that writes to the user's Garmin account and the workout endpoints are
   * unverified (garmy exposes none, so the sidecar calls them blind). Turn it on per deployment once
   * `scripts/verify-workout-push.sh` has confirmed create/schedule/delete against a real account.
   * With it off, authored workouts still live locally and simply stay `pending`.
   */
  GARMIN_WORKOUT_PUSH: z.enum(["on", "off"]).default("off").transform((v) => v === "on"),
  /* ---- Update check (spec 068) ---- */
  /** `owner/name` of the repo Settings checks for newer commits. */
  UPDATE_CHECK_REPO: z.string().default("piotr-liszka/garmin-bridge"),
  /** Branch production tracks. */
  UPDATE_CHECK_BRANCH: z.string().min(1).default("main"),
  /**
   * GitHub token with read access to that repo. Optional: without it the Settings card reports
   * "not configured" instead of failing, so the app runs exactly as before until someone opts in.
   * A fine-grained token with read-only Contents on this one repo is enough.
   */
  GITHUB_TOKEN: z.string().default(""),
  /* ---- Datastore (spec 012) ---- */
  /** Postgres connection string (postgres://user:pass@host:port/db). */
  DATABASE_URL: z.string().url(),
  /* ---- Google OIDC (spec 012) ---- */
  /**
   * Which auth adapter to wire. `oidc` (default) is real Google Sign-In.
   * `mock` signs in a fixed dev user with NO network — refused in production.
   */
  AUTH_ADAPTER: z.enum(["oidc", "mock"]).default("oidc"),
  /** Google OAuth client id. Optional so dev/tests run without it (required for the oidc adapter). */
  GOOGLE_CLIENT_ID: z.string().default(""),
  /** Google OAuth client secret. Optional so dev/tests run without it (required for the oidc adapter). */
  GOOGLE_CLIENT_SECRET: z.string().default("")
});
function loadConfig(env = process.env) {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid configuration:
${issues}`);
  }
  const v = parsed.data;
  const isProd = v.NODE_ENV === "production";
  if (isProd && v.GARMIN_ADAPTER === "mock") {
    throw new Error(
      'Invalid configuration:\n  - GARMIN_ADAPTER: "mock" is not allowed when NODE_ENV=production'
    );
  }
  if (isProd && v.AUTH_ADAPTER === "mock") {
    throw new Error(
      'Invalid configuration:\n  - AUTH_ADAPTER: "mock" is not allowed when NODE_ENV=production'
    );
  }
  if (!isKnownTimeZone(v.APP_TIMEZONE)) {
    throw new Error(
      `Invalid configuration:
  - APP_TIMEZONE: "${v.APP_TIMEZONE}" is not a known IANA timezone`
    );
  }
  if (v.AUTH_ADAPTER === "oidc" && (!v.GOOGLE_CLIENT_ID || !v.GOOGLE_CLIENT_SECRET)) {
    throw new Error(
      "Invalid configuration:\n  - GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are required when AUTH_ADAPTER=oidc"
    );
  }
  return {
    nodeEnv: v.NODE_ENV,
    publicBaseUrl: v.PUBLIC_BASE_URL.replace(/\/$/, ""),
    garminSidecarUrl: v.GARMIN_SIDECAR_URL.replace(/\/$/, ""),
    garminInternalKey: v.GARMIN_INTERNAL_KEY,
    garminAdapter: v.GARMIN_ADAPTER,
    sessionTtlSeconds: v.SESSION_TTL_SECONDS,
    appTimeZone: v.APP_TIMEZONE,
    syncIntervalMinutes: v.SYNC_INTERVAL_MINUTES,
    garminWorkoutPush: v.GARMIN_WORKOUT_PUSH,
    updateCheckRepo: v.UPDATE_CHECK_REPO,
    updateCheckBranch: v.UPDATE_CHECK_BRANCH,
    githubToken: v.GITHUB_TOKEN,
    databaseUrl: v.DATABASE_URL,
    authAdapter: v.AUTH_ADAPTER,
    googleClientId: v.GOOGLE_CLIENT_ID,
    googleClientSecret: v.GOOGLE_CLIENT_SECRET,
    isProd
  };
}
const systemClock = {
  now: () => /* @__PURE__ */ new Date(),
  nowSeconds: () => Math.floor(Date.now() / 1e3)
};
const LEVEL_ORDER = { debug: 10, info: 20, warn: 30, error: 40 };
const REDACT_KEYS = /pass(word)?|secret|token|cookie|authorization|mfa|email|credential|session/i;
const MAX_DEPTH = 6;
function redactValue(value, depth, seen) {
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, depth + 1, seen));
  if (value instanceof Error) return { name: value.name, message: value.message };
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = REDACT_KEYS.test(k) ? "[redacted]" : redactValue(v, depth + 1, seen);
  }
  return out;
}
function redact(meta) {
  if (!meta) return void 0;
  return redactValue(meta, 0, /* @__PURE__ */ new WeakSet());
}
function createLogger(minLevel = "info", sink = console) {
  const emit = (level, msg, meta) => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
    const line = { level, msg, ...redact(meta) ?? {} };
    if (level === "error") sink.error(JSON.stringify(line));
    else sink.log(JSON.stringify(line));
  };
  return {
    debug: (m, meta) => emit("debug", m, meta),
    info: (m, meta) => emit("info", m, meta),
    warn: (m, meta) => emit("warn", m, meta),
    error: (m, meta) => emit("error", m, meta)
  };
}
function createSessionService(deps) {
  const cookieName = deps.cookieName ?? "gb_session";
  return {
    cookieName,
    maxAgeSeconds: deps.ttlSeconds,
    async issue(userId) {
      const expiresAt = new Date(deps.clock.now().getTime() + deps.ttlSeconds * 1e3);
      return deps.sessions.create({ userId, expiresAt });
    },
    async resolve(sessionId) {
      if (!sessionId) return null;
      const row = await deps.sessions.find(sessionId);
      if (!row) return null;
      if (row.expiresAt.getTime() <= deps.clock.now().getTime()) return null;
      return deps.users.findById(row.userId);
    },
    async destroy(sessionId) {
      await deps.sessions.delete(sessionId);
    },
    async sweepExpired() {
      return deps.sessions.deleteExpired(deps.clock.now());
    }
  };
}
function createGarminHttpAdapter(deps) {
  const url = (path) => `${deps.baseUrl}${path}`;
  const timeoutMs = deps.timeoutMs ?? 45e3;
  const call = async (path, init) => {
    const headers = {
      ...init?.headers,
      "X-User-Id": deps.userId,
      ...deps.internalKey ? { "X-Internal-Key": deps.internalKey } : {}
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await deps.fetch(url(path), { ...init, headers, signal: controller.signal });
    } catch (err) {
      const timedOut = controller.signal.aborted;
      const failure = timedOut ? {
        code: "timeout",
        retryable: true,
        endpoint: endpointOf(path),
        reason: `timeout after ${timeoutMs} ms`
      } : {
        code: "sidecar_unreachable",
        retryable: true,
        endpoint: endpointOf(path),
        reason: errorName(err)
      };
      deps.logger.error("garmin sidecar request failed", { path, timedOut, code: failure.code });
      throw new GarminUnavailableError(timedOut ? "Garmin request timed out" : void 0, failure);
    } finally {
      clearTimeout(timer);
    }
  };
  const fail = async (res, path) => {
    const failure = await failureOf(res, path);
    deps.logger.error("garmin sidecar call failed", {
      path,
      status: res.status,
      code: failure.code,
      retryable: failure.retryable
    });
    if (failure.code === "not_connected" || failure.code === "token_rejected") {
      throw new GarminNotAuthenticatedError(void 0, failure);
    }
    throw new GarminUnavailableError(void 0, failure);
  };
  const ensureOk = async (res, path) => {
    if (!res.ok) await fail(res, path);
    return res;
  };
  const mapStatus = (raw) => ({
    authenticated: raw.authenticated === true,
    ...raw.display_name ? { displayName: raw.display_name } : {},
    ...raw.expires_at ? { expiresAt: raw.expires_at } : {}
  });
  return {
    async login(input) {
      const res = await call("/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: input.email,
          password: input.password,
          ...input.mfaCode ? { mfa_code: input.mfaCode } : {}
        })
      });
      if (res.ok) {
        const body = await safeJson(res);
        return { outcome: "success", status: mapStatus(body?.status ?? { authenticated: true }) };
      }
      if (res.status === 401) return { outcome: "invalid_credentials" };
      if (res.status === 403) {
        deps.logger.error(
          "sidecar rejected our internal key on login: set the same value for the web GARMIN_INTERNAL_KEY and the sidecar INTERNAL_API_KEY, then recreate both containers"
        );
        throw new GarminUnavailableError(void 0, {
          code: "internal_key_rejected",
          retryable: false,
          status: 403,
          endpoint: "login"
        });
      }
      if (res.status === 202 || res.status === 409) {
        const body = await safeJson(res);
        if (body?.mfa_required) return { outcome: "mfa_required" };
      }
      deps.logger.error("unexpected garmin login response", { status: res.status });
      throw new GarminUnavailableError(void 0, {
        code: statusCode(res.status),
        retryable: res.status >= 500,
        status: res.status,
        endpoint: "login"
      });
    },
    async getStatus() {
      const res = await ensureOk(await call("/status"), "/status");
      return mapStatus(await safeJson(res) ?? {});
    },
    async getMetric(name, date) {
      const query = date ? `?date=${encodeURIComponent(date)}` : "";
      const path = `/metrics/${name}${query}`;
      const res = await ensureOk(await call(path), path);
      return await safeJson(res) ?? null;
    },
    async getMetricRange(name, start, end) {
      const query = `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
      const path = `/metrics/${name}/range${query}`;
      const res = await ensureOk(await call(path), path);
      const body = await safeJson(res);
      return {
        metric: name,
        start,
        end,
        days: Array.isArray(body?.days) ? body.days : []
      };
    },
    async disconnect() {
      const res = await call("/session", { method: "DELETE" });
      if (!res.ok && res.status !== 404) await fail(res, "/session");
    },
    async listActivitiesPage(limit, start) {
      const path = `/activities?limit=${limit}&start=${start}`;
      const res = await ensureOk(await call(path), path);
      const body = await safeJson(res);
      return Array.isArray(body) ? body : [];
    },
    async getActivityDetails(activityId) {
      const path = `/activities/${encodeURIComponent(activityId)}/details`;
      const res = await ensureOk(await call(path), path);
      return parseActivityDetails(await safeJson(res), activityId);
    },
    async getWeightRange(start, end) {
      const query = `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
      const path = `/weight/range${query}`;
      const res = await ensureOk(await call(path), path);
      const body = await safeJson(res);
      return parseWeighIns(body?.data);
    },
    async getPlannedEvents(start, end) {
      const query = `?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
      const path = `/calendar/planned${query}`;
      const res = await ensureOk(await call(path), path);
      return parsePlannedFeed(await safeJson(res), start, end);
    },
    async createWorkout(input) {
      const path = "/workouts";
      const res = await ensureOk(
        await call(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sport: input.sport, title: input.title, steps: input.steps })
        }),
        path
      );
      const body = await safeJson(res);
      const supported = body?.supported === true;
      return {
        supported,
        workoutId: supported ? textOrNull(body?.workoutId) : null,
        reason: textOrNull(body?.reason)
      };
    },
    async scheduleWorkout(garminWorkoutId, day) {
      const path = `/workouts/${encodeURIComponent(garminWorkoutId)}/schedule`;
      const res = await ensureOk(
        await call(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ day })
        }),
        path
      );
      const body = await safeJson(res);
      return {
        supported: body?.supported === true,
        scheduleId: textOrNull(body?.scheduleId),
        reason: textOrNull(body?.reason)
      };
    },
    async deleteWorkout(garminWorkoutId) {
      const path = `/workouts/${encodeURIComponent(garminWorkoutId)}`;
      const res = await ensureOk(await call(path, { method: "DELETE" }), path);
      const body = await safeJson(res);
      return { supported: body?.supported === true, removed: body?.removed === true };
    },
    async getDiagnostics(limit = 100) {
      const path = `/diagnostics?limit=${Math.max(1, Math.min(400, Math.trunc(limit)))}`;
      const res = await ensureOk(await call(path), path);
      const body = await safeJson(res);
      return parseSidecarLog(body?.entries);
    }
  };
}
function endpointOf(path) {
  return path.split("?")[0] ?? path;
}
function errorName(err) {
  return err instanceof Error ? err.name : "error";
}
function statusCode(status) {
  if (status === 429) return "rate_limited";
  if (status === 409) return "not_connected";
  if (status === 404) return "not_found";
  if (status === 403) return "internal_key_rejected";
  if (status === 504) return "timeout";
  if (status >= 500) return "upstream_error";
  return "bad_response";
}
const FAILURE_CODES = /* @__PURE__ */ new Set([
  "timeout",
  "sidecar_unreachable",
  "rate_limited",
  "token_rejected",
  "not_connected",
  "blocked",
  "not_found",
  "bad_response",
  "internal_key_rejected",
  "upstream_error"
]);
async function failureOf(res, path) {
  const body = await safeJson(res);
  const raw = isRecord(body?.error) ? body.error : {};
  const code = typeof raw.code === "string" && FAILURE_CODES.has(raw.code) ? raw.code : statusCode(res.status);
  return {
    code,
    retryable: typeof raw.retryable === "boolean" ? raw.retryable : res.status >= 500 || res.status === 429,
    status: res.status,
    ...typeof raw.upstreamStatus === "number" ? { upstreamStatus: raw.upstreamStatus } : {},
    endpoint: typeof raw.endpoint === "string" && raw.endpoint ? raw.endpoint : endpointOf(path),
    ...typeof raw.reason === "string" && raw.reason ? { reason: raw.reason } : {}
  };
}
const PLANNED_KINDS = /* @__PURE__ */ new Set(["workout", "race", "note"]);
function parsePlannedFeed(body, start, end) {
  const o = isRecord(body) ? body : {};
  const rows = Array.isArray(o.events) ? o.events : [];
  const events = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const day = typeof row.day === "string" ? row.day.slice(0, 10) : "";
    if (day.length !== 10) continue;
    const kind = typeof row.kind === "string" && PLANNED_KINDS.has(row.kind) ? row.kind : "workout";
    events.push({
      id: typeof row.id === "string" && row.id ? row.id : `${day}-${events.length}`,
      day,
      time: typeof row.time === "string" && /^\d{2}:\d{2}$/.test(row.time) ? row.time : null,
      kind,
      title: typeof row.title === "string" ? row.title : "",
      sport: typeof row.sport === "string" && row.sport ? row.sport : null,
      description: typeof row.description === "string" && row.description ? row.description : null,
      estimatedDurationS: finite(row.estimatedDurationS),
      estimatedDistanceM: finite(row.estimatedDistanceM),
      targetLoad: finite(row.targetLoad)
    });
  }
  return {
    start: typeof o.start === "string" ? o.start : start,
    end: typeof o.end === "string" ? o.end : end,
    available: o.available === true,
    events
  };
}
function parseSidecarLog(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const row of value) {
    if (!isRecord(row)) continue;
    const msg = typeof row.msg === "string" ? row.msg : "";
    if (!msg) continue;
    out.push({
      t: finite(row.t) ?? 0,
      level: typeof row.level === "string" ? row.level : "info",
      logger: typeof row.logger === "string" ? row.logger : "garmin-sidecar",
      msg,
      ...typeof row.code === "string" ? { code: row.code } : {},
      ...typeof row.endpoint === "string" ? { endpoint: row.endpoint } : {}
    });
  }
  return out;
}
const STREAM_KEYS = [
  "time",
  "heartRate",
  "power",
  "cadence",
  "fractionalCadence",
  "speed",
  "elevation",
  "grade",
  "temperature",
  "respirationRate",
  "verticalRatio",
  "verticalOscillation",
  "groundContactTime",
  "groundContactBalance",
  "strideLength",
  "stamina",
  "staminaPotential",
  "performanceCondition",
  "movingDuration",
  "moving"
];
const STREAM_ALIASES = {
  heartRate: "heart_rate",
  fractionalCadence: "fractional_cadence",
  respirationRate: "respiration_rate",
  verticalRatio: "vertical_ratio",
  verticalOscillation: "vertical_oscillation",
  groundContactTime: "ground_contact_time",
  groundContactBalance: "ground_contact_balance",
  strideLength: "stride_length",
  staminaPotential: "stamina_potential",
  performanceCondition: "performance_condition",
  movingDuration: "moving_duration"
};
const isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
function textOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function numberSeries(value) {
  if (!Array.isArray(value) || value.length === 0) return void 0;
  const out = [];
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
  return seen ? out : void 0;
}
function gpsSeries(value) {
  if (!Array.isArray(value)) return void 0;
  const out = [];
  for (const point of value) {
    if (!Array.isArray(point)) continue;
    const lat = finite(point[0]);
    const lng = finite(point[1]);
    if (lat === null || lng === null) continue;
    const alt = finite(point[2]);
    out.push(alt === null ? [lat, lng] : [lat, lng, alt]);
  }
  return out.length > 0 ? out : void 0;
}
const LAP_NUMBER_KEYS = [
  "distanceM",
  "durationS",
  "movingDurationS",
  "elapsedDurationS",
  "avgSpeedMps",
  "maxSpeedMps",
  "avgHr",
  "maxHr",
  "avgPower",
  "maxPower",
  "normPower",
  "calories",
  "elevationGainM",
  "elevationLossM",
  "minElevationM",
  "maxElevationM",
  "avgRunCadenceSpm",
  "maxRunCadenceSpm",
  "avgStrideLengthCm",
  "avgGroundContactTimeMs",
  "avgGroundContactBalancePct",
  "avgVerticalOscillationCm",
  "avgVerticalRatio",
  "avgTemperatureC",
  "avgRespirationRate",
  "count"
];
const LAP_TEXT_KEYS = ["type", "intensityType", "startTimeGmt"];
function parseLaps(value) {
  if (!Array.isArray(value)) return void 0;
  const laps = [];
  for (const [i, row] of value.entries()) {
    if (!isRecord(row)) continue;
    const lap = { index: finite(row.index) ?? i + 1 };
    for (const key2 of LAP_NUMBER_KEYS) {
      const n = finite(row[key2]);
      if (n !== null) lap[key2] = n;
    }
    for (const key2 of LAP_TEXT_KEYS) {
      const v = row[key2];
      if (typeof v === "string" && v.length > 0) lap[key2] = v;
    }
    laps.push(lap);
  }
  return laps.length > 0 ? laps : void 0;
}
function parseActivityDetails(body, activityId) {
  const o = isRecord(body) ? body : {};
  const details = { activityId };
  if (o.summary !== void 0) details.summary = o.summary;
  const gps = gpsSeries(o.gps);
  if (gps) details.gps = gps;
  for (const key2 of STREAM_KEYS) {
    const alias = STREAM_ALIASES[key2];
    const series = numberSeries(o[key2] ?? (alias ? o[alias] : void 0));
    if (series) details[key2] = series;
  }
  const laps = parseLaps(o.laps);
  if (laps) details.laps = laps;
  const typedSplits = parseLaps(o.typedSplits);
  if (typedSplits) details.typedSplits = typedSplits;
  return details;
}
function parseWeighIns(data) {
  const rows = extractWeighInRows(data);
  const out = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row;
    const grams = firstNumber(r, ["weight", "weightGrams"]);
    const day = weighInDay(r);
    if (grams === null || day === null) continue;
    out.push({ day, weightKg: Math.round(grams / 1e3 * 100) / 100, raw: row });
  }
  return out;
}
function extractWeighInRows(data) {
  if (Array.isArray(data)) return data.flatMap((d) => extractWeighInRows(d));
  if (data && typeof data === "object") {
    const o = data;
    for (const key2 of [
      "dateWeightList",
      "allMetrics",
      "measurements",
      "dailyWeightSummaries",
      "weightList"
    ]) {
      if (Array.isArray(o[key2])) return o[key2].flatMap((d) => extractWeighInRows(d));
    }
    if ("weight" in o || "weightGrams" in o) return [o];
  }
  return [];
}
function firstNumber(o, keys) {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}
function weighInDay(o) {
  const direct = o["calendarDate"] ?? o["date"];
  if (typeof direct === "string" && direct.length >= 10) return direct.slice(0, 10);
  const epoch = o["date"] ?? o["timestampGMT"] ?? o["weightDate"];
  if (typeof epoch === "number" && Number.isFinite(epoch)) return new Date(epoch).toISOString().slice(0, 10);
  return null;
}
async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
function eachDate(start, end) {
  const out = [];
  const s = /* @__PURE__ */ new Date(`${start}T00:00:00Z`);
  const e = /* @__PURE__ */ new Date(`${end}T00:00:00Z`);
  for (let d = s; d.getTime() <= e.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
function seeded(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1e5 / 1e5;
}
function around(metric, date, base, spread) {
  return Math.round((base + (seeded(`${metric}:${date}`) - 0.5) * 2 * spread) * 100) / 100;
}
function metricForDate(name, rawDate, salt) {
  const date = `${salt}:${rawDate}`;
  switch (name) {
    case "steps":
      return {
        totalSteps: Math.round(around("steps", date, 9200, 3500)),
        stepGoal: 1e4,
        distanceMeters: Math.round(around("dist", date, 7100, 2600)),
        activeMinutes: Math.round(around("active", date, 62, 30))
      };
    case "resting_heart_rate":
      return { restingHeartRate: Math.round(around("rhr", date, 52, 5)), unit: "bpm" };
    case "body_battery": {
      const SLOT_MS = 15 * 60 * 1e3;
      const SLOTS = 96;
      const WAKE_SLOT = 28;
      const midnight = Date.parse(`${rawDate}T00:00:00Z`);
      const low = Math.round(around("bb-lo", date, 22, 8));
      const peak = Math.round(around("bb-hi", date, 86, 6));
      const dusk = Math.round(around("bb-cur", date, 38, 12));
      const lerp = (a, b, t) => Math.round(a + (b - a) * t);
      return {
        bodyBatteryValuesArray: Array.from({ length: SLOTS }, (_, i) => {
          const level = i <= WAKE_SLOT ? lerp(low, peak, i / WAKE_SLOT) : lerp(peak, dusk, (i - WAKE_SLOT) / (SLOTS - 1 - WAKE_SLOT));
          return [midnight + i * SLOT_MS, "MEASURED", Math.min(100, Math.max(5, level)), 3];
        })
      };
    }
    case "sleep": {
      const total = Math.round(around("sleep-dur", date, 7.1 * 3600, 3600));
      const deep = Math.round(total * 0.18);
      const rem = Math.round(total * 0.22);
      const awake = Math.round(total * 0.06);
      return {
        dailySleepDTO: {
          sleepTimeSeconds: total,
          deepSleepSeconds: deep,
          remSleepSeconds: rem,
          lightSleepSeconds: total - deep - rem - awake,
          awakeSleepSeconds: awake
        },
        sleepScores: { overall: { value: Math.round(around("sleep-score", date, 78, 14)) } }
      };
    }
    case "hrv":
      return {
        hrvSummary: {
          lastNightAvg: Math.round(around("hrv", date, 62, 12)),
          weeklyAvg: 60,
          status: seeded(`hrvstat:${date}`) > 0.3 ? "BALANCED" : "LOW"
        }
      };
    case "stress":
      return {
        avgStressLevel: Math.round(around("stress", date, 34, 12)),
        maxStressLevel: Math.round(around("stress-max", date, 78, 12))
      };
    case "spo2":
      return {
        averageSpo2: Math.round(around("spo2", date, 96, 2)),
        lowestSpo2: Math.round(around("spo2-lo", date, 92, 3))
      };
    case "respiration":
      return {
        avgWakingRespirationValue: Math.round(around("resp", date, 14, 2)),
        lowestRespirationValue: Math.round(around("resp-lo", date, 11, 2)),
        highestRespirationValue: Math.round(around("resp-hi", date, 19, 3))
      };
    case "calories":
      return {
        totalKilocalories: Math.round(around("cal", date, 2650, 500)),
        activeKilocalories: Math.round(around("cal-act", date, 720, 350)),
        bmrKilocalories: 1680
      };
    case "training_readiness": {
      const score = Math.round(around("tr-score", date, 46, 34));
      const clamped = Math.min(99, Math.max(1, score));
      const recovery = Math.max(0, Math.round(around("tr-rec", date, 18, 22)));
      return {
        calendarDate: rawDate,
        score: clamped,
        level: clamped >= 75 ? "HIGH" : clamped >= 50 ? "MODERATE" : clamped >= 25 ? "LOW" : "POOR",
        feedbackShort: "RECOVERY_TIME_LIMITED",
        sleepScore: Math.round(around("tr-sleep", date, 78, 14)),
        sleepScoreFactorPercent: Math.round(around("tr-sleepf", date, 70, 25)),
        sleepHistoryFactorPercent: Math.round(around("tr-sleeph", date, 65, 25)),
        hrvFactorPercent: Math.round(around("tr-hrv", date, 60, 30)),
        hrvWeeklyAverage: Math.round(around("tr-hrvw", date, 61, 8)),
        recoveryTime: recovery,
        recoveryTimeFactorPercent: Math.round(around("tr-recf", date, 45, 40)),
        recoveryTimeChangePhrase: null,
        acwrFactorPercent: Math.round(around("tr-acwr", date, 72, 22)),
        acuteLoad: Math.round(around("tr-load", date, 290, 90)),
        stressHistoryFactorPercent: Math.round(around("tr-stress", date, 58, 28))
      };
    }
    case "body_composition":
      return {
        weightKg: around("weight", date, 74.2, 0.6),
        bodyFatPct: around("bf", date, 17.5, 1.2),
        muscleMassKg: around("muscle", date, 34.1, 0.5)
      };
    case "activities":
      return seeded(`act:${date}`) > 0.5 ? [
        {
          type: "running",
          name: "Morning Run",
          durationSeconds: Math.round(around("act-dur", date, 2700, 900)),
          distanceMeters: Math.round(around("act-dist", date, 6500, 2500)),
          calories: Math.round(around("act-cal", date, 520, 180)),
          avgHeartRate: Math.round(around("act-hr", date, 148, 12)),
          startTime: `${rawDate}T06:40:00`
        }
      ] : [];
    default:
      return { name, date };
  }
}
const DEV_SPORTS = ["cycling", "virtual_ride", "running", "walking", "hiking"];
const DEV_ACTIVITY_COUNT = 140;
function devActivity(salt, index) {
  const s = (k) => seeded(`${salt}:act${index}:${k}`);
  const daysAgo = Math.round(index * 3.4 + s("jitter") * 2);
  const start = new Date(Date.UTC(2026, 7, 8) - daysAgo * 864e5);
  const yyyy = start.getUTCFullYear();
  const mm = String(start.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(start.getUTCDate()).padStart(2, "0");
  const hh = String(6 + Math.floor(s("hour") * 12)).padStart(2, "0");
  const local = `${yyyy}-${mm}-${dd} ${hh}:15:00`;
  const sport = DEV_SPORTS[index % DEV_SPORTS.length];
  const isRide = sport === "cycling" || sport === "virtual_ride";
  const isVirtual = sport === "virtual_ride";
  const dur = Math.round(isRide ? 3600 + s("d") * 5400 : 1800 + s("d") * 3600);
  const dist = Math.round(isRide ? 25e3 + s("dist") * 6e4 : 5e3 + s("dist") * 12e3);
  const avgP = isRide ? Math.round(150 + s("p") * 90) : 0;
  return {
    activityId: 9e5 + index,
    activityName: isVirtual ? "Zwift - Pacer Group Ride" : isRide ? "Road Ride" : sport === "running" ? "Tempo Run" : "Easy Walk",
    activityType: { typeKey: sport },
    startTimeLocal: local,
    startTimeGMT: `${yyyy}-${mm}-${dd} ${hh}:15:00`,
    distance: dist,
    duration: dur,
    movingDuration: Math.round(dur * 0.96),
    elevationGain: Math.round(isRide ? 100 + s("e") * 900 : 30 + s("e") * 300),
    averageHR: Math.round(120 + s("hr") * 40),
    maxHR: Math.round(160 + s("hrm") * 25),
    avgPower: avgP,
    maxPower: avgP ? Math.round(avgP * (2.5 + s("pm"))) : 0,
    normPower: avgP ? Math.round(avgP * 1.08) : 0,
    calories: Math.round(isRide ? 600 + s("c") * 900 : 300 + s("c") * 400),
    bmrCalories: Math.round(dur / 60 * 1.2),
    activityTrainingLoad: Math.round(40 + s("tl") * 120),
    hasPolyline: !isVirtual,
    // virtual rides carry a synthetic map in reality; keep them non-GPS here
    // The rich fields Garmin already returns on the activity list (spec 023) — the detail page
    // projects these out of `raw`, so the dev fixtures must carry them or the page looks empty.
    aerobicTrainingEffect: Math.round((2 + s("ate") * 3) * 10) / 10,
    anaerobicTrainingEffect: Math.round(s("nte") * 2 * 10) / 10,
    trainingEffectLabel: isRide ? "TEMPO" : "AEROBIC_BASE",
    waterEstimated: Math.round(400 + s("w") * 900),
    avgRespirationRate: Math.round((26 + s("rr") * 8) * 10) / 10,
    minRespirationRate: Math.round((14 + s("rrl") * 4) * 10) / 10,
    maxRespirationRate: Math.round((38 + s("rrh") * 8) * 10) / 10,
    hrTimeInZone_1: Math.round(dur * 0.15),
    hrTimeInZone_2: Math.round(dur * 0.35),
    hrTimeInZone_3: Math.round(dur * 0.3),
    hrTimeInZone_4: Math.round(dur * 0.15),
    hrTimeInZone_5: Math.round(dur * 0.05),
    elapsedDuration: Math.round(dur * 1.02),
    elevationLoss: Math.round(isRide ? 100 + s("el") * 900 : 30 + s("el") * 300),
    minElevation: Math.round(80 + s("mine") * 40),
    maxElevation: Math.round(200 + s("maxe") * 600),
    averageSpeed: Math.round(dist / dur * 100) / 100,
    maxSpeed: Math.round(dist / dur * 1.6 * 100) / 100,
    minTemperature: Math.round(10 + s("tmin") * 6),
    maxTemperature: Math.round(22 + s("tmax") * 8),
    moderateIntensityMinutes: Math.round(dur / 120),
    vigorousIntensityMinutes: Math.round(dur / 240),
    differenceBodyBattery: -Math.round(10 + s("bb") * 30),
    differenceStress: Math.round(s("ds") * 20 - 10),
    avgStress: Math.round(30 + s("as") * 25),
    maxStress: Math.round(70 + s("ms") * 25),
    beginPotentialStamina: Math.round(92 + s("bps") * 8),
    endPotentialStamina: Math.round(60 + s("eps") * 25),
    minAvailableStamina: Math.round(20 + s("mas") * 30),
    ...isRide ? {} : {
      averageRunningCadenceInStepsPerMinute: Math.round(168 + s("rc") * 10),
      maxRunningCadenceInStepsPerMinute: Math.round(184 + s("rcm") * 10),
      avgStrideLength: Math.round(110 + s("sl") * 20),
      avgVerticalRatio: Math.round((7 + s("vr")) * 10) / 10,
      avgVerticalOscillation: Math.round((8.5 + s("vo")) * 10) / 10,
      avgGroundContactBalance: Math.round((49 + s("gcb") * 2) * 10) / 10,
      avgGroundContactTime: Math.round(240 + s("gct") * 30)
    }
  };
}
function createDevGarminMock(userId) {
  const salt = userId;
  const status = {
    authenticated: true,
    // Vary the display name per user so isolation is visible at a glance in the UI.
    displayName: `Dev Athlete ${salt.slice(0, 6)}`,
    expiresAt: "2027-01-01T00:00:00Z"
  };
  return {
    async login(_input) {
      return { outcome: "success", status };
    },
    async getStatus() {
      return status;
    },
    async getMetric(name, date) {
      const day = date ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      return { metric: name, date: day, data: metricForDate(name, day, salt) };
    },
    async getMetricRange(name, start, end) {
      const days = eachDate(start, end).map((date) => ({ date, data: metricForDate(name, date, salt) }));
      return { metric: name, start, end, days };
    },
    async disconnect() {
    },
    async listActivitiesPage(limit, start) {
      if (start >= DEV_ACTIVITY_COUNT) return [];
      const end = Math.min(start + limit, DEV_ACTIVITY_COUNT);
      const page = [];
      for (let i = start; i < end; i++) page.push(devActivity(salt, i));
      return page;
    },
    async getActivityDetails(activityId) {
      const index = Number(activityId) - 9e5;
      const a = devActivity(salt, Number.isFinite(index) && index >= 0 ? index : 0);
      const hasGps = a.hasPolyline === true;
      const isRun = a.activityType && typeof a.activityType === "object" && a.activityType.typeKey === "running";
      const n = 120;
      const s = (k) => seeded(`${salt}:det${activityId}:${k}`);
      const baseLat = 50.02 + (s("lat") - 0.5) * 0.4;
      const baseLng = 8.34 + (s("lng") - 0.5) * 0.4;
      const avgP = typeof a.avgPower === "number" ? a.avgPower : 0;
      const duration = typeof a.duration === "number" ? a.duration : 3600;
      const gps = [];
      const heartRate = [];
      const power = [];
      const time = [];
      const elevation = [];
      const cadence = [];
      const respirationRate = [];
      const temperature = [];
      const groundContactTime = [];
      const verticalOscillation = [];
      const verticalRatio = [];
      const strideLength = [];
      const moving = [];
      const speed = [];
      const avgSpeedMps = typeof a.distance === "number" && duration > 0 ? a.distance / duration : 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const ang = t * Math.PI * 2;
        if (hasGps) {
          gps.push([
            Math.round((baseLat + Math.sin(ang) * 0.03 + s(`la${i}`) * 1e-3) * 1e5) / 1e5,
            Math.round((baseLng + Math.cos(ang) * 0.045 + s(`ln${i}`) * 1e-3) * 1e5) / 1e5,
            Math.round(180 + Math.sin(ang * 3) * 60)
          ]);
          elevation.push(Math.round(180 + Math.sin(ang * 3) * 60));
        }
        heartRate.push(Math.round(120 + Math.sin(ang * 2) * 20 + s(`h${i}`) * 8));
        if (avgP)
          power.push(
            Math.max(0, Math.round(avgP + Math.sin(ang * 5) * avgP * 0.6 + (s(`p${i}`) - 0.5) * 80))
          );
        time.push(Math.round(i / n * duration));
        cadence.push(Math.round((isRun ? 172 : 88) + Math.sin(ang * 4) * 6));
        respirationRate.push(Math.round((28 + Math.sin(ang * 2) * 6) * 10) / 10);
        temperature.push(Math.round((18 + Math.sin(ang) * 4) * 10) / 10);
        const isMoving = !(isRun && i % 37 === 0);
        moving.push(isMoving ? 1 : 0);
        if (avgSpeedMps > 0) {
          const shape = 1 + Math.sin(ang * 3) * 0.22 + (s(`v${i}`) - 0.5) * 0.08;
          speed.push(Math.round(avgSpeedMps * shape * (isMoving ? 1 : 0.35) * 1e3) / 1e3);
        }
        if (isRun) {
          groundContactTime.push(Math.round(250 + Math.sin(ang * 3) * 15));
          verticalOscillation.push(Math.round((9 + Math.sin(ang * 3) * 0.8) * 10) / 10);
          verticalRatio.push(Math.round((7.5 + Math.sin(ang * 3) * 0.4) * 10) / 10);
          strideLength.push(Math.round(118 + Math.sin(ang * 3) * 8));
        }
      }
      const lapCount = 4;
      const laps = Array.from({ length: lapCount }, (_, i) => ({
        index: i + 1,
        distanceM: Math.round((typeof a.distance === "number" ? a.distance : 1e4) / lapCount),
        durationS: Math.round(duration / lapCount),
        movingDurationS: Math.round(duration / lapCount * 0.97),
        avgHr: Math.round(135 + i * 4),
        maxHr: Math.round(150 + i * 4),
        ...avgP ? { avgPower: Math.round(avgP * (0.9 + i * 0.05)) } : {},
        ...isRun ? { avgRunCadenceSpm: 170 + i, avgStrideLengthCm: 116 + i * 2 } : {},
        intensityType: "ACTIVE"
      }));
      const details = {
        activityId,
        summary: a,
        heartRate,
        time,
        cadence,
        respirationRate,
        temperature,
        moving,
        laps
      };
      if (hasGps) {
        details.gps = gps;
        details.elevation = elevation;
      }
      if (avgP) details.power = power;
      if (speed.length > 0) details.speed = speed;
      if (isRun) {
        details.groundContactTime = groundContactTime;
        details.verticalOscillation = verticalOscillation;
        details.verticalRatio = verticalRatio;
        details.strideLength = strideLength;
        const walkS = Math.round(duration * moving.filter((m) => m === 0).length / n);
        details.typedSplits = [
          {
            index: 1,
            type: "RWD_RUN",
            durationS: duration - walkS,
            distanceM: typeof a.distance === "number" ? a.distance : 1e4,
            count: 3
          },
          { index: 2, type: "RWD_WALK", durationS: walkS, distanceM: 120, count: 3 }
        ];
      }
      return details;
    },
    async getWeightRange(start, end) {
      const out = [];
      for (const date of eachDate(start, end)) {
        if (seeded(`${salt}:weigh:${date}`) > 0.25) continue;
        out.push({
          day: date,
          weightKg: around("weight", `${salt}:${date}`, 74.2, 0.8),
          raw: { source: "dev" }
        });
      }
      return out;
    },
    /* ---- workout writes (spec 050) ----
     * Accepted and given a fake id so the whole authoring → push flow is exercisable in dev with no
     * Garmin account. Nothing leaves the process: `make dev` must never touch a real calendar. The
     * counter (rather than a random id) keeps dev runs reproducible.
     */
    async createWorkout() {
      devWorkoutSeq += 1;
      return { supported: true, workoutId: `dev-w-${devWorkoutSeq}`, reason: null };
    },
    async scheduleWorkout(garminWorkoutId) {
      return { supported: true, scheduleId: `dev-s-${garminWorkoutId}`, reason: null };
    },
    async deleteWorkout() {
      return { supported: true, removed: true };
    }
  };
}
let devWorkoutSeq = 0;
function createPgConsentStore(sql, clock) {
  return {
    async get(userId) {
      const rows = await sql`
        SELECT feature_id, terms_version, accepted_at FROM consents WHERE user_id = ${userId}`;
      const out = {};
      for (const row of rows) {
        out[row.feature_id] = {
          termsVersion: row.terms_version,
          acceptedAt: row.accepted_at instanceof Date ? row.accepted_at.toISOString() : String(row.accepted_at)
        };
      }
      return out;
    },
    async set(userId, featureId, termsVersion) {
      const acceptedAt = clock.now().toISOString();
      await sql`
        INSERT INTO consents (user_id, feature_id, terms_version, accepted_at)
        VALUES (${userId}, ${featureId}, ${termsVersion}, ${acceptedAt})
        ON CONFLICT (user_id, feature_id)
          DO UPDATE SET terms_version = EXCLUDED.terms_version, accepted_at = EXCLUDED.accepted_at`;
    },
    async revoke(userId, featureId) {
      await sql`DELETE FROM consents WHERE user_id = ${userId} AND feature_id = ${featureId}`;
    }
  };
}
function resolve(feature, records) {
  const record = records[feature.id];
  const enabled = feature.requiresConsent ? record?.termsVersion === feature.termsVersion : feature.defaultEnabled;
  const base = {
    id: feature.id,
    title: feature.title,
    summary: feature.summary,
    termsVersion: feature.termsVersion,
    termsText: feature.termsText,
    requiresConsent: feature.requiresConsent,
    enabled
  };
  return enabled && record?.termsVersion === feature.termsVersion && record?.acceptedAt ? { ...base, acceptedAt: record.acceptedAt } : base;
}
function createConsentService(deps) {
  const features = deps.features ?? FEATURES;
  const { store, userId } = deps;
  const find = (id) => {
    const f = features.find((x) => x.id === id);
    if (!f) throw new UnknownFeatureError(id);
    return f;
  };
  return {
    async listFeatures() {
      const records = await store.get(userId);
      return features.map((f) => resolve(f, records));
    },
    async isEnabled(featureId) {
      const feature = find(featureId);
      const records = await store.get(userId);
      return resolve(feature, records).enabled;
    },
    async accept(featureId, termsVersion) {
      const feature = find(featureId);
      if (termsVersion !== feature.termsVersion) throw new TermsVersionMismatchError();
      if (feature.requiresConsent) await store.set(userId, featureId, termsVersion);
      return resolve(feature, await store.get(userId));
    },
    async revoke(featureId) {
      const feature = find(featureId);
      await store.revoke(userId, featureId);
      return resolve(feature, await store.get(userId));
    }
  };
}
const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS users (
    id          text PRIMARY KEY,
    google_sub  text UNIQUE NOT NULL,
    email       text,
    name        text,
    avatar_url  text,
    created_at  timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id          text PRIMARY KEY,
    user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS consents (
    user_id       text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature_id    text NOT NULL,
    terms_version text NOT NULL,
    accepted_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, feature_id)
  )`,
  `CREATE TABLE IF NOT EXISTS mcp_tokens (
    user_id     text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    token       text UNIQUE NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    user_id     text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data        jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at  timestamptz NOT NULL DEFAULT now()
  )`,
  // spec 015: local synced-data store
  `CREATE TABLE IF NOT EXISTS synced_metric_days (
    user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric     text NOT NULL,
    day        date NOT NULL,
    data       jsonb,
    synced_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, metric, day)
  )`,
  `CREATE TABLE IF NOT EXISTS synced_activities (
    user_id           text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id       text NOT NULL,
    sport             text NOT NULL,
    name              text,
    start_time        timestamptz NOT NULL,
    start_time_local  text NOT NULL,
    distance_m        double precision,
    duration_s        double precision,
    moving_s          double precision,
    elevation_gain_m  double precision,
    avg_hr            integer,
    max_hr            integer,
    avg_power         integer,
    max_power         integer,
    norm_power        integer,
    calories          integer,
    training_load     double precision,
    has_gps           boolean NOT NULL DEFAULT false,
    raw               jsonb,
    synced_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, activity_id)
  )`,
  `CREATE INDEX IF NOT EXISTS synced_activities_user_start_idx ON synced_activities(user_id, start_time_local DESC)`,
  `CREATE INDEX IF NOT EXISTS synced_activities_user_sport_idx ON synced_activities(user_id, sport)`,
  `CREATE TABLE IF NOT EXISTS synced_activity_streams (
    user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id text NOT NULL,
    streams     jsonb NOT NULL,
    efforts_v   integer,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, activity_id)
  )`,
  // Upgrade older stream tables in place (spec 054: best-efforts derivation marker).
  `ALTER TABLE synced_activity_streams ADD COLUMN IF NOT EXISTS efforts_v integer`,
  // spec 054: all-time best efforts (see schemaSql for why the marker is not a sentinel row here).
  `CREATE TABLE IF NOT EXISTS synced_activity_best_efforts (
    user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id     text NOT NULL,
    distance_key    text NOT NULL,
    distance_m      integer NOT NULL,
    duration_s      double precision NOT NULL,
    actual_m        double precision NOT NULL,
    pace_sec_per_km double precision NOT NULL,
    start_s         double precision NOT NULL,
    samples         integer NOT NULL DEFAULT 0,
    sport           text NOT NULL,
    day             date NOT NULL,
    computed_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, activity_id, distance_key)
  )`,
  `CREATE INDEX IF NOT EXISTS synced_activity_best_efforts_rank_idx
    ON synced_activity_best_efforts(user_id, distance_key, duration_s ASC)`,
  `CREATE TABLE IF NOT EXISTS synced_weight (
    user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day        date NOT NULL,
    source     text NOT NULL,
    weight_kg  double precision NOT NULL,
    raw        jsonb,
    synced_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, day, source)
  )`,
  // spec 024: planned workouts / races from Garmin's training calendar
  `CREATE TABLE IF NOT EXISTS synced_planned_events (
    user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id    text NOT NULL,
    day         date NOT NULL,
    time_local  text,
    kind        text NOT NULL,
    title       text,
    sport       text,
    description text,
    duration_s  double precision,
    distance_m  double precision,
    target_load double precision,
    source      text NOT NULL DEFAULT 'garmin',
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, event_id)
  )`,
  `CREATE INDEX IF NOT EXISTS synced_planned_events_user_day_idx ON synced_planned_events(user_id, day)`,
  // spec 050: workouts authored HERE and pushed to Garmin (see schemaSql for why it is its own table)
  `CREATE TABLE IF NOT EXISTS authored_workouts (
    id                  text PRIMARY KEY,
    user_id             text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day                 date NOT NULL,
    time_local          text,
    sport               text NOT NULL,
    title               text NOT NULL,
    steps               jsonb NOT NULL,
    note                text,
    push_state          text NOT NULL DEFAULT 'pending',
    push_error          text,
    garmin_workout_id   text,
    garmin_schedule_id  text,
    matched_activity_id text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS authored_workouts_user_day_idx ON authored_workouts(user_id, day)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS authored_workouts_user_garmin_idx
    ON authored_workouts(user_id, garmin_workout_id) WHERE garmin_workout_id IS NOT NULL`,
  // spec 069: the workout LIBRARY — reusable sessions with no date. Its own table rather than a
  // nullable day on authored_workouts, because a row there means "committed to on this day" and
  // making that optional would force every read of a plan to ask "but is it real?". No FK back from
  // authored_workouts on purpose: scheduling COPIES the steps, so a library edit can never rewrite a
  // session already on the athlete's watch.
  `CREATE TABLE IF NOT EXISTS workout_templates (
    id         text PRIMARY KEY,
    user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sport      text NOT NULL,
    title      text NOT NULL,
    steps      jsonb NOT NULL,
    note       text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS workout_templates_user_title_idx ON workout_templates(user_id, title)`,
  `CREATE TABLE IF NOT EXISTS season_goals (
    id               text PRIMARY KEY,
    user_id          text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day              date NOT NULL,
    sport            text NOT NULL,
    title            text NOT NULL,
    kind             text NOT NULL DEFAULT 'race',
    priority         text NOT NULL DEFAULT 'a',
    distance_m       double precision,
    target_time_s    double precision,
    target_ctl       double precision,
    note             text,
    source           text NOT NULL DEFAULT 'manual',
    garmin_event_id  text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS season_goals_user_day_idx ON season_goals(user_id, day)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS season_goals_user_event_idx
    ON season_goals(user_id, garmin_event_id) WHERE garmin_event_id IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS sync_state (
    user_id            text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source             text NOT NULL,
    cursor             jsonb NOT NULL DEFAULT '{}'::jsonb,
    last_full_sync_at  timestamptz,
    last_sync_at       timestamptz,
    PRIMARY KEY (user_id, source)
  )`,
  `CREATE TABLE IF NOT EXISTS sync_runs (
    id           text PRIMARY KEY,
    user_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind         text NOT NULL,
    status       text NOT NULL,
    started_at   timestamptz NOT NULL DEFAULT now(),
    finished_at  timestamptz,
    total        integer NOT NULL DEFAULT 0,
    done         integer NOT NULL DEFAULT 0,
    step         text,
    error        text,
    detail       jsonb
  )`,
  // Upgrade older sync_runs tables in place (spec 019: per-phase detail).
  `ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS detail jsonb`,
  `CREATE INDEX IF NOT EXISTS sync_runs_user_started_idx ON sync_runs(user_id, started_at DESC)`
];
function createDb(databaseUrl) {
  return postgres(databaseUrl, {
    // Keep types plain; we map rows explicitly in the adapters.
    transform: { undefined: null }
  });
}
async function migrate(sql) {
  for (const statement of MIGRATIONS) {
    await sql.unsafe(statement);
  }
}
function toUser(row) {
  return {
    id: row.id,
    googleSub: row.google_sub,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
  };
}
function createPgUserRepo(sql, random = systemRandom) {
  return {
    async findByGoogleSub(googleSub) {
      const rows = await sql`
        SELECT id, google_sub, email, name, avatar_url, created_at
        FROM users WHERE google_sub = ${googleSub} LIMIT 1`;
      return rows[0] ? toUser(rows[0]) : null;
    },
    async findById(id) {
      const rows = await sql`
        SELECT id, google_sub, email, name, avatar_url, created_at
        FROM users WHERE id = ${id} LIMIT 1`;
      return rows[0] ? toUser(rows[0]) : null;
    },
    async listIds() {
      const rows = await sql`SELECT id FROM users`;
      return rows.map((r) => r.id);
    },
    async upsertFromIdentity(identity) {
      const id = random.token(16);
      const rows = await sql`
        INSERT INTO users (id, google_sub, email, name, avatar_url)
        VALUES (${id}, ${identity.googleSub}, ${identity.email}, ${identity.name}, ${identity.avatarUrl})
        ON CONFLICT (google_sub) DO UPDATE
          SET email = EXCLUDED.email, name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url
        RETURNING id, google_sub, email, name, avatar_url, created_at`;
      return toUser(rows[0]);
    }
  };
}
function createPgSessionRepo(sql, random = systemRandom) {
  return {
    async create({ userId, expiresAt }) {
      const id = random.token(32);
      await sql`
        INSERT INTO sessions (id, user_id, expires_at)
        VALUES (${id}, ${userId}, ${expiresAt})`;
      return id;
    },
    async find(id) {
      const rows = await sql`
        SELECT user_id, expires_at FROM sessions WHERE id = ${id} LIMIT 1`;
      const row = rows[0];
      if (!row) return null;
      const out = {
        userId: row.user_id,
        expiresAt: row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at)
      };
      return out;
    },
    async delete(id) {
      await sql`DELETE FROM sessions WHERE id = ${id}`;
    },
    async deleteExpired(before) {
      const rows = await sql`
        DELETE FROM sessions WHERE expires_at <= ${before} RETURNING id`;
      return rows.length;
    }
  };
}
function createPgMcpTokenRepo(sql, random = systemRandom) {
  return {
    async getOrCreate(userId) {
      const token = random.token(32);
      const rows = await sql`
        INSERT INTO mcp_tokens (user_id, token)
        VALUES (${userId}, ${token})
        ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
        RETURNING token`;
      return rows[0].token;
    },
    async resolve(token) {
      const rows = await sql`
        SELECT user_id FROM mcp_tokens WHERE token = ${token} LIMIT 1`;
      return rows[0]?.user_id ?? null;
    },
    async rotate(userId) {
      const token = random.token(32);
      const rows = await sql`
        INSERT INTO mcp_tokens (user_id, token)
        VALUES (${userId}, ${token})
        ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token, created_at = now()
        RETURNING token`;
      return rows[0].token;
    }
  };
}
function createPgSettingsRepo(sql) {
  return {
    async get(userId) {
      const rows = await sql`
        SELECT data FROM settings WHERE user_id = ${userId} LIMIT 1`;
      return rows[0]?.data ?? {};
    },
    async set(userId, settings) {
      await sql`
        INSERT INTO settings (user_id, data)
        VALUES (${userId}, ${sql.json(settings)})
        ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
    }
  };
}
function createPgRepo(sql, random = systemRandom) {
  return {
    users: createPgUserRepo(sql, random),
    sessions: createPgSessionRepo(sql, random),
    mcpTokens: createPgMcpTokenRepo(sql, random),
    settings: createPgSettingsRepo(sql)
  };
}
const DEFAULT_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration";
const SCOPE = "openid email profile";
function isDiscovery(v) {
  if (!v || typeof v !== "object") return false;
  const d = v;
  return typeof d.issuer === "string" && typeof d.authorization_endpoint === "string" && typeof d.token_endpoint === "string" && typeof d.jwks_uri === "string";
}
function createOidcAuthProvider(deps) {
  const discoveryUrl = deps.discoveryUrl ?? DEFAULT_DISCOVERY_URL;
  let discoveryPromise = null;
  let jwks = deps.jwks ?? null;
  const discover = async () => {
    if (!discoveryPromise) {
      discoveryPromise = (async () => {
        const res = await deps.fetch(discoveryUrl);
        if (!res.ok) throw new AuthExchangeError("OIDC discovery failed");
        const doc = await res.json();
        if (!isDiscovery(doc)) throw new AuthExchangeError("OIDC discovery document is malformed");
        return doc;
      })().catch((err) => {
        discoveryPromise = null;
        throw err;
      });
    }
    return discoveryPromise;
  };
  const getJwks = (jwksUri) => {
    if (!jwks) jwks = createRemoteJWKSet(new URL(jwksUri));
    return jwks;
  };
  return {
    kind: "oidc",
    async authorizeUrl(input) {
      const { authorization_endpoint } = await discover();
      const url = new URL(authorization_endpoint);
      url.searchParams.set("client_id", deps.clientId);
      url.searchParams.set("redirect_uri", input.redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("scope", SCOPE);
      url.searchParams.set("state", input.state);
      url.searchParams.set("nonce", input.nonce);
      url.searchParams.set("code_challenge", input.codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
      return url.toString();
    },
    async exchange(input) {
      const discovery = await discover();
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: input.redirectUri,
        client_id: deps.clientId,
        client_secret: deps.clientSecret,
        code_verifier: input.codeVerifier
      });
      const res = await deps.fetch(discovery.token_endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: body.toString()
      });
      if (!res.ok) throw new AuthExchangeError("OIDC token exchange rejected");
      const token = await res.json().catch(() => null);
      if (!token?.id_token) throw new AuthExchangeError("OIDC token response missing id_token");
      let payload;
      try {
        const verified = await jwtVerify(token.id_token, getJwks(discovery.jwks_uri), {
          issuer: discovery.issuer,
          audience: deps.clientId,
          currentDate: deps.clock.now()
        });
        payload = verified.payload;
      } catch {
        throw new AuthExchangeError("id_token verification failed");
      }
      if (typeof payload.sub !== "string" || payload.sub.length === 0) {
        throw new AuthExchangeError("id_token missing sub");
      }
      if (typeof payload.nonce !== "string" || !safeEqual(payload.nonce, input.expectedNonce)) {
        throw new AuthExchangeError("id_token nonce mismatch");
      }
      return {
        googleSub: payload.sub,
        email: typeof payload.email === "string" ? payload.email : null,
        name: typeof payload.name === "string" ? payload.name : null,
        avatarUrl: typeof payload.picture === "string" ? payload.picture : null
      };
    }
  };
}
const MOCK_IDENTITY = {
  googleSub: "dev-user",
  email: "dev@example.com",
  name: "Dev Athlete",
  avatarUrl: null
};
function createMockAuthProvider(identity = MOCK_IDENTITY) {
  return {
    kind: "mock",
    async authorizeUrl() {
      return "/auth/callback?code=mock&state=mock";
    },
    async exchange() {
      return identity;
    }
  };
}
function createRateLimiter(opts) {
  const { limit, windowMs, now } = opts;
  const maxKeys = opts.maxKeys ?? 1e4;
  const hits = /* @__PURE__ */ new Map();
  const prune = (key2, t) => {
    const recent = (hits.get(key2) ?? []).filter((ts) => ts > t - windowMs);
    return recent;
  };
  const blocked = (recent, t) => ({
    allowed: false,
    // Oldest hit in the window determines when a slot frees up.
    retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + windowMs - t) / 1e3)),
    remaining: 0
  });
  const touch = (key2, recent) => {
    hits.delete(key2);
    hits.set(key2, recent);
    if (hits.size > maxKeys) {
      const firstKey = hits.keys().next().value;
      if (firstKey !== void 0) hits.delete(firstKey);
    }
  };
  return {
    check(key2) {
      const t = now();
      const recent = prune(key2, t);
      if (recent.length >= limit) {
        touch(key2, recent);
        return blocked(recent, t);
      }
      recent.push(t);
      touch(key2, recent);
      return { allowed: true, retryAfterSeconds: 0, remaining: limit - recent.length };
    },
    peek(key2) {
      const t = now();
      const recent = prune(key2, t);
      if (recent.length >= limit) return blocked(recent, t);
      return { allowed: true, retryAfterSeconds: 0, remaining: limit - recent.length };
    }
  };
}
function toActivity(userId, r) {
  return {
    userId,
    activityId: r.activity_id,
    sport: r.sport,
    name: r.name,
    startTime: r.start_time instanceof Date ? r.start_time.toISOString() : String(r.start_time),
    startTimeLocal: r.start_time_local,
    distanceM: r.distance_m,
    durationS: r.duration_s,
    movingS: r.moving_s,
    elevationGainM: r.elevation_gain_m,
    avgHr: r.avg_hr,
    maxHr: r.max_hr,
    avgPower: r.avg_power,
    maxPower: r.max_power,
    normPower: r.norm_power,
    calories: r.calories,
    trainingLoad: r.training_load,
    hasGps: r.has_gps,
    raw: r.raw ?? null
    // null for lite list reads (raw column not selected); populated by getActivity
  };
}
const isoDay = (d) => d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
function createPgStore(sql) {
  return {
    async putMetricDay(userId, metric, day, data) {
      await sql`
        INSERT INTO synced_metric_days (user_id, metric, day, data, synced_at)
        VALUES (${userId}, ${metric}, ${day}, ${sql.json(data)}, now())
        ON CONFLICT (user_id, metric, day) DO UPDATE SET data = EXCLUDED.data, synced_at = now()`;
    },
    async putMetricDays(userId, metric, days) {
      if (days.length === 0) return;
      const rows = days.map((d) => ({
        user_id: userId,
        metric,
        day: d.day,
        data: sql.json(d.data)
      }));
      await sql`
        INSERT INTO synced_metric_days ${sql(rows, "user_id", "metric", "day", "data")}
        ON CONFLICT (user_id, metric, day) DO UPDATE SET data = EXCLUDED.data, synced_at = now()`;
    },
    async getMetricDay(userId, metric, day) {
      const rows = await sql`
        SELECT data FROM synced_metric_days WHERE user_id = ${userId} AND metric = ${metric} AND day = ${day} LIMIT 1`;
      return rows[0]?.data ?? null;
    },
    async getMetricRange(userId, metric, start, end) {
      const rows = await sql`
        SELECT day, data FROM synced_metric_days
        WHERE user_id = ${userId} AND metric = ${metric} AND day >= ${start} AND day <= ${end}
        ORDER BY day ASC`;
      const byDay = new Map(rows.map((r) => [isoDay(r.day), r.data]));
      const days = [];
      const d = /* @__PURE__ */ new Date(`${start}T00:00:00Z`);
      const last = /* @__PURE__ */ new Date(`${end}T00:00:00Z`);
      while (d.getTime() <= last.getTime()) {
        const stamp = d.toISOString().slice(0, 10);
        days.push({ date: stamp, data: byDay.get(stamp) ?? null });
        d.setUTCDate(d.getUTCDate() + 1);
      }
      return { metric, start, end, days };
    },
    async putActivities(userId, list) {
      if (list.length === 0) return;
      for (const a of list) {
        await sql`
          INSERT INTO synced_activities (
            user_id, activity_id, sport, name, start_time, start_time_local, distance_m, duration_s,
            moving_s, elevation_gain_m, avg_hr, max_hr, avg_power, max_power, norm_power, calories,
            training_load, has_gps, raw, synced_at)
          VALUES (
            ${userId}, ${a.activityId}, ${a.sport}, ${a.name}, ${a.startTime}, ${a.startTimeLocal},
            ${a.distanceM}, ${a.durationS}, ${a.movingS}, ${a.elevationGainM}, ${a.avgHr}, ${a.maxHr},
            ${a.avgPower}, ${a.maxPower}, ${a.normPower}, ${a.calories}, ${a.trainingLoad}, ${a.hasGps},
            ${sql.json(a.raw)}, now())
          ON CONFLICT (user_id, activity_id) DO UPDATE SET
            sport = EXCLUDED.sport, name = EXCLUDED.name, start_time = EXCLUDED.start_time,
            start_time_local = EXCLUDED.start_time_local, distance_m = EXCLUDED.distance_m,
            duration_s = EXCLUDED.duration_s, moving_s = EXCLUDED.moving_s,
            elevation_gain_m = EXCLUDED.elevation_gain_m, avg_hr = EXCLUDED.avg_hr, max_hr = EXCLUDED.max_hr,
            avg_power = EXCLUDED.avg_power, max_power = EXCLUDED.max_power, norm_power = EXCLUDED.norm_power,
            calories = EXCLUDED.calories, training_load = EXCLUDED.training_load,
            has_gps = (synced_activities.has_gps OR EXCLUDED.has_gps), raw = EXCLUDED.raw, synced_at = now()`;
      }
    },
    async getActivity(userId, activityId) {
      const rows = await sql`
        SELECT * FROM synced_activities WHERE user_id = ${userId} AND activity_id = ${activityId} LIMIT 1`;
      return rows[0] ? toActivity(userId, rows[0]) : null;
    },
    async listActivities(userId, query = {}) {
      const rows = await sql`
        SELECT user_id, activity_id, sport, name, start_time, start_time_local, distance_m, duration_s,
               moving_s, elevation_gain_m, avg_hr, max_hr, avg_power, max_power, norm_power, calories,
               training_load, has_gps
        FROM synced_activities
        WHERE user_id = ${userId}
          ${query.sport ? sql`AND sport = ${query.sport}` : sql``}
          ${query.sports ? sql`AND sport = ANY(${[...query.sports]})` : sql``}
          ${query.from ? sql`AND left(start_time_local, 10) >= ${query.from}` : sql``}
          ${query.to ? sql`AND left(start_time_local, 10) <= ${query.to}` : sql``}
          ${query.search ? sql`AND (name ILIKE ${"%" + query.search + "%"} OR sport ILIKE ${"%" + query.search + "%"})` : sql``}
        ORDER BY ${orderBy(sql, query)}
        LIMIT ${query.limit ?? 1e3} OFFSET ${query.offset ?? 0}`;
      return rows.map((r) => toActivity(userId, r));
    },
    async countActivities(userId, query = {}) {
      const rows = await sql`
        SELECT count(*)::int AS n FROM synced_activities
        WHERE user_id = ${userId}
          ${query.sport ? sql`AND sport = ${query.sport}` : sql``}
          ${query.sports ? sql`AND sport = ANY(${[...query.sports]})` : sql``}
          ${query.from ? sql`AND left(start_time_local, 10) >= ${query.from}` : sql``}
          ${query.to ? sql`AND left(start_time_local, 10) <= ${query.to}` : sql``}
          ${query.search ? sql`AND (name ILIKE ${"%" + query.search + "%"} OR sport ILIKE ${"%" + query.search + "%"})` : sql``}`;
      return rows[0]?.n ?? 0;
    },
    async listSports(userId) {
      const rows = await sql`
        SELECT sport, count(*)::int AS n FROM synced_activities
        WHERE user_id = ${userId}
        GROUP BY sport
        ORDER BY n DESC, sport ASC`;
      return rows.map((r) => ({ sport: r.sport, count: r.n }));
    },
    async putStreams(userId, activityId, s) {
      await sql`
        INSERT INTO synced_activity_streams (user_id, activity_id, streams, efforts_v, synced_at)
        VALUES (${userId}, ${activityId}, ${sql.json(s)}, NULL, now())
        ON CONFLICT (user_id, activity_id) DO UPDATE SET
          streams = EXCLUDED.streams, efforts_v = NULL, synced_at = now()`;
    },
    async getStreams(userId, activityId) {
      const rows = await sql`
        SELECT streams FROM synced_activity_streams WHERE user_id = ${userId} AND activity_id = ${activityId} LIMIT 1`;
      return rows[0]?.streams ?? null;
    },
    async listStreamVersions(userId) {
      const rows = await sql`
        SELECT activity_id, streams->>'v' AS v
        FROM synced_activity_streams WHERE user_id = ${userId}`;
      const out = /* @__PURE__ */ new Map();
      for (const r of rows) {
        const v = Number(r.v);
        out.set(r.activity_id, Number.isFinite(v) ? v : 0);
      }
      return out;
    },
    async getStreamField(userId, activityIds, field) {
      const out = /* @__PURE__ */ new Map();
      if (activityIds.length === 0) return out;
      const rows = await sql`
        SELECT activity_id, streams->${field} AS v
        FROM synced_activity_streams
        WHERE user_id = ${userId} AND activity_id = ANY(${activityIds})`;
      for (const r of rows) if (Array.isArray(r.v) && r.v.length > 0) out.set(r.activity_id, r.v);
      return out;
    },
    async listGpsTracks(userId, query = {}) {
      const rows = await sql`
        SELECT a.activity_id, a.sport, a.start_time_local, s.streams->'gps' AS gps
        FROM synced_activities a
        JOIN synced_activity_streams s ON s.user_id = a.user_id AND s.activity_id = a.activity_id
        WHERE a.user_id = ${userId} AND a.has_gps = true
          ${query.sport ? sql`AND a.sport = ${query.sport}` : sql``}
          ${query.year ? sql`AND left(a.start_time_local, 4) = ${String(query.year)}` : sql``}`;
      return rows.map((r) => ({
        activityId: r.activity_id,
        sport: r.sport,
        startTimeLocal: r.start_time_local,
        gps: r.gps
      })).filter(
        (t) => Array.isArray(t.gps) && t.gps.length > 0
      );
    },
    async putActivityBestEfforts(userId, input) {
      await sql.begin(async (tx) => {
        await tx`
          DELETE FROM synced_activity_best_efforts
          WHERE user_id = ${userId} AND activity_id = ${input.activityId}`;
        for (const e of input.efforts) {
          await tx`
            INSERT INTO synced_activity_best_efforts (
              user_id, activity_id, distance_key, distance_m, duration_s, actual_m,
              pace_sec_per_km, start_s, samples, sport, day, computed_at)
            VALUES (
              ${userId}, ${input.activityId}, ${e.key}, ${e.metres}, ${e.durationS}, ${e.actualM},
              ${e.paceSecPerKm}, ${e.startS}, ${e.samples}, ${input.sport}, ${input.day}, now())`;
        }
        await tx`
          UPDATE synced_activity_streams SET efforts_v = ${input.version}
          WHERE user_id = ${userId} AND activity_id = ${input.activityId}`;
      });
    },
    async listBestEffortVersions(userId) {
      const rows = await sql`
        SELECT activity_id, efforts_v FROM synced_activity_streams WHERE user_id = ${userId}`;
      const out = /* @__PURE__ */ new Map();
      for (const r of rows) out.set(r.activity_id, r.efforts_v ?? 0);
      return out;
    },
    async listTopBestEfforts(userId, query) {
      const rows = await sql`
        SELECT distance_key, distance_m, duration_s, actual_m, pace_sec_per_km, start_s, samples,
               activity_id, activity_name, sport, day
        FROM (
          SELECT e.distance_key, e.distance_m, e.duration_s, e.actual_m, e.pace_sec_per_km,
                 e.start_s, e.samples, e.activity_id, a.name AS activity_name, e.sport, e.day,
                 row_number() OVER (
                   PARTITION BY e.distance_key
                   ORDER BY e.duration_s ASC, e.day ASC, e.activity_id ASC
                 ) AS rn
          FROM synced_activity_best_efforts e
          JOIN synced_activities a ON a.user_id = e.user_id AND a.activity_id = e.activity_id
          WHERE e.user_id = ${userId}
            ${query.sports ? sql`AND e.sport = ANY(${[...query.sports]})` : sql``}
            ${query.until ? sql`AND e.day <= ${query.until}` : sql``}
        ) ranked
        WHERE rn <= ${query.limit}
        ORDER BY distance_m ASC, duration_s ASC, day ASC, activity_id ASC`;
      return rows.map((r) => ({
        key: r.distance_key,
        metres: r.distance_m,
        durationS: r.duration_s,
        actualM: r.actual_m,
        paceSecPerKm: r.pace_sec_per_km,
        startS: r.start_s,
        samples: r.samples,
        activityId: r.activity_id,
        activityName: r.activity_name,
        sport: r.sport,
        day: isoDay(r.day)
      }));
    },
    async replacePlannedEvents(userId, from, to, events) {
      await sql.begin(async (tx) => {
        await tx`DELETE FROM synced_planned_events WHERE user_id = ${userId} AND day >= ${from} AND day <= ${to}`;
        for (const e of events) {
          await tx`
            INSERT INTO synced_planned_events (
              user_id, event_id, day, time_local, kind, title, sport, description,
              duration_s, distance_m, target_load, source, synced_at)
            VALUES (
              ${userId}, ${e.id}, ${e.day}, ${e.time}, ${e.kind}, ${e.title}, ${e.sport}, ${e.description},
              ${e.estimatedDurationS}, ${e.estimatedDistanceM}, ${e.targetLoad}, ${e.source}, now())
            ON CONFLICT (user_id, event_id) DO UPDATE SET
              day = EXCLUDED.day, time_local = EXCLUDED.time_local, kind = EXCLUDED.kind,
              title = EXCLUDED.title, sport = EXCLUDED.sport, description = EXCLUDED.description,
              duration_s = EXCLUDED.duration_s, distance_m = EXCLUDED.distance_m,
              target_load = EXCLUDED.target_load, source = EXCLUDED.source, synced_at = now()`;
        }
      });
    },
    async listPlannedEvents(userId, from, to) {
      const rows = await sql`
        SELECT event_id, day, time_local, kind, title, sport, description, duration_s, distance_m, target_load, source
        FROM synced_planned_events
        WHERE user_id = ${userId} AND day >= ${from} AND day <= ${to}
        ORDER BY day ASC, time_local ASC NULLS FIRST, event_id ASC`;
      return rows.map(toPlanned);
    },
    async createWorkout(userId, input) {
      const rows = await sql`
        INSERT INTO authored_workouts (
          id, user_id, day, time_local, sport, title, steps, note,
          push_state, created_at, updated_at)
        VALUES (
          ${input.id}, ${userId}, ${input.day}, ${input.time}, ${input.sport}, ${input.title},
          ${sql.json(input.steps)}, ${input.note},
          'pending', ${input.createdAt}, ${input.createdAt})
        RETURNING ${sql(AUTHORED_COLUMNS)}`;
      return toAuthored(userId, rows[0]);
    },
    async getWorkout(userId, id) {
      const rows = await sql`
        SELECT ${sql(AUTHORED_COLUMNS)} FROM authored_workouts
        WHERE user_id = ${userId} AND id = ${id}`;
      return rows.length > 0 ? toAuthored(userId, rows[0]) : null;
    },
    async listWorkouts(userId, query = {}) {
      const rows = await sql`
        SELECT ${sql(AUTHORED_COLUMNS)} FROM authored_workouts
        WHERE user_id = ${userId}
          AND (${query.from ?? null}::date IS NULL OR day >= ${query.from ?? null}::date)
          AND (${query.to ?? null}::date IS NULL OR day <= ${query.to ?? null}::date)
          AND (${query.pushState ?? null}::text IS NULL OR push_state = ${query.pushState ?? null}::text)
        ORDER BY day ASC, time_local ASC NULLS FIRST, created_at ASC, id ASC
        LIMIT ${query.limit ?? null}`;
      return rows.map((r) => toAuthored(userId, r));
    },
    async updateWorkout(userId, id, patch) {
      const set = { updated_at: patch.updatedAt };
      if (patch.day !== void 0) set.day = patch.day;
      if (patch.time !== void 0) set.time_local = patch.time;
      if (patch.sport !== void 0) set.sport = patch.sport;
      if (patch.title !== void 0) set.title = patch.title;
      if (patch.steps !== void 0) set.steps = sql.json(patch.steps);
      if (patch.note !== void 0) set.note = patch.note;
      if (patch.pushState !== void 0) set.push_state = patch.pushState;
      if (patch.pushError !== void 0) set.push_error = patch.pushError;
      if (patch.garminWorkoutId !== void 0) set.garmin_workout_id = patch.garminWorkoutId;
      if (patch.garminScheduleId !== void 0) set.garmin_schedule_id = patch.garminScheduleId;
      if (patch.matchedActivityId !== void 0) set.matched_activity_id = patch.matchedActivityId;
      const rows = await sql`
        UPDATE authored_workouts SET ${sql(set)}
        WHERE user_id = ${userId} AND id = ${id}
        RETURNING ${sql(AUTHORED_COLUMNS)}`;
      return rows.length > 0 ? toAuthored(userId, rows[0]) : null;
    },
    async deleteWorkout(userId, id) {
      const rows = await sql`
        DELETE FROM authored_workouts WHERE user_id = ${userId} AND id = ${id}
        RETURNING ${sql(AUTHORED_COLUMNS)}`;
      return rows.length > 0 ? toAuthored(userId, rows[0]) : null;
    },
    /* ---- workout library (spec 069) ---- */
    async createWorkoutTemplate(userId, input) {
      const rows = await sql`
        INSERT INTO workout_templates (id, user_id, sport, title, steps, note, created_at, updated_at)
        VALUES (
          ${input.id}, ${userId}, ${input.sport}, ${input.title},
          ${sql.json(input.steps)}, ${input.note}, ${input.createdAt}, ${input.createdAt})
        RETURNING ${sql(TEMPLATE_COLUMNS)}`;
      return toTemplate(userId, rows[0]);
    },
    async getWorkoutTemplate(userId, id) {
      const rows = await sql`
        SELECT ${sql(TEMPLATE_COLUMNS)} FROM workout_templates
        WHERE user_id = ${userId} AND id = ${id}`;
      return rows.length > 0 ? toTemplate(userId, rows[0]) : null;
    },
    async listWorkoutTemplates(userId) {
      const rows = await sql`
        SELECT ${sql(TEMPLATE_COLUMNS)} FROM workout_templates
        WHERE user_id = ${userId}
        ORDER BY title ASC, id ASC`;
      return rows.map((r) => toTemplate(userId, r));
    },
    async findWorkoutTemplateByTitle(userId, sport, title) {
      const rows = await sql`
        SELECT ${sql(TEMPLATE_COLUMNS)} FROM workout_templates
        WHERE user_id = ${userId}
          AND sport = ${sport}
          AND lower(btrim(title)) = ${title.trim().toLowerCase()}
        ORDER BY id ASC
        LIMIT 1`;
      return rows.length > 0 ? toTemplate(userId, rows[0]) : null;
    },
    async updateWorkoutTemplate(userId, id, patch) {
      const set = { updated_at: patch.updatedAt };
      if (patch.sport !== void 0) set.sport = patch.sport;
      if (patch.title !== void 0) set.title = patch.title;
      if (patch.steps !== void 0) set.steps = sql.json(patch.steps);
      if (patch.note !== void 0) set.note = patch.note;
      const rows = await sql`
        UPDATE workout_templates SET ${sql(set)}
        WHERE user_id = ${userId} AND id = ${id}
        RETURNING ${sql(TEMPLATE_COLUMNS)}`;
      return rows.length > 0 ? toTemplate(userId, rows[0]) : null;
    },
    async deleteWorkoutTemplate(userId, id) {
      const rows = await sql`
        DELETE FROM workout_templates WHERE user_id = ${userId} AND id = ${id}
        RETURNING ${sql(TEMPLATE_COLUMNS)}`;
      return rows.length > 0 ? toTemplate(userId, rows[0]) : null;
    },
    async createGoal(userId, input) {
      const rows = await sql`
        INSERT INTO season_goals (
          id, user_id, day, sport, title, kind, priority, distance_m, target_time_s, target_ctl,
          note, source, garmin_event_id, created_at, updated_at)
        VALUES (
          ${input.id}, ${userId}, ${input.day}, ${input.sport}, ${input.title}, ${input.kind},
          ${input.priority}, ${input.distanceM}, ${input.targetTimeS}, ${input.targetCtl},
          ${input.note}, ${input.source}, ${input.garminEventId}, ${input.createdAt}, ${input.createdAt})
        ON CONFLICT (user_id, garmin_event_id) WHERE garmin_event_id IS NOT NULL DO NOTHING
        RETURNING ${sql(GOAL_COLUMNS)}`;
      if (rows.length === 0) throw new DuplicateGoalError(input.garminEventId ?? "");
      return toGoal(userId, rows[0]);
    },
    async getGoal(userId, id) {
      const rows = await sql`
        SELECT ${sql(GOAL_COLUMNS)} FROM season_goals
        WHERE user_id = ${userId} AND id = ${id}`;
      return rows.length > 0 ? toGoal(userId, rows[0]) : null;
    },
    async listGoals(userId, query = {}) {
      const rows = await sql`
        SELECT ${sql(GOAL_COLUMNS)} FROM season_goals
        WHERE user_id = ${userId}
          AND (${query.from ?? null}::date IS NULL OR day >= ${query.from ?? null}::date)
          AND (${query.to ?? null}::date IS NULL OR day <= ${query.to ?? null}::date)
          AND (${query.sport ?? null}::text IS NULL OR sport = ${query.sport ?? null}::text)
        ORDER BY day ASC, id ASC
        LIMIT ${query.limit ?? null}`;
      return rows.map((r) => toGoal(userId, r));
    },
    async updateGoal(userId, id, patch) {
      const set = { updated_at: patch.updatedAt };
      if (patch.day !== void 0) set.day = patch.day;
      if (patch.sport !== void 0) set.sport = patch.sport;
      if (patch.title !== void 0) set.title = patch.title;
      if (patch.kind !== void 0) set.kind = patch.kind;
      if (patch.priority !== void 0) set.priority = patch.priority;
      if (patch.distanceM !== void 0) set.distance_m = patch.distanceM;
      if (patch.targetTimeS !== void 0) set.target_time_s = patch.targetTimeS;
      if (patch.targetCtl !== void 0) set.target_ctl = patch.targetCtl;
      if (patch.note !== void 0) set.note = patch.note;
      const rows = await sql`
        UPDATE season_goals SET ${sql(set)}
        WHERE user_id = ${userId} AND id = ${id}
        RETURNING ${sql(GOAL_COLUMNS)}`;
      return rows.length > 0 ? toGoal(userId, rows[0]) : null;
    },
    async deleteGoal(userId, id) {
      const rows = await sql`
        DELETE FROM season_goals WHERE user_id = ${userId} AND id = ${id}
        RETURNING ${sql(GOAL_COLUMNS)}`;
      return rows.length > 0 ? toGoal(userId, rows[0]) : null;
    },
    async putWeight(userId, points) {
      for (const p of points) {
        await sql`
          INSERT INTO synced_weight (user_id, day, source, weight_kg, raw, synced_at)
          VALUES (${userId}, ${p.day}, ${p.source}, ${p.weightKg}, ${sql.json(p.raw ?? null)}, now())
          ON CONFLICT (user_id, day, source) DO UPDATE SET weight_kg = EXCLUDED.weight_kg, raw = EXCLUDED.raw, synced_at = now()`;
      }
    },
    async getWeightRange(userId, start, end) {
      const rows = await sql`
        SELECT day, source, weight_kg, raw FROM synced_weight
        WHERE user_id = ${userId} AND day >= ${start} AND day <= ${end} ORDER BY day ASC`;
      return rows.map((r) => ({ day: isoDay(r.day), source: r.source, weightKg: r.weight_kg, raw: r.raw }));
    },
    async coverage(userId) {
      const metricRows = await sql`
        SELECT metric,
               min(day) FILTER (WHERE data IS NOT NULL) AS first_day,
               max(day) FILTER (WHERE data IS NOT NULL) AS last_day,
               count(*) FILTER (WHERE data IS NOT NULL)::int AS present_days
        FROM synced_metric_days WHERE user_id = ${userId} GROUP BY metric ORDER BY metric ASC`;
      const metrics = metricRows.map((r) => ({
        metric: r.metric,
        firstDay: r.first_day ? isoDay(r.first_day) : null,
        lastDay: r.last_day ? isoDay(r.last_day) : null,
        presentDays: r.present_days
      }));
      const actRows = await sql`
        SELECT count(*)::int AS count, count(*) FILTER (WHERE has_gps)::int AS with_gps,
               min(start_time_local) AS first_start, max(start_time_local) AS last_start,
               coalesce(sum(distance_m), 0)::float AS dist
        FROM synced_activities WHERE user_id = ${userId}`;
      const a = actRows[0];
      const wRows = await sql`
        SELECT count(*)::int AS count, min(day) AS first_day, max(day) AS last_day FROM synced_weight WHERE user_id = ${userId}`;
      const w = wRows[0];
      const rowRows = await sql`
        SELECT
          (SELECT count(*) FROM synced_metric_days WHERE user_id = ${userId})::int AS metric_days,
          (SELECT count(*) FROM synced_activity_streams WHERE user_id = ${userId})::int AS streams`;
      const rc = rowRows[0];
      const sizeRows = await sql`
        SELECT coalesce(sum(pg_total_relation_size(c.oid)), 0)::bigint AS bytes
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname IN ('synced_metric_days', 'synced_activities', 'synced_activity_streams', 'synced_weight')`;
      const totalBytes = Number(sizeRows[0]?.bytes ?? 0);
      const earliestCandidates = [
        ...metrics.map((m) => m.firstDay),
        a.first_start ? a.first_start.slice(0, 10) : null,
        w.first_day ? isoDay(w.first_day) : null
      ].filter((d) => !!d);
      return {
        metrics,
        activities: {
          count: a.count,
          withGps: a.with_gps,
          firstStart: a.first_start,
          lastStart: a.last_start,
          totalDistanceM: a.dist
        },
        weight: {
          count: w.count,
          firstDay: w.first_day ? isoDay(w.first_day) : null,
          lastDay: w.last_day ? isoDay(w.last_day) : null
        },
        earliest: earliestCandidates.length ? earliestCandidates.sort()[0] : null,
        storage: {
          totalBytes,
          rows: { metricDays: rc.metric_days, activities: a.count, streams: rc.streams, weight: w.count }
        }
      };
    },
    async getSyncState(userId, source) {
      const rows = await sql`
        SELECT source, cursor, last_full_sync_at, last_sync_at FROM sync_state
        WHERE user_id = ${userId} AND source = ${source} LIMIT 1`;
      const r = rows[0];
      if (!r) return null;
      return {
        source: r.source,
        cursor: r.cursor ?? {},
        lastFullSyncAt: r.last_full_sync_at ? r.last_full_sync_at.toISOString() : null,
        lastSyncAt: r.last_sync_at ? r.last_sync_at.toISOString() : null
      };
    },
    async setSyncState(userId, state) {
      await sql`
        INSERT INTO sync_state (user_id, source, cursor, last_full_sync_at, last_sync_at)
        VALUES (${userId}, ${state.source}, ${sql.json(state.cursor)}, ${state.lastFullSyncAt}, ${state.lastSyncAt})
        ON CONFLICT (user_id, source) DO UPDATE SET
          cursor = EXCLUDED.cursor, last_full_sync_at = EXCLUDED.last_full_sync_at, last_sync_at = EXCLUDED.last_sync_at`;
    },
    async startRun(input) {
      await sql`
        INSERT INTO sync_runs (id, user_id, kind, status, started_at, total, done)
        VALUES (${input.id}, ${input.userId}, ${input.kind}, 'running', ${input.startedAt}, ${input.total}, 0)`;
    },
    async updateRun(id, patch) {
      await sql`
        UPDATE sync_runs SET
          done = ${patch.done ?? sql`done`},
          total = ${patch.total ?? sql`total`},
          step = ${patch.step !== void 0 ? patch.step : sql`step`},
          status = ${patch.status ?? sql`status`},
          finished_at = ${patch.finishedAt !== void 0 ? patch.finishedAt : sql`finished_at`},
          error = ${patch.error !== void 0 ? patch.error : sql`error`},
          detail = ${patch.detail !== void 0 ? sql.json(patch.detail) : sql`detail`}
        WHERE id = ${id}`;
    },
    async getRun(id) {
      const rows = await sql`SELECT * FROM sync_runs WHERE id = ${id} LIMIT 1`;
      return rows[0] ? toRun(rows[0]) : null;
    },
    async getLatestRun(userId) {
      const rows = await sql`
        SELECT * FROM sync_runs WHERE user_id = ${userId} ORDER BY started_at DESC LIMIT 1`;
      return rows[0] ? toRun(rows[0]) : null;
    },
    async failRunningRuns(reason, finishedAt) {
      const rows = await sql`
        UPDATE sync_runs SET status = 'failed', error = ${reason}, finished_at = ${finishedAt}
        WHERE status = 'running' RETURNING id`;
      return rows.length;
    }
  };
}
const AUTHORED_COLUMNS = [
  "id",
  "day",
  "time_local",
  "sport",
  "title",
  "steps",
  "note",
  "push_state",
  "push_error",
  "garmin_workout_id",
  "garmin_schedule_id",
  "matched_activity_id",
  "created_at",
  "updated_at"
];
const PUSH_STATES = ["pending", "pushed", "failed", "unsupported"];
const TEMPLATE_COLUMNS = ["id", "sport", "title", "steps", "note", "created_at", "updated_at"];
function toTemplate(userId, r) {
  return {
    id: r.id,
    userId,
    sport: r.sport,
    title: r.title,
    // Same degradation as `toAuthored`: a jsonb shape we did not write must not throw in a read path.
    steps: Array.isArray(r.steps) ? r.steps : [],
    note: r.note,
    createdAt: isoInstant(r.created_at),
    updatedAt: isoInstant(r.updated_at)
  };
}
function toAuthored(userId, r) {
  return {
    id: r.id,
    userId,
    day: isoDay(r.day),
    time: r.time_local,
    sport: r.sport,
    title: r.title,
    // The column is jsonb written from a validated tree; an unexpected shape degrades to no steps
    // rather than throwing inside a read path.
    steps: Array.isArray(r.steps) ? r.steps : [],
    note: r.note,
    pushState: PUSH_STATES.includes(r.push_state) ? r.push_state : "pending",
    pushError: r.push_error,
    garminWorkoutId: r.garmin_workout_id,
    garminScheduleId: r.garmin_schedule_id,
    matchedActivityId: r.matched_activity_id,
    createdAt: isoInstant(r.created_at),
    updatedAt: isoInstant(r.updated_at)
  };
}
function isoInstant(value) {
  return value instanceof Date ? value.toISOString() : String(value);
}
const GOAL_COLUMNS = [
  "id",
  "day",
  "sport",
  "title",
  "kind",
  "priority",
  "distance_m",
  "target_time_s",
  "target_ctl",
  "note",
  "source",
  "garmin_event_id",
  "created_at",
  "updated_at"
];
const GOAL_KINDS = ["race", "fitness"];
const GOAL_PRIORITIES = ["a", "b", "c"];
function toGoal(userId, r) {
  return {
    id: r.id,
    userId,
    day: isoDay(r.day),
    // Every enum-ish column degrades to its safe default rather than throwing inside a read path —
    // the same rule `toAuthored` follows for `push_state`.
    sport: isSportGroup(r.sport) ? r.sport : "other",
    title: r.title,
    kind: GOAL_KINDS.includes(r.kind) ? r.kind : "race",
    priority: GOAL_PRIORITIES.includes(r.priority) ? r.priority : "a",
    distanceM: r.distance_m,
    targetTimeS: r.target_time_s,
    targetCtl: r.target_ctl,
    note: r.note,
    source: r.source === "garmin" ? "garmin" : "manual",
    garminEventId: r.garmin_event_id,
    createdAt: isoInstant(r.created_at),
    updatedAt: isoInstant(r.updated_at)
  };
}
function toPlanned(r) {
  return {
    id: r.event_id,
    day: isoDay(r.day),
    time: r.time_local,
    kind: r.kind === "race" || r.kind === "note" ? r.kind : "workout",
    title: r.title ?? "",
    sport: r.sport,
    description: r.description,
    estimatedDurationS: r.duration_s,
    estimatedDistanceM: r.distance_m,
    targetLoad: r.target_load,
    source: r.source
  };
}
function toRun(r) {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind,
    status: r.status,
    startedAt: r.started_at instanceof Date ? r.started_at.toISOString() : String(r.started_at),
    finishedAt: r.finished_at ? r.finished_at.toISOString() : null,
    total: r.total,
    done: r.done,
    step: r.step,
    error: r.error,
    detail: r.detail ?? null
  };
}
function orderBy(sql, q) {
  const dir = q.dir === "asc" ? sql`ASC` : sql`DESC`;
  switch (q.sort) {
    case "distance":
      return sql`distance_m ${dir} NULLS LAST`;
    case "duration":
      return sql`duration_s ${dir} NULLS LAST`;
    default:
      return sql`start_time_local ${dir}`;
  }
}
const key = (a, b) => `${a}\0${b}`;
function eachDay(start, end) {
  const out = [];
  const d = /* @__PURE__ */ new Date(`${start}T00:00:00Z`);
  const last = /* @__PURE__ */ new Date(`${end}T00:00:00Z`);
  while (d.getTime() <= last.getTime()) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
const localDay$1 = (s) => s.slice(0, 10);
const rankOrder = (a, b) => a.durationS - b.durationS || a.day.localeCompare(b.day) || a.activityId.localeCompare(b.activityId);
function createMemoryStore() {
  const metrics = /* @__PURE__ */ new Map();
  const activities = /* @__PURE__ */ new Map();
  const streams = /* @__PURE__ */ new Map();
  const bestEffortsByActivity = /* @__PURE__ */ new Map();
  const weights = /* @__PURE__ */ new Map();
  const planned = /* @__PURE__ */ new Map();
  const authored = /* @__PURE__ */ new Map();
  const templates = /* @__PURE__ */ new Map();
  const goals = /* @__PURE__ */ new Map();
  const syncState = /* @__PURE__ */ new Map();
  const runs = /* @__PURE__ */ new Map();
  const metricMap = (userId, metric) => {
    const k = key(userId, metric);
    let m = metrics.get(k);
    if (!m) metrics.set(k, m = /* @__PURE__ */ new Map());
    return m;
  };
  const actMap = (userId) => {
    let m = activities.get(userId);
    if (!m) activities.set(userId, m = /* @__PURE__ */ new Map());
    return m;
  };
  const plannedList = (userId) => planned.get(userId) ?? [];
  const weightMap = (userId) => {
    let m = weights.get(userId);
    if (!m) weights.set(userId, m = /* @__PURE__ */ new Map());
    return m;
  };
  function filterActs(userId, q = {}) {
    let list = [...actMap(userId).values()];
    if (q.sport) list = list.filter((a) => a.sport === q.sport);
    if (q.sports) {
      const allowed = new Set(q.sports);
      list = list.filter((a) => allowed.has(a.sport));
    }
    if (q.from) list = list.filter((a) => localDay$1(a.startTimeLocal) >= q.from);
    if (q.to) list = list.filter((a) => localDay$1(a.startTimeLocal) <= q.to);
    if (q.search) {
      const needle = q.search.toLowerCase();
      list = list.filter(
        (a) => (a.name ?? "").toLowerCase().includes(needle) || a.sport.toLowerCase().includes(needle)
      );
    }
    const sort = q.sort ?? "date";
    const dir = q.dir ?? "desc";
    const cmp = (a, b) => {
      const va = sort === "distance" ? a.distanceM ?? 0 : sort === "duration" ? a.durationS ?? 0 : a.startTimeLocal;
      const vb = sort === "distance" ? b.distanceM ?? 0 : sort === "duration" ? b.durationS ?? 0 : b.startTimeLocal;
      const r = va < vb ? -1 : va > vb ? 1 : 0;
      return dir === "asc" ? r : -r;
    };
    list.sort(cmp);
    return list;
  }
  return {
    async putMetricDay(userId, metric, day, data) {
      metricMap(userId, metric).set(day, data);
    },
    async putMetricDays(userId, metric, days) {
      const m = metricMap(userId, metric);
      for (const { day, data } of days) m.set(day, data);
    },
    async getMetricDay(userId, metric, day) {
      return metricMap(userId, metric).get(day) ?? null;
    },
    async getMetricRange(userId, metric, start, end) {
      const m = metricMap(userId, metric);
      return {
        metric,
        start,
        end,
        days: eachDay(start, end).map((day) => ({ date: day, data: m.get(day) ?? null }))
      };
    },
    async putActivities(userId, list) {
      const m = actMap(userId);
      for (const a of list) m.set(a.activityId, a);
    },
    async getActivity(userId, activityId) {
      return actMap(userId).get(activityId) ?? null;
    },
    async listActivities(userId, query = {}) {
      const all = filterActs(userId, query);
      const offset = query.offset ?? 0;
      const limit = query.limit ?? all.length;
      return all.slice(offset, offset + limit).map((a) => ({ ...a, raw: null }));
    },
    async countActivities(userId, query = {}) {
      return filterActs(userId, query).length;
    },
    async listSports(userId) {
      const counts = /* @__PURE__ */ new Map();
      for (const a of actMap(userId).values()) counts.set(a.sport, (counts.get(a.sport) ?? 0) + 1);
      return [...counts.entries()].map(([sport, count]) => ({ sport, count })).sort((x, y) => y.count - x.count || x.sport.localeCompare(y.sport));
    },
    async putStreams(userId, activityId, s) {
      streams.set(key(userId, activityId), s);
      bestEffortsByActivity.delete(key(userId, activityId));
    },
    async getStreams(userId, activityId) {
      return streams.get(key(userId, activityId)) ?? null;
    },
    async listStreamVersions(userId) {
      const out = /* @__PURE__ */ new Map();
      const prefix = key(userId, "");
      for (const [k, s] of streams) {
        if (!k.startsWith(prefix)) continue;
        out.set(k.slice(prefix.length), typeof s.v === "number" ? s.v : 0);
      }
      return out;
    },
    async getStreamField(userId, activityIds, field) {
      const out = /* @__PURE__ */ new Map();
      for (const id of activityIds) {
        const s = streams.get(key(userId, id));
        const arr = s?.[field];
        if (Array.isArray(arr) && arr.length > 0) out.set(id, arr);
      }
      return out;
    },
    async listGpsTracks(userId, query = {}) {
      const out = [];
      for (const a of actMap(userId).values()) {
        if (query.sport && a.sport !== query.sport) continue;
        if (query.year && Number(localDay$1(a.startTimeLocal).slice(0, 4)) !== query.year) continue;
        const s = streams.get(key(userId, a.activityId));
        if (s?.gps && s.gps.length > 0)
          out.push({
            activityId: a.activityId,
            sport: a.sport,
            startTimeLocal: a.startTimeLocal,
            gps: s.gps
          });
      }
      return out;
    },
    async putActivityBestEfforts(userId, input) {
      bestEffortsByActivity.set(key(userId, input.activityId), {
        ...input,
        efforts: input.efforts.map((e) => ({ ...e }))
      });
    },
    async listBestEffortVersions(userId) {
      const out = /* @__PURE__ */ new Map();
      const prefix = key(userId, "");
      for (const k of streams.keys()) {
        if (!k.startsWith(prefix)) continue;
        const activityId = k.slice(prefix.length);
        out.set(activityId, bestEffortsByActivity.get(k)?.version ?? 0);
      }
      return out;
    },
    async listTopBestEfforts(userId, query) {
      const allowed = query.sports ? new Set(query.sports) : null;
      const acts = actMap(userId);
      const rows = [];
      const prefix = key(userId, "");
      for (const [k, entry] of bestEffortsByActivity) {
        if (!k.startsWith(prefix)) continue;
        if (allowed && !allowed.has(entry.sport)) continue;
        if (query.until && entry.day > query.until) continue;
        const activity = acts.get(entry.activityId);
        if (!activity) continue;
        for (const e of entry.efforts) {
          rows.push({
            ...e,
            activityId: entry.activityId,
            activityName: activity.name,
            sport: entry.sport,
            day: entry.day
          });
        }
      }
      const byKey = /* @__PURE__ */ new Map();
      for (const r of rows) {
        const bucket = byKey.get(r.key);
        if (bucket) bucket.push(r);
        else byKey.set(r.key, [r]);
      }
      const kept = [];
      for (const bucket of byKey.values()) {
        bucket.sort(rankOrder);
        kept.push(...bucket.slice(0, query.limit));
      }
      kept.sort((a, b) => a.metres - b.metres || rankOrder(a, b));
      return kept;
    },
    async replacePlannedEvents(userId, from, to, events) {
      const kept = plannedList(userId).filter((e) => e.day < from || e.day > to);
      planned.set(userId, [...kept, ...events]);
    },
    async listPlannedEvents(userId, from, to) {
      return plannedList(userId).filter((e) => e.day >= from && e.day <= to).sort(
        (a, b) => a.day.localeCompare(b.day) || (a.time ?? "").localeCompare(b.time ?? "") || a.id.localeCompare(b.id)
      );
    },
    async createWorkout(userId, input) {
      const row = {
        id: input.id,
        userId,
        day: input.day,
        time: input.time,
        sport: input.sport,
        title: input.title,
        // Copied, so a caller mutating its input can never rewrite stored history.
        steps: structuredClone(input.steps),
        note: input.note,
        pushState: "pending",
        pushError: null,
        garminWorkoutId: null,
        garminScheduleId: null,
        matchedActivityId: null,
        createdAt: input.createdAt,
        updatedAt: input.createdAt
      };
      authored.set(key(userId, input.id), row);
      return row;
    },
    async getWorkout(userId, id) {
      return authored.get(key(userId, id)) ?? null;
    },
    async listWorkouts(userId, query = {}) {
      let list = [...authored.values()].filter((w) => w.userId === userId);
      if (query.from) list = list.filter((w) => w.day >= query.from);
      if (query.to) list = list.filter((w) => w.day <= query.to);
      if (query.pushState) list = list.filter((w) => w.pushState === query.pushState);
      list.sort(
        (a, b) => a.day.localeCompare(b.day) || (a.time ?? "").localeCompare(b.time ?? "") || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
      );
      return query.limit != null ? list.slice(0, query.limit) : list;
    },
    async updateWorkout(userId, id, patch) {
      const k = key(userId, id);
      const current = authored.get(k);
      if (!current) return null;
      const next = {
        ...current,
        ...patch.day !== void 0 ? { day: patch.day } : {},
        ...patch.time !== void 0 ? { time: patch.time } : {},
        ...patch.sport !== void 0 ? { sport: patch.sport } : {},
        ...patch.title !== void 0 ? { title: patch.title } : {},
        ...patch.steps !== void 0 ? { steps: structuredClone(patch.steps) } : {},
        ...patch.note !== void 0 ? { note: patch.note } : {},
        ...patch.pushState !== void 0 ? { pushState: patch.pushState } : {},
        ...patch.pushError !== void 0 ? { pushError: patch.pushError } : {},
        ...patch.garminWorkoutId !== void 0 ? { garminWorkoutId: patch.garminWorkoutId } : {},
        ...patch.garminScheduleId !== void 0 ? { garminScheduleId: patch.garminScheduleId } : {},
        ...patch.matchedActivityId !== void 0 ? { matchedActivityId: patch.matchedActivityId } : {},
        updatedAt: patch.updatedAt
      };
      authored.set(k, next);
      return next;
    },
    async deleteWorkout(userId, id) {
      const k = key(userId, id);
      const current = authored.get(k);
      if (!current) return null;
      authored.delete(k);
      return current;
    },
    /* ---- workout library (spec 069) ---- */
    async createWorkoutTemplate(userId, input) {
      const row = {
        id: input.id,
        userId,
        sport: input.sport,
        title: input.title,
        // Copied on the way in AND on the way out, so neither the caller nor a consumer can reach
        // back into stored state through the array they handed us or were given.
        steps: structuredClone(input.steps),
        note: input.note,
        createdAt: input.createdAt,
        updatedAt: input.createdAt
      };
      templates.set(row.id, row);
      return structuredClone(row);
    },
    async getWorkoutTemplate(userId, id) {
      const row = templates.get(id);
      return row && row.userId === userId ? structuredClone(row) : null;
    },
    async listWorkoutTemplates(userId) {
      return [...templates.values()].filter((t) => t.userId === userId).sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id)).map((t) => structuredClone(t));
    },
    async findWorkoutTemplateByTitle(userId, sport, title) {
      const wanted = title.trim().toLowerCase();
      const row = [...templates.values()].find(
        (t) => t.userId === userId && t.sport === sport && t.title.trim().toLowerCase() === wanted
      );
      return row ? structuredClone(row) : null;
    },
    async updateWorkoutTemplate(userId, id, patch) {
      const row = templates.get(id);
      if (!row || row.userId !== userId) return null;
      const next = {
        ...row,
        ...patch.sport === void 0 ? {} : { sport: patch.sport },
        ...patch.title === void 0 ? {} : { title: patch.title },
        ...patch.steps === void 0 ? {} : { steps: structuredClone(patch.steps) },
        ...patch.note === void 0 ? {} : { note: patch.note },
        updatedAt: patch.updatedAt
      };
      templates.set(id, next);
      return structuredClone(next);
    },
    async deleteWorkoutTemplate(userId, id) {
      const row = templates.get(id);
      if (!row || row.userId !== userId) return null;
      templates.delete(id);
      return structuredClone(row);
    },
    async createGoal(userId, input) {
      if (input.garminEventId !== null) {
        const clash = [...goals.values()].find(
          (g) => g.userId === userId && g.garminEventId === input.garminEventId
        );
        if (clash) throw new DuplicateGoalError(input.garminEventId);
      }
      const row = {
        id: input.id,
        userId,
        day: input.day,
        sport: input.sport,
        title: input.title,
        kind: input.kind,
        priority: input.priority,
        distanceM: input.distanceM,
        targetTimeS: input.targetTimeS,
        targetCtl: input.targetCtl,
        note: input.note,
        source: input.source,
        garminEventId: input.garminEventId,
        createdAt: input.createdAt,
        updatedAt: input.createdAt
      };
      goals.set(key(userId, input.id), row);
      return row;
    },
    async getGoal(userId, id) {
      return goals.get(key(userId, id)) ?? null;
    },
    async listGoals(userId, query = {}) {
      let list = [...goals.values()].filter((g) => g.userId === userId);
      if (query.from) list = list.filter((g) => g.day >= query.from);
      if (query.to) list = list.filter((g) => g.day <= query.to);
      if (query.sport) list = list.filter((g) => g.sport === query.sport);
      list.sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));
      return query.limit != null ? list.slice(0, query.limit) : list;
    },
    async updateGoal(userId, id, patch) {
      const k = key(userId, id);
      const current = goals.get(k);
      if (!current) return null;
      const next = {
        ...current,
        ...patch.day !== void 0 ? { day: patch.day } : {},
        ...patch.sport !== void 0 ? { sport: patch.sport } : {},
        ...patch.title !== void 0 ? { title: patch.title } : {},
        ...patch.kind !== void 0 ? { kind: patch.kind } : {},
        ...patch.priority !== void 0 ? { priority: patch.priority } : {},
        ...patch.distanceM !== void 0 ? { distanceM: patch.distanceM } : {},
        ...patch.targetTimeS !== void 0 ? { targetTimeS: patch.targetTimeS } : {},
        ...patch.targetCtl !== void 0 ? { targetCtl: patch.targetCtl } : {},
        ...patch.note !== void 0 ? { note: patch.note } : {},
        updatedAt: patch.updatedAt
      };
      goals.set(k, next);
      return next;
    },
    async deleteGoal(userId, id) {
      const k = key(userId, id);
      const current = goals.get(k);
      if (!current) return null;
      goals.delete(k);
      return current;
    },
    async putWeight(userId, points) {
      const m = weightMap(userId);
      for (const p of points) m.set(key(p.day, p.source), p);
    },
    async getWeightRange(userId, start, end) {
      return [...weightMap(userId).values()].filter((p) => p.day >= start && p.day <= end).sort((a, b) => a.day < b.day ? -1 : a.day > b.day ? 1 : 0);
    },
    async coverage(userId) {
      const metricCov = [];
      let storedDayRows = 0;
      for (const [k, m] of metrics) {
        const [uid, metric] = k.split("\0");
        if (uid !== userId) continue;
        storedDayRows += m.size;
        const present = [...m.entries()].filter(([, v]) => v != null).map(([d]) => d).sort();
        metricCov.push({
          metric,
          firstDay: present[0] ?? null,
          lastDay: present[present.length - 1] ?? null,
          presentDays: present.length
        });
      }
      metricCov.sort((a, b) => a.metric.localeCompare(b.metric));
      const acts = [...actMap(userId).values()];
      const starts = acts.map((a) => a.startTimeLocal).sort();
      const w = [...weightMap(userId).values()].map((p) => p.day).sort();
      const candidates = [
        ...metricCov.map((m) => m.firstDay),
        starts[0] ? starts[0].slice(0, 10) : null,
        w[0] ?? null
      ].filter((d) => !!d);
      const earliest = candidates.length ? candidates.sort()[0] : null;
      let streamRows = 0;
      let bytes = 0;
      for (const [k, s] of streams) {
        if (k.startsWith(key(userId, ""))) {
          streamRows++;
          bytes += JSON.stringify(s).length;
        }
      }
      const metricDaysRows = storedDayRows;
      bytes += JSON.stringify(acts).length + metricDaysRows * 200 + w.length * 80;
      return {
        metrics: metricCov,
        activities: {
          count: acts.length,
          withGps: acts.filter((a) => a.hasGps).length,
          firstStart: starts[0] ?? null,
          lastStart: starts[starts.length - 1] ?? null,
          totalDistanceM: acts.reduce((s, a) => s + (a.distanceM ?? 0), 0)
        },
        weight: { count: w.length, firstDay: w[0] ?? null, lastDay: w[w.length - 1] ?? null },
        earliest,
        storage: {
          totalBytes: bytes,
          rows: { metricDays: metricDaysRows, activities: acts.length, streams: streamRows, weight: w.length }
        }
      };
    },
    async getSyncState(userId, source) {
      return syncState.get(key(userId, source)) ?? null;
    },
    async setSyncState(userId, state) {
      syncState.set(key(userId, state.source), state);
    },
    async startRun(input) {
      runs.set(input.id, {
        id: input.id,
        userId: input.userId,
        kind: input.kind,
        status: "running",
        startedAt: input.startedAt,
        finishedAt: null,
        total: input.total,
        done: 0,
        step: null,
        error: null,
        detail: null
      });
    },
    async updateRun(id, patch) {
      const cur = runs.get(id);
      if (!cur) return;
      runs.set(id, { ...cur, ...patch });
    },
    async getRun(id) {
      return runs.get(id) ?? null;
    },
    async failRunningRuns(reason, finishedAt) {
      let healed = 0;
      for (const [id, r] of runs) {
        if (r.status === "running") {
          runs.set(id, { ...r, status: "failed", error: reason, finishedAt });
          healed++;
        }
      }
      return healed;
    },
    async getLatestRun(userId) {
      return [...runs.values()].filter((r) => r.userId === userId).sort((a, b) => a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0)[0] ?? null;
    }
  };
}
const ACTIVITY_READ_LIMIT = 2e3;
function createLocalGarminService(deps) {
  const { store, sidecar, userId } = deps;
  return {
    login(input) {
      return sidecar.login(input);
    },
    getStatus() {
      return sidecar.getStatus();
    },
    disconnect() {
      return sidecar.disconnect();
    },
    async getMetric(name, date) {
      if (name === "activities") {
        const day = date ?? await lastActivityDay(store, userId);
        if (!day) return { metric: name, date: date ?? null, data: null };
        const { days } = await activitiesForRange(store, userId, day, day);
        return { metric: name, date: day, data: days[0]?.data ?? null };
      }
      if (date) return { metric: name, date, data: await store.getMetricDay(userId, name, date) };
      return latestMetric(store, userId, name);
    },
    getMetricRange(name, start, end) {
      if (name === "activities") return activitiesForRange(store, userId, start, end);
      return store.getMetricRange(userId, name, start, end);
    }
  };
}
async function latestMetric(store, userId, name) {
  const cov = (await store.coverage(userId)).metrics.find((m) => m.metric === name);
  if (!cov?.lastDay) return { metric: name, date: null, data: null };
  const data = await store.getMetricDay(userId, name, cov.lastDay);
  return { metric: name, date: cov.lastDay, data };
}
function forWire(a) {
  const { userId: _userId, raw: _raw, ...rest } = a;
  return rest;
}
function localDay(a) {
  return a.startTimeLocal.slice(0, 10);
}
async function lastActivityDay(store, userId) {
  const [newest] = await store.listActivities(userId, { sort: "date", dir: "desc", limit: 1 });
  return newest ? localDay(newest) : null;
}
async function activitiesForRange(store, userId, start, end) {
  const metric = "activities";
  const [inWindow, [oldest], [newest]] = await Promise.all([
    store.listActivities(userId, {
      from: start,
      to: end,
      sort: "date",
      dir: "asc",
      limit: ACTIVITY_READ_LIMIT
    }),
    store.listActivities(userId, { sort: "date", dir: "asc", limit: 1 }),
    store.listActivities(userId, { sort: "date", dir: "desc", limit: 1 })
  ]);
  const byDay = /* @__PURE__ */ new Map();
  for (const a of inWindow) {
    const day = localDay(a);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(forWire(a));
    else byDay.set(day, [forWire(a)]);
  }
  const first = oldest ? localDay(oldest) : null;
  const last = newest ? localDay(newest) : null;
  const days = [];
  const cursor = /* @__PURE__ */ new Date(`${start}T00:00:00Z`);
  const stop = /* @__PURE__ */ new Date(`${end}T00:00:00Z`);
  while (cursor.getTime() <= stop.getTime()) {
    const stamp = cursor.toISOString().slice(0, 10);
    const found = byDay.get(stamp);
    const covered = first !== null && last !== null && stamp >= first && stamp <= last;
    days.push({ date: stamp, data: found ?? (covered ? [] : null) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { metric, start, end, days };
}
const EFFORT_SPORT_GROUPS = ["run", "walk"];
const EFFORT_SPORT_KEYS = EFFORT_SPORT_GROUPS.flatMap((g) => sportKeysInGroup(g));
const CANDIDATE_SCAN_LIMIT = 2e4;
function deriveBestEfforts(streams) {
  const n = streamLength(streams);
  if (n < 2) return [];
  const elapsed = elapsedSeconds(streams, n);
  const distance = cumulativeDistance(streams, elapsed);
  if (!distance) return [];
  return bestEfforts(distance, elapsed).map((e) => ({
    key: e.key,
    metres: e.metres,
    durationS: e.durationS,
    actualM: e.actualM,
    paceSecPerKm: e.paceSecPerKm,
    startS: e.startS,
    samples: e.samples
  }));
}
async function backfillBestEfforts(store, userId, budget) {
  const take = Math.max(0, budget);
  const versions = await store.listBestEffortVersions(userId);
  const activities = await store.listActivities(userId, {
    sports: EFFORT_SPORT_KEYS,
    limit: CANDIDATE_SCAN_LIMIT
  });
  const candidates = activities.filter(
    (a) => versions.has(a.activityId) && (versions.get(a.activityId) ?? 0) < BEST_EFFORTS_VERSION
  );
  let computed = 0;
  for (const activity of candidates.slice(0, take)) {
    const streams = await store.getStreams(userId, activity.activityId);
    if (!streams) continue;
    await store.putActivityBestEfforts(userId, {
      activityId: activity.activityId,
      sport: activity.sport,
      day: toDayKey(activity.startTimeLocal),
      version: BEST_EFFORTS_VERSION,
      efforts: deriveBestEfforts(streams)
    });
    computed++;
  }
  return { computed, pending: Math.max(0, candidates.length - computed) };
}
function asRecord(v) {
  return v && typeof v === "object" ? v : null;
}
function num(o, keys) {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}
function int(o, keys) {
  const n = num(o, keys);
  return n === null ? null : Math.round(n);
}
function str(o, keys) {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}
function sportOf(o) {
  const at = asRecord(o["activityType"]) ?? asRecord(o["activityTypeDTO"]);
  const key2 = at ? str(at, ["typeKey"]) : null;
  return key2 ?? str(o, ["activityType", "sportTypeKey"]) ?? "other";
}
function toIso(gmt, local) {
  const src = gmt ?? local;
  if (!src) return (/* @__PURE__ */ new Date(0)).toISOString();
  const iso = src.includes("T") ? src : src.replace(" ", "T");
  const withZone = gmt ? iso.endsWith("Z") ? iso : `${iso}Z` : iso;
  const d = new Date(withZone);
  return Number.isNaN(d.getTime()) ? (/* @__PURE__ */ new Date(0)).toISOString() : d.toISOString();
}
function normalizeActivity(userId, raw) {
  const o = asRecord(raw);
  if (!o) return null;
  const idRaw = o["activityId"] ?? o["activityIdStr"];
  const activityId = idRaw === void 0 || idRaw === null ? null : String(idRaw);
  if (!activityId) return null;
  const startTimeLocal = str(o, ["startTimeLocal"]) ?? str(o, ["startTimeGMT"]) ?? "1970-01-01 00:00:00";
  const startTimeGmt = str(o, ["startTimeGMT"]);
  return {
    userId,
    activityId,
    sport: sportOf(o),
    name: str(o, ["activityName", "name"]),
    startTime: toIso(startTimeGmt, startTimeLocal),
    startTimeLocal,
    distanceM: num(o, ["distance", "distanceInMeters"]),
    durationS: num(o, ["duration", "elapsedDuration", "movingDuration"]),
    movingS: num(o, ["movingDuration", "duration"]),
    elevationGainM: num(o, ["elevationGain", "totalElevationGain"]),
    avgHr: int(o, ["averageHR", "avgHr"]),
    maxHr: int(o, ["maxHR", "maxHr"]),
    avgPower: int(o, ["avgPower", "averagePower", "avgBikingPower"]),
    maxPower: int(o, ["maxPower", "maxBikingPower"]),
    normPower: int(o, ["normPower", "normalizedPower"]),
    calories: int(o, ["calories", "activeKilocalories"]),
    trainingLoad: num(o, ["activityTrainingLoad", "trainingLoad"]),
    hasGps: o["hasPolyline"] === true || o["hasGps"] === true,
    raw
  };
}
const STREAM_FIELDS = [
  "gps",
  "time",
  "heartRate",
  "power",
  "cadence",
  "fractionalCadence",
  "speed",
  "elevation",
  "grade",
  "temperature",
  "respirationRate",
  "verticalRatio",
  "verticalOscillation",
  "groundContactTime",
  "groundContactBalance",
  "strideLength",
  "stamina",
  "staminaPotential",
  "performanceCondition",
  "movingDuration",
  "moving",
  "laps",
  "typedSplits"
];
function streamsFromDetails(d) {
  const streams = { v: STREAMS_SCHEMA_VERSION };
  for (const field of STREAM_FIELDS) {
    const value = d[field];
    if (Array.isArray(value) && value.length > 0) streams[field] = value;
  }
  return streams;
}
function wantsStreams(a) {
  return a.hasGps || a.avgPower != null || a.avgHr != null || a.maxHr != null;
}
const DAILY_METRICS = GARMIN_METRICS.filter(
  (m) => m !== "activities" && m !== "body_composition"
);
const CHUNK_DAYS = 31;
const EMPTY_CHUNK_STOP = 12;
const ACTIVITY_PAGE = 100;
const MAX_ACTIVITY_PAGES = 200;
const WEIGHT_CHUNK_DAYS = 366;
const METRICS_FLOOR_DAYS = 365 * 12;
const METRICS_DEFAULT_TARGET_DAYS = 365;
const METRICS_PRE_ACTIVITY_DAYS = 90;
const BACKFILL_CHUNKS_FULL = 8;
const BACKFILL_CHUNKS_INCREMENTAL = 6;
const WEIGHT_BACKFILL_DAYS = 365 * 8;
const MAX_FRESH_DAYS = 366;
const PLANNED_AHEAD_DAYS = 28;
const PLANNED_BEHIND_DAYS = 1;
const WORKOUT_PUSH_PER_RUN = 20;
const EFFORTS_PER_RUN_FULL = 200;
const EFFORTS_PER_RUN_INCREMENTAL = 60;
const EFFORTS_PER_UNCHANGED_TICK = 40;
const PROBE_ACTIVITIES = 10;
class NotConnected extends Error {
  constructor(failure) {
    super("garmin not connected");
    this.failure = failure;
  }
}
class Cancelled extends Error {
}
const FAILURE_TEXT = {
  timeout: "Garmin nie odpowiedział na czas",
  sidecar_unreachable: "usługa Garmin (sidecar) nie odpowiada",
  rate_limited: "Garmin ogranicza tempo zapytań",
  token_rejected: "Garmin odrzucił token — połącz konto ponownie",
  not_connected: "konto Garmin nie jest połączone",
  blocked: "Garmin zablokował połączenie",
  not_found: "endpoint Garmina nie istnieje",
  bad_response: "nieoczekiwana odpowiedź usługi",
  internal_key_rejected: "błąd konfiguracji: web i sidecar mają różne INTERNAL_API_KEY",
  upstream_error: "błąd po stronie Garmina"
};
function phaseFailure(err) {
  if (err instanceof Cancelled) throw err;
  if (err instanceof NotConnected) throw err;
  const failure = garminFailureOf(err);
  if (err instanceof GarminNotAuthenticatedError) throw new NotConnected(failure);
  const text = FAILURE_TEXT[failure.code] ?? "błąd";
  return {
    text: failure.upstreamStatus ? `${text} (HTTP ${failure.upstreamStatus})` : text,
    code: failure.code,
    retryable: failure.retryable,
    ...failure.endpoint ? { endpoint: failure.endpoint } : {}
  };
}
function createSyncEngine(deps) {
  const { store, sourceFor, clock, logger, random } = deps;
  const timeZone = deps.timeZone ?? DEFAULT_TIME_ZONE;
  const workoutPushEnabled = deps.workoutPushEnabled ?? false;
  async function syncUser(userId, opts) {
    const source = sourceFor(userId);
    const kind = opts.kind;
    const streamsBudget = opts.streamsPerRun ?? (kind === "full" ? 400 : 80);
    const effortsBudget = opts.effortsPerRun ?? (kind === "full" ? EFFORTS_PER_RUN_FULL : EFFORTS_PER_RUN_INCREMENTAL);
    const weightBackfillDays = opts.weightBackfillDays ?? WEIGHT_BACKFILL_DAYS;
    const incrementalDays = opts.incrementalDays ?? 10;
    const backfillChunks = opts.backfillChunksPerRun ?? (kind === "full" ? BACKFILL_CHUNKS_FULL : BACKFILL_CHUNKS_INCREMENTAL);
    const today = todayKey(clock, timeZone);
    const runId = random.token(12);
    const startedAt = clock.now().toISOString();
    let connected = false;
    try {
      connected = (await source.getStatus()).authenticated;
    } catch {
      connected = false;
    }
    if (!connected) {
      await store.startRun({ id: runId, userId, kind, total: 0, startedAt });
      opts.onStart?.(runId);
      await store.updateRun(runId, {
        status: "failed",
        error: "garmin_not_connected",
        finishedAt: clock.now().toISOString()
      });
      return await store.getRun(runId);
    }
    const prior = await store.getSyncState(userId, "garmin");
    const priorFrom = typeof prior?.cursor?.metricsFrom === "string" ? String(prior.cursor.metricsFrom) : today;
    const freshStart = maxDay(
      addDays(today, -MAX_FRESH_DAYS),
      minDay(addDays(today, -incrementalDays), addDays(priorFrom, -incrementalDays))
    );
    const outageOverran = daysBetween(priorFrom, today) > MAX_FRESH_DAYS;
    const freshChunks = Math.max(1, Math.ceil((daysBetween(freshStart, today) + 1) / CHUNK_DAYS));
    const estChunks = freshChunks + backfillChunks;
    const estTotal = MAX_ACTIVITY_PAGES / 8 + streamsBudget + 4 + DAILY_METRICS.length * estChunks;
    await store.startRun({ id: runId, userId, kind, total: Math.round(estTotal), startedAt });
    opts.onStart?.(runId);
    const detail = {};
    const LOG_CAP = 250;
    const logEntries = [];
    const log = (level, msg, extra = {}) => {
      logEntries.push({ t: clock.now().toISOString(), level, msg, ...extra });
      if (logEntries.length > LOG_CAP) logEntries.splice(0, logEntries.length - LOG_CAP);
      detail.log = logEntries;
    };
    const logFailure = (phase, what, f, extra = {}) => {
      log("error", `${what}: ${f.text}.`, {
        phase,
        code: f.code,
        retryable: f.retryable,
        ...f.endpoint ? { endpoint: f.endpoint } : {},
        ...extra
      });
    };
    let done = 0;
    let lastPersisted = 0;
    const bump = async (step, by = 1) => {
      done += by;
      if (done - lastPersisted >= 20) {
        lastPersisted = done;
        await store.updateRun(runId, { done, step, detail });
        if ((await store.getRun(runId))?.status === "cancelled") throw new Cancelled();
      }
    };
    const savePhase = async (step) => {
      await store.updateRun(runId, { done, step, detail });
      if ((await store.getRun(runId))?.status === "cancelled") throw new Cancelled();
    };
    log("info", `Start synchronizacji (${kind}). Świeże dane od ${freshStart}.`, { phase: "start" });
    try {
      try {
        const knownIds = /* @__PURE__ */ new Set();
        if (kind === "incremental") {
          for (const a of await store.listActivities(userId, { limit: 400 })) knownIds.add(a.activityId);
        }
        let count = 0;
        let pages = 0;
        log("info", "Aktywności: pobieranie listy…", { phase: "activities" });
        for (let page = 0; page < MAX_ACTIVITY_PAGES; page++) {
          const raw = await source.listActivitiesPage(ACTIVITY_PAGE, page * ACTIVITY_PAGE);
          pages++;
          if (raw.length === 0) {
            log("info", `Aktywności: strona ${page + 1} pusta — koniec listy.`, { phase: "activities" });
            break;
          }
          const normalized = raw.map((r) => normalizeActivity(userId, r)).filter((a) => a !== null);
          await store.putActivities(userId, normalized);
          count += normalized.length;
          log(
            "info",
            `Aktywności: strona ${page + 1} — ${raw.length} z API, ${normalized.length} zapisanych.`,
            { phase: "activities" }
          );
          if (raw.length > 0 && normalized.length === 0) {
            const first = raw[0];
            const keys = first && typeof first === "object" ? Object.keys(first).slice(0, 20).join(", ") : typeof first;
            log(
              "warn",
              `Aktywności: 0 znormalizowanych z ${raw.length}. Klucze pierwszego rekordu: ${keys}`,
              { phase: "activities" }
            );
          }
          await bump(`activities p${page + 1}`);
          if (kind === "incremental" && normalized.length > 0 && normalized.every((a) => knownIds.has(a.activityId)))
            break;
          if (raw.length < ACTIVITY_PAGE) break;
        }
        detail.activities = { pages, count };
        log(count > 0 ? "info" : "warn", `Aktywności: gotowe — ${count} zapisanych (${pages} stron).`, {
          phase: "activities"
        });
      } catch (err) {
        const f = phaseFailure(err);
        detail.activities = {
          pages: detail.activities?.pages ?? 0,
          count: detail.activities?.count ?? 0,
          error: f.text,
          errorCode: f.code,
          retryable: f.retryable
        };
        logFailure("activities", "Aktywności", f);
      }
      await savePhase("activities");
      try {
        let budget = streamsBudget;
        let fetched = 0;
        let repaired = 0;
        const candidates = (await store.listActivities(userId, { limit: 5e3 })).filter(wantsStreams);
        const versions = await store.listStreamVersions(userId);
        const missing = candidates.filter((a) => !versions.has(a.activityId));
        const stale = candidates.filter(
          (a) => (versions.get(a.activityId) ?? 0) < STREAMS_SCHEMA_VERSION && versions.has(a.activityId)
        );
        log(
          "info",
          `Trasy/strumienie: ${missing.length} brakujących, ${stale.length} do odświeżenia (limit pobrań ${streamsBudget}).`,
          { phase: "streams" }
        );
        for (const a of [...missing, ...stale]) {
          if (budget <= 0) break;
          const isRepair = versions.has(a.activityId);
          const d = await source.getActivityDetails(a.activityId);
          await store.putStreams(userId, a.activityId, streamsFromDetails(d));
          if (d.gps && d.gps.length > 0 && !a.hasGps)
            await store.putActivities(userId, [{ ...a, hasGps: true }]);
          budget--;
          if (isRepair) repaired++;
          else fetched++;
          await bump(`streams ${a.activityId}`);
        }
        detail.streams = {
          fetched,
          repaired,
          pending: Math.max(0, missing.length + stale.length - fetched - repaired)
        };
        log("info", `Trasy/strumienie: pobrano ${fetched} nowych, odświeżono ${repaired}.`, {
          phase: "streams"
        });
      } catch (err) {
        const f = phaseFailure(err);
        detail.streams = {
          fetched: detail.streams?.fetched ?? 0,
          error: f.text,
          errorCode: f.code,
          retryable: f.retryable
        };
        logFailure("streams", "Trasy/strumienie", f);
      }
      try {
        const efforts = await backfillBestEfforts(store, userId, effortsBudget);
        detail.streams = {
          ...detail.streams ?? { fetched: 0 },
          efforts: efforts.computed,
          effortsPending: efforts.pending
        };
        await bump("best efforts", efforts.computed);
        log(
          "info",
          `Najlepsze odcinki: policzono dla ${efforts.computed} aktywności` + (efforts.pending > 0 ? `, zostało ${efforts.pending}.` : "."),
          { phase: "streams" }
        );
      } catch (err) {
        if (err instanceof Cancelled) throw err;
        log("warn", "Najlepsze odcinki: nie udało się przeliczyć w tym przebiegu.", {
          phase: "streams"
        });
        logger.warn("best-efforts derivation failed", { userId });
      }
      await savePhase("streams");
      try {
        const weightStart = kind === "incremental" ? addDays(today, -90) : addDays(today, -weightBackfillDays);
        let points = 0;
        let wEnd = today;
        while (daysBetween(weightStart, wEnd) >= 0) {
          const wStart = maxDay(weightStart, addDays(wEnd, -(WEIGHT_CHUNK_DAYS - 1)));
          const pts = await source.getWeightRange(wStart, wEnd);
          if (pts.length > 0) {
            await store.putWeight(
              userId,
              pts.map((p) => ({
                day: p.day,
                weightKg: p.weightKg,
                source: "garmin",
                raw: p.raw
              }))
            );
            points += pts.length;
          }
          await bump(`weight ${wStart}`);
          wEnd = addDays(wStart, -1);
        }
        detail.weight = { points };
        log("info", `Waga: ${points} pomiarów.`, { phase: "weight" });
      } catch (err) {
        const f = phaseFailure(err);
        detail.weight = {
          points: detail.weight?.points ?? 0,
          error: f.text,
          errorCode: f.code,
          retryable: f.retryable
        };
        logFailure("weight", "Waga", f);
      }
      await savePhase("weight");
      if (source.getPlannedEvents) {
        try {
          const from = addDays(today, -PLANNED_BEHIND_DAYS);
          const to = addDays(today, PLANNED_AHEAD_DAYS);
          const feed = await source.getPlannedEvents(from, to);
          if (feed.available) {
            await store.replacePlannedEvents(
              userId,
              from,
              to,
              feed.events.map((e) => ({ ...e, source: "garmin" }))
            );
          }
          detail.planned = { available: feed.available, count: feed.events.length, from, to };
          log(
            "info",
            feed.available ? `Plan treningowy: ${feed.events.length} zaplanowanych pozycji (${from}..${to}).` : "Plan treningowy: Garmin nie udostępnił kalendarza dla tego konta.",
            { phase: "planned" }
          );
        } catch (err) {
          const f = phaseFailure(err);
          detail.planned = {
            available: false,
            count: 0,
            error: f.text,
            errorCode: f.code,
            retryable: f.retryable
          };
          logFailure("planned", "Plan treningowy", f);
        }
        await savePhase("planned");
      }
      if (workoutPushEnabled && source.createWorkout && source.scheduleWorkout) {
        try {
          const nowIso = clock.now().toISOString();
          const candidates = (await store.listWorkouts(userId, { from: today })).filter(
            (w) => w.pushState === "pending" || w.pushState === "failed"
          );
          const batch = candidates.slice(0, WORKOUT_PUSH_PER_RUN);
          let pushed = 0;
          let failed = 0;
          let unsupported = 0;
          let stopped = null;
          for (const w of batch) {
            try {
              let garminWorkoutId = w.garminWorkoutId;
              if (!garminWorkoutId) {
                const created = await source.createWorkout({
                  sport: w.sport,
                  title: w.title,
                  steps: w.steps
                });
                if (!created.supported || !created.workoutId) {
                  await store.updateWorkout(userId, w.id, {
                    pushState: "unsupported",
                    pushError: created.reason === "unsupported_sport" ? "Garmin nie zna tej dyscypliny jako treningu" : "Garmin nie udostępnia zapisu treningów dla tego konta",
                    updatedAt: nowIso
                  });
                  unsupported += 1;
                  continue;
                }
                garminWorkoutId = created.workoutId;
                await store.updateWorkout(userId, w.id, { garminWorkoutId, updatedAt: nowIso });
              }
              const scheduled = await source.scheduleWorkout(garminWorkoutId, w.day);
              if (!scheduled.supported) {
                await store.updateWorkout(userId, w.id, {
                  pushState: "failed",
                  pushError: "trening zapisany, ale nie trafił do kalendarza",
                  updatedAt: nowIso
                });
                failed += 1;
                continue;
              }
              await store.updateWorkout(userId, w.id, {
                pushState: "pushed",
                pushError: null,
                garminScheduleId: scheduled.scheduleId,
                updatedAt: nowIso
              });
              pushed += 1;
            } catch (err) {
              const f = phaseFailure(err);
              await store.updateWorkout(userId, w.id, {
                pushState: f.retryable ? "failed" : "unsupported",
                pushError: f.text,
                updatedAt: nowIso
              });
              if (f.retryable) failed += 1;
              else unsupported += 1;
              if (f.code === "sidecar_unreachable" || f.code === "timeout" || f.code === "rate_limited") {
                stopped = f;
                break;
              }
            }
            await bump(`workoutPush ${w.day}`);
          }
          const stillPending = (await store.listWorkouts(userId, { from: today })).filter(
            (w) => w.pushState === "pending" || w.pushState === "failed"
          ).length;
          detail.workoutPush = {
            pushed,
            failed,
            unsupported,
            pending: stillPending,
            ...stopped ? { error: stopped.text, errorCode: stopped.code, retryable: stopped.retryable } : {}
          };
          log(
            stopped ? "error" : "info",
            `Wysyłka treningów: ${pushed} wysłanych, ${failed} nieudanych, ${unsupported} niewspieranych, ${stillPending} w kolejce.`,
            { phase: "workoutPush", ...stopped ? { code: stopped.code, retryable: stopped.retryable } : {} }
          );
        } catch (err) {
          const f = phaseFailure(err);
          detail.workoutPush = {
            pushed: detail.workoutPush?.pushed ?? 0,
            failed: detail.workoutPush?.failed ?? 0,
            unsupported: detail.workoutPush?.unsupported ?? 0,
            pending: detail.workoutPush?.pending ?? 0,
            error: f.text,
            errorCode: f.code,
            retryable: f.retryable
          };
          logFailure("workoutPush", "Wysyłka treningów", f);
        }
        await savePhase("workoutPush");
      }
      const coverage = await store.coverage(userId);
      const firstActivityDay = coverage.activities.firstStart ? coverage.activities.firstStart.slice(0, 10) : null;
      const floorDay = addDays(today, -METRICS_FLOOR_DAYS);
      const requestedTarget = opts.metricsBackfillDays != null ? maxDay(floorDay, addDays(today, -opts.metricsBackfillDays)) : null;
      const hardStopDay = requestedTarget ?? floorDay;
      const backfillTarget = maxDay(
        hardStopDay,
        requestedTarget ?? (firstActivityDay ? addDays(firstActivityDay, -METRICS_PRE_ACTIVITY_DAYS) : addDays(today, -METRICS_DEFAULT_TARGET_DAYS))
      );
      const priorFrontier = typeof prior?.cursor?.metricsBackfilledTo === "string" ? String(prior.cursor.metricsBackfilledTo) : null;
      const priorComplete = prior?.cursor?.metricsComplete === true && priorFrontier != null && priorFrontier <= backfillTarget;
      let frontier = opts.resetBackfill || outageOverran || !priorFrontier ? freshStart : minDay(priorFrontier, freshStart);
      let complete = opts.resetBackfill || outageOverran ? false : priorComplete;
      log(
        "info",
        `Metryki dzienne: świeże ${freshStart}..${today}; historia do ${backfillTarget}` + (complete ? " (kompletna)." : `, uzupełniono do ${frontier}.`),
        { phase: "metrics" }
      );
      const saveFrontier = async () => {
        await store.setSyncState(userId, {
          source: "garmin",
          // Spread the prior cursor: it also carries keys this phase knows nothing about (the
          // spec-027 probe signature), and replacing the whole object would silently drop them.
          cursor: {
            ...prior?.cursor ?? {},
            metricsFrom: today,
            metricsBackfilledTo: frontier,
            metricsComplete: complete,
            metricsTarget: backfillTarget
          },
          lastFullSyncAt: prior?.lastFullSyncAt ?? null,
          lastSyncAt: clock.now().toISOString()
        });
      };
      try {
        let chunks = 0;
        let daysWithData = 0;
        let emptyStreak = 0;
        const failed = { count: 0, last: null };
        const pullChunk = async (chunkStart, chunkEnd) => {
          let hadData = false;
          for (const metric of DAILY_METRICS) {
            try {
              const range = await source.getMetricRange(metric, chunkStart, chunkEnd);
              const days = range.days.map((d) => ({ day: d.date, data: d.data }));
              await store.putMetricDays(userId, metric, days);
              const present = days.filter((d) => d.data != null).length;
              if (present > 0) {
                hadData = true;
                daysWithData += present;
              }
            } catch (callErr) {
              const f = phaseFailure(callErr);
              failed.count++;
              failed.last = f;
              if (failed.count <= 8) {
                log("warn", `Metryki: ${metric} ${chunkStart}..${chunkEnd} — ${f.text}.`, {
                  phase: "metrics",
                  metric,
                  day: chunkStart,
                  code: f.code,
                  retryable: f.retryable
                });
              }
            }
            await bump(`${metric} ${chunkStart}`);
          }
          chunks++;
          return hadData;
        };
        let freshEnd = today;
        while (daysBetween(freshStart, freshEnd) >= 0) {
          const chunkStart = maxDay(freshStart, addDays(freshEnd, -(CHUNK_DAYS - 1)));
          await pullChunk(chunkStart, freshEnd);
          freshEnd = addDays(chunkStart, -1);
        }
        log("info", `Metryki: świeże ${freshStart}..${today} — ${daysWithData} dni z danymi.`, {
          phase: "metrics",
          day: freshStart
        });
        let cursorDay = addDays(frontier, -1);
        let budget = backfillChunks;
        while (!complete && budget > 0 && daysBetween(hardStopDay, cursorDay) >= 0) {
          const chunkStart = maxDay(hardStopDay, addDays(cursorDay, -(CHUNK_DAYS - 1)));
          const hadData = await pullChunk(chunkStart, cursorDay);
          frontier = chunkStart;
          cursorDay = addDays(chunkStart, -1);
          budget--;
          emptyStreak = hadData ? 0 : emptyStreak + 1;
          if (daysBetween(hardStopDay, cursorDay) < 0) complete = true;
          if (emptyStreak >= EMPTY_CHUNK_STOP) {
            complete = true;
            log("info", `Metryki: ${EMPTY_CHUNK_STOP} kolejnych bloków bez danych — historia wyczerpana.`, {
              phase: "metrics"
            });
          }
          await saveFrontier();
          log("info", `Metryki: uzupełniono wstecz do ${frontier}.`, { phase: "metrics", day: frontier });
        }
        const remainingDays = complete ? 0 : Math.max(0, daysBetween(backfillTarget, frontier));
        detail.metrics = {
          chunks,
          days: daysWithData,
          windowStart: frontier,
          backfillTo: frontier,
          backfillTarget,
          remainingDays,
          complete,
          ...failed.count > 0 ? {
            error: `${failed.count} zapytań nie powiodło się: ${failed.last?.text ?? "błąd"}`,
            ...failed.last ? { errorCode: failed.last.code, retryable: failed.last.retryable } : {}
          } : {}
        };
        log(
          "info",
          `Metryki dzienne: gotowe — ${daysWithData} dni, ${chunks} bloków${failed.count ? `, ${failed.count} błędów` : ""}. ` + (complete ? "Historia kompletna." : `Uzupełniono do ${frontier}, zostało ~${remainingDays} dni.`),
          { phase: "metrics" }
        );
      } catch (err) {
        const f = phaseFailure(err);
        detail.metrics = {
          chunks: detail.metrics?.chunks ?? 0,
          days: detail.metrics?.days ?? 0,
          windowStart: frontier,
          backfillTo: frontier,
          backfillTarget,
          remainingDays: Math.max(0, daysBetween(backfillTarget, frontier)),
          complete,
          error: f.text,
          errorCode: f.code,
          retryable: f.retryable
        };
        logFailure("metrics", "Metryki dzienne", f);
      }
      const finishedAt = clock.now().toISOString();
      await store.setSyncState(userId, {
        source: "garmin",
        cursor: {
          ...prior?.cursor ?? {},
          metricsFrom: today,
          metricsBackfilledTo: frontier,
          metricsComplete: complete,
          metricsTarget: backfillTarget
        },
        lastFullSyncAt: kind === "full" ? finishedAt : prior?.lastFullSyncAt ?? null,
        lastSyncAt: finishedAt
      });
      const anyData = (detail.activities?.count ?? 0) > 0 || (detail.metrics?.days ?? 0) > 0 || (detail.weight?.points ?? 0) > 0 || (detail.streams?.fetched ?? 0) > 0;
      log(
        anyData ? "info" : "error",
        anyData ? "Synchronizacja zakończona." : "Synchronizacja zakończona — brak danych."
      );
      await store.updateRun(runId, {
        done,
        total: done,
        status: anyData ? "succeeded" : "failed",
        step: "done",
        finishedAt,
        detail,
        ...anyData ? {} : { error: "no_data_synced" }
      });
      logger.info?.("sync finished", { userId, kind, ...flatCounts(detail) });
    } catch (err) {
      const finishedAt = clock.now().toISOString();
      if (err instanceof Cancelled) {
        log("warn", "Synchronizacja zatrzymana przez użytkownika.", { phase: "done" });
        await store.updateRun(runId, { status: "cancelled", step: "zatrzymano", finishedAt, detail });
        logger.info?.("sync cancelled", { userId, kind, ...flatCounts(detail) });
      } else {
        const message = err instanceof NotConnected ? "garmin_not_connected" : "sync_failed";
        const code = err instanceof NotConnected ? err.failure.code : garminFailureOf(err).code;
        log("error", `Synchronizacja przerwana: ${FAILURE_TEXT[code] ?? message}.`, {
          phase: "done",
          code,
          retryable: false
        });
        await store.updateRun(runId, { status: "failed", error: message, finishedAt, detail });
        logger.error?.("sync failed", { userId, kind, error: message, code });
      }
    }
    return await store.getRun(runId);
  }
  async function probeSignature(userId) {
    const source = sourceFor(userId);
    const today = todayKey(clock, timeZone);
    const [page, steps] = await Promise.all([
      source.listActivitiesPage(PROBE_ACTIVITIES, 0),
      source.getMetricRange("steps", today, today)
    ]);
    const newest = page.map((r) => normalizeActivity(userId, r)).filter((a) => a !== null).map((a) => `${a.activityId}@${a.startTime}`);
    const stepsToday = steps.days.map((d) => extractMetricValue({ keys: ["totalSteps"] }, d.data)).find((v) => v !== null);
    return `${today}|${page.length}|${newest.join(",")}|${stepsToday ?? "none"}`;
  }
  async function syncIfChanged(userId, opts) {
    let signature = null;
    try {
      signature = await probeSignature(userId);
    } catch {
      logger.info?.("sync probe failed — syncing anyway", { userId });
    }
    const prior = await store.getSyncState(userId, "garmin");
    const priorSignature = typeof prior?.cursor?.probeSignature === "string" ? String(prior.cursor.probeSignature) : null;
    const checkedAt = clock.now().toISOString();
    if (signature !== null && priorSignature !== null && signature === priorSignature) {
      try {
        const efforts = await backfillBestEfforts(store, userId, EFFORTS_PER_UNCHANGED_TICK);
        if (efforts.computed > 0)
          logger.info?.("best efforts derived on an unchanged tick", {
            userId,
            computed: efforts.computed,
            pending: efforts.pending
          });
      } catch {
        logger.warn("best-efforts derivation failed on an unchanged tick", { userId });
      }
      await store.setSyncState(userId, {
        source: "garmin",
        cursor: {
          ...prior?.cursor ?? {},
          probeSignature: signature,
          lastCheckAt: checkedAt,
          lastResult: "unchanged"
        },
        lastFullSyncAt: prior?.lastFullSyncAt ?? null,
        lastSyncAt: prior?.lastSyncAt ?? null
      });
      logger.info?.("sync skipped — nothing changed upstream", { userId });
      return null;
    }
    const run = await syncUser(userId, opts);
    const after = await store.getSyncState(userId, "garmin");
    await store.setSyncState(userId, {
      source: "garmin",
      cursor: {
        ...after?.cursor ?? {},
        ...signature !== null ? { probeSignature: signature } : {},
        lastCheckAt: checkedAt,
        lastResult: "synced"
      },
      lastFullSyncAt: after?.lastFullSyncAt ?? null,
      lastSyncAt: after?.lastSyncAt ?? null
    });
    return run;
  }
  return { syncUser, syncIfChanged };
}
function flatCounts(d) {
  return {
    activities: d.activities?.count ?? 0,
    streams: d.streams?.fetched ?? 0,
    bestEfforts: d.streams?.efforts ?? 0,
    weight: d.weight?.points ?? 0,
    metricDays: d.metrics?.days ?? 0
  };
}
function asSyncSource(g) {
  const maybe = g;
  return {
    ...g,
    listActivitiesPage: maybe.listActivitiesPage?.bind(g) ?? (async () => []),
    getActivityDetails: maybe.getActivityDetails?.bind(g) ?? (async (activityId) => ({ activityId })),
    getWeightRange: maybe.getWeightRange?.bind(g) ?? (async () => [])
  };
}
function createContainer(overrides = {}) {
  const config = overrides.config ?? loadConfig();
  const logger = overrides.logger ?? createLogger(config.isProd ? "info" : "debug");
  if (config.isProd && config.garminAdapter === "http" && !config.garminInternalKey) {
    logger.warn(
      "GARMIN_INTERNAL_KEY is not set: the sidecar accepts any X-User-Id from anything that can reach it. Set the same value as the sidecar INTERNAL_API_KEY in .env."
    );
  }
  const clock = overrides.clock ?? systemClock;
  const random = overrides.random ?? systemRandom;
  const fetchImpl = overrides.fetch ?? globalThis.fetch.bind(globalThis);
  const db = overrides.db ?? (overrides.repo ? null : createDb(config.databaseUrl));
  const repo = overrides.repo ?? createPgRepo(db, random);
  const auth = overrides.auth ?? (config.authAdapter === "mock" ? createMockAuthProvider() : createOidcAuthProvider({
    clientId: config.googleClientId,
    clientSecret: config.googleClientSecret,
    fetch: fetchImpl,
    clock
  }));
  const store = overrides.store ?? (overrides.repo ? createMemoryStore() : createPgStore(db));
  const garminSyncFor = overrides.garminSyncFor ? (userId) => asSyncSource(overrides.garminSyncFor(userId)) : overrides.garmin ? () => asSyncSource(overrides.garmin) : config.garminAdapter === "mock" ? (userId) => createDevGarminMock(userId) : (userId) => createGarminHttpAdapter({
    baseUrl: config.garminSidecarUrl,
    fetch: fetchImpl,
    logger,
    userId,
    internalKey: config.garminInternalKey
  });
  const garminFor = overrides.garminFor ?? (overrides.garmin ? () => overrides.garmin : (userId) => createLocalGarminService({ store, sidecar: garminSyncFor(userId), userId }));
  const syncEngine = createSyncEngine({
    store,
    sourceFor: garminSyncFor,
    clock,
    logger,
    random,
    timeZone: config.appTimeZone,
    // Spec 050: the only phase that WRITES to Garmin, so it is opt-in per deployment.
    workoutPushEnabled: config.garminWorkoutPush
  });
  const session = overrides.session ?? createSessionService({
    users: repo.users,
    sessions: repo.sessions,
    ttlSeconds: config.sessionTtlSeconds,
    clock
  });
  const consentStore = overrides.consentStore ?? createPgConsentStore(db, clock);
  const consentFor = overrides.consentFor ?? ((userId) => createConsentService({ store: consentStore, userId }));
  const setupRateLimiter = overrides.setupRateLimiter ?? createRateLimiter({ limit: 8, windowMs: 5 * 6e4, now: () => clock.now().getTime() });
  return {
    config,
    logger,
    clock,
    random,
    db,
    repo,
    auth,
    session,
    consentStore,
    store,
    syncEngine,
    schedulerRef: { current: null },
    setupRateLimiter,
    garminFor,
    garminSyncFor,
    consentFor
  };
}
const PUBLIC_PAGES = /* @__PURE__ */ new Set(["/", "/login"]);
const PUBLIC_APIS = /* @__PURE__ */ new Set(["/api/health"]);
function isPublicPath(path) {
  const isApi = path.startsWith("/api/");
  return (isApi ? PUBLIC_APIS.has(path) : PUBLIC_PAGES.has(path)) || path.startsWith("/auth/") || // Exact/segment matches only — a broad prefix would silently expose a future
  // /mcp-admin or /styleguide-internal route (security review finding).
  path === "/mcp" || path === "/styleguide" || path.startsWith("/styleguide/");
}
function authGuard(input) {
  if (input.authenticated || isPublicPath(input.path)) return { action: "allow" };
  if (input.path.startsWith("/api/")) return { action: "unauthorized" };
  return input.routeMatched ? { action: "redirect", to: "/login" } : { action: "allow" };
}
function securityHeaders(input) {
  const headers = {
    // Stop MIME-sniffing responses into an executable type.
    "X-Content-Type-Options": "nosniff",
    // No framing — clickjacking guard (belt-and-suspenders with CSP frame-ancestors).
    "X-Frame-Options": "DENY",
    // Don't leak full URLs (which may carry an MCP token) to other origins.
    "Referrer-Policy": "strict-origin-when-cross-origin",
    // Turn off powerful features the app never uses.
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    // Isolate our browsing context.
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-DNS-Prefetch-Control": "off"
  };
  if (input.https) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }
  return headers;
}
const DEFAULT_SYNC_INTERVAL_MS = 30 * 6e4;
async function runScheduledSync(deps) {
  let sessionsSwept = 0;
  if (deps.sessions) {
    try {
      sessionsSwept = await deps.sessions.sweepExpired();
    } catch {
      deps.logger.warn("expired-session sweep failed");
    }
  }
  const ids = await deps.users.listIds();
  let failed = 0;
  let skipped = 0;
  for (const userId of ids) {
    try {
      const run = await deps.syncEngine.syncIfChanged(userId, { kind: "incremental" });
      if (run === null) skipped++;
      else if (run.status === "failed") failed++;
    } catch {
      failed++;
      deps.logger.warn("scheduled sync failed for a user");
    }
  }
  deps.logger.info("scheduled sync tick complete", {
    attempted: ids.length,
    skipped,
    failed,
    sessionsSwept
  });
  return { attempted: ids.length, skipped, failed, sessionsSwept };
}
function startSyncScheduler(deps) {
  const intervalMs = deps.intervalMs ?? DEFAULT_SYNC_INTERVAL_MS;
  const clock = deps.clock ?? systemClock;
  let next = new Date(clock.now().getTime() + intervalMs);
  const timer = setInterval(() => {
    next = new Date(clock.now().getTime() + intervalMs);
    void runScheduledSync(deps);
  }, intervalMs);
  timer.unref?.();
  return { stop: () => clearInterval(timer), nextRunAt: () => next, intervalMs };
}
let container = null;
let schedulerStarted = false;
function getContainer() {
  if (!container) container = createContainer();
  if (!schedulerStarted && container.db) {
    schedulerStarted = true;
    container.schedulerRef.current = startSyncScheduler({
      users: container.repo.users,
      syncEngine: container.syncEngine,
      logger: container.logger,
      clock: container.clock,
      intervalMs: container.config.syncIntervalMinutes * 6e4,
      // Expired sessions are swept on the same tick (spec 055).
      sessions: container.session
    });
  }
  return container;
}
let migrated = null;
function ensureMigrated(c) {
  if (!migrated) {
    migrated = c.db ? migrate(c.db).then(async () => {
      const healed = await c.store.failRunningRuns("interrupted", c.clock.now().toISOString());
      if (healed > 0) c.logger.warn("healed interrupted sync runs at startup", { healed });
    }).catch((err) => {
      migrated = null;
      throw err;
    }) : Promise.resolve();
  }
  return migrated;
}
const handle = async ({ event, resolve: resolve2 }) => {
  const c = getContainer();
  await ensureMigrated(c);
  event.locals.container = c;
  const sessionId = event.cookies.get(c.session.cookieName);
  const user = await c.session.resolve(sessionId);
  event.locals.user = user;
  event.locals.authenticated = user !== null;
  if (user) {
    event.locals.garmin = c.garminFor(user.id);
    event.locals.consent = c.consentFor(user.id);
  }
  const decision = authGuard({
    authenticated: event.locals.authenticated,
    path: event.url.pathname,
    routeMatched: event.route.id !== null
  });
  if (decision.action === "unauthorized") {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  }
  if (decision.action === "redirect") throw redirect(303, decision.to);
  const response = await resolve2(event);
  const https = c.config.isProd || event.url.protocol === "https:";
  for (const [name, value] of Object.entries(securityHeaders({ https }))) {
    response.headers.set(name, value);
  }
  return response;
};
export {
  handle
};
