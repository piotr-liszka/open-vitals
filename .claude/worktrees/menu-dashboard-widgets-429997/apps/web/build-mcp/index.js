// src/lib/date.ts
var DEFAULT_TIME_ZONE = "Europe/Warsaw";
var InvalidDayKeyError = class extends Error {
  constructor(value) {
    super(`invalid day key: ${JSON.stringify(value)} (expected YYYY-MM-DD)`);
    this.value = value;
    this.name = "InvalidDayKeyError";
  }
};
var DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
function daysFromCivil({ year, month, day }) {
  const y = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function civilFromDays(serial) {
  const z6 = serial + 719468;
  const era = Math.floor(z6 / 146097);
  const doe = z6 - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  return { year: y + (month <= 2 ? 1 : 0), month, day };
}
function pad(n, width) {
  return String(n).padStart(width, "0");
}
function keyOf({ year, month, day }) {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}
function isDayKey(value) {
  if (typeof value !== "string" || !DAY_KEY_RE.test(value)) return false;
  const parts = rawParts(value);
  return keyOf(civilFromDays(daysFromCivil(parts))) === value;
}
function rawParts(value) {
  return {
    year: Number(value.slice(0, 4)),
    month: Number(value.slice(5, 7)),
    day: Number(value.slice(8, 10))
  };
}
function parseDayKey(value) {
  if (!isDayKey(value)) throw new InvalidDayKeyError(value);
  return rawParts(value);
}
function toDayKey(value) {
  const head = value.slice(0, 10);
  if (!isDayKey(head)) throw new InvalidDayKeyError(value);
  return head;
}
function addDays(key2, n) {
  return civilKey(daysFromCivil(parseDayKey(key2)) + Math.trunc(n));
}
function civilKey(serial) {
  return keyOf(civilFromDays(serial));
}
function daysBetween(from, to) {
  return daysFromCivil(parseDayKey(to)) - daysFromCivil(parseDayKey(from));
}
function compareDays(a, b) {
  const d = daysBetween(b, a);
  return d === 0 ? 0 : d < 0 ? -1 : 1;
}
function minDay(a, b) {
  return compareDays(a, b) <= 0 ? a : b;
}
function maxDay(a, b) {
  return compareDays(a, b) >= 0 ? a : b;
}
var dayKeyFormatters = /* @__PURE__ */ new Map();
function dayKeyFormatter(timeZone) {
  let fmt = dayKeyFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayKeyFormatters.set(timeZone, fmt);
  }
  return fmt;
}
function dayKeyOf(instant, timeZone = DEFAULT_TIME_ZONE) {
  const parts = dayKeyFormatter(timeZone).formatToParts(instant);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  const key2 = `${get("year")}-${get("month")}-${get("day")}`;
  if (!isDayKey(key2)) throw new InvalidDayKeyError(key2);
  return key2;
}
function todayKey(clock, timeZone = DEFAULT_TIME_ZONE) {
  return dayKeyOf(clock.now(), timeZone);
}

// src/lib/server/config.ts
import { z } from "zod";
function isKnownTimeZone(tz) {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
var schema = z.object({
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

// src/lib/server/clock.ts
var systemClock = {
  now: () => /* @__PURE__ */ new Date(),
  nowSeconds: () => Math.floor(Date.now() / 1e3)
};

// src/lib/server/logger.ts
var LEVEL_ORDER = { debug: 10, info: 20, warn: 30, error: 40 };
var REDACT_KEYS = /pass(word)?|secret|token|cookie|authorization|mfa|email|credential|session/i;
var MAX_DEPTH = 6;
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

// src/lib/server/random.ts
import { randomBytes } from "node:crypto";
function base64url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}
var systemRandom = {
  token: (byteLength = 32) => base64url(randomBytes(byteLength))
};

// src/lib/server/session.ts
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

// src/lib/server/interfaces.ts
var GARMIN_METRICS = [
  "sleep",
  "steps",
  "hrv",
  "body_battery",
  "stress",
  "resting_heart_rate",
  "activities",
  "spo2",
  "respiration",
  "calories",
  "body_composition",
  "training_readiness"
];
var GarminNotAuthenticatedError = class extends Error {
  failure;
  constructor(message = "Garmin account is not connected", failure) {
    super(message);
    this.name = "GarminNotAuthenticatedError";
    this.failure = failure ?? { code: "not_connected", retryable: false };
  }
};
var GarminUnavailableError = class extends Error {
  failure;
  constructor(message = "Garmin service is unavailable", failure) {
    super(message);
    this.name = "GarminUnavailableError";
    this.failure = failure ?? { code: "upstream_error", retryable: true };
  }
};
function garminFailureOf(err) {
  if (err instanceof GarminUnavailableError || err instanceof GarminNotAuthenticatedError) {
    return err.failure;
  }
  if (err instanceof Error && err.name === "AbortError") return { code: "timeout", retryable: true };
  return { code: "upstream_error", retryable: true, reason: err instanceof Error ? err.name : "error" };
}

// src/lib/server/garmin/http-adapter.ts
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
  const fail2 = async (res, path) => {
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
    if (!res.ok) await fail2(res, path);
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
      if (!res.ok && res.status !== 404) await fail2(res, "/session");
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
var FAILURE_CODES = /* @__PURE__ */ new Set([
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
var PLANNED_KINDS = /* @__PURE__ */ new Set(["workout", "race", "note"]);
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
var STREAM_KEYS = [
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
var STREAM_ALIASES = {
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
var isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var finite = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
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
var LAP_NUMBER_KEYS = [
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
var LAP_TEXT_KEYS = ["type", "intensityType", "startTimeGmt"];
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

// src/lib/server/garmin/mock-adapter.ts
function eachDate(start, end) {
  const out = [];
  const s = /* @__PURE__ */ new Date(`${start}T00:00:00Z`);
  const e = /* @__PURE__ */ new Date(`${end}T00:00:00Z`);
  for (let d = s; d.getTime() <= e.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// src/lib/server/garmin/dev-mock.ts
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
var DEV_SPORTS = ["cycling", "virtual_ride", "running", "walking", "hiking"];
var DEV_ACTIVITY_COUNT = 140;
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
var devWorkoutSeq = 0;

// src/lib/server/consent/store.ts
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

// src/lib/server/consent/registry.ts
var FEATURES = [
  {
    id: "mcp",
    title: "Konektor MCP",
    summary: "Pozw\xF3l klientowi AI czyta\u0107 Twoje dane z Garmina przez osobisty adres MCP.",
    // 1.1 (spec 050): the connector is no longer read-only in every configuration — workout authoring
    // can write, behind its own consent. Bumping is free here (`requiresConsent: false`), and leaving
    // the old "tylko do odczytu" wording in place would have been a false claim.
    termsVersion: "1.1",
    requiresConsent: false,
    defaultEnabled: true,
    termsText: "Konektor MCP udost\u0119pnia Twoje dane z Garmina pod adresem chronionym tokenem. Domy\u015Blnie tylko do odczytu \u2014 jedyny zapis to treningi, kt\xF3re sam tworzysz, i wymaga osobnej zgody (\u201EZapis trening\xF3w w Garminie\u201D). Dzia\u0142a bezstanowo: us\u0142uga nie zapisuje niczego o \u017C\u0105daniach MCP \u2014 \u017Cadnej historii, analityki ani log\xF3w zwracanych danych. Ka\u017Cdy, kto ma ten adres (zawieraj\u0105cy sekretny token przypisany tylko do Ciebie), mo\u017Ce czyta\u0107 Twoje dane, wi\u0119c traktuj go jak has\u0142o i wymie\u0144 w Ustawieniach, je\u015Bli wycieknie. Poniewa\u017C nic nie jest przechowywane, ta funkcja nie wymaga osobnej zgody i jest w\u0142\u0105czona domy\u015Blnie."
  },
  {
    // The single Base → Advanced gate. Accepting it unlocks the whole processed experience
    // (pulpit, analityka, wnioski i wykresy). Kept under the id `detailed_analytics` for
    // continuity; renaming the key to `data_processing` is a tracked follow-up (spec 014).
    id: "detailed_analytics",
    title: "Tryb zaawansowany \u2014 przetwarzanie danych",
    summary: "W\u0142\u0105cz pulpit, analityk\u0119, wnioski i wykresy. Twoje dane s\u0105 przetwarzane, aby je pokaza\u0107.",
    termsVersion: "1.0",
    requiresConsent: true,
    defaultEnabled: false,
    termsText: "Tryb zaawansowany przetwarza Twoje dane z Garmina, aby pokaza\u0107 pulpit, wielodniowe trendy, wnioski (gotowo\u015B\u0107, anomalie, korelacje) oraz wykresy d\u0142ugiego okresu. Aby narysowa\u0107 wykresy, aplikacja pyta Twoje po\u0142\u0105czone konto Garmin o zakres dziennych warto\u015Bci i renderuje je w Twojej przegl\u0105darce. Dane s\u0105 przetwarzane w pami\u0119ci na potrzeby wykres\xF3w; nie s\u0105 sprzedawane, udost\u0119pniane ani wysy\u0142ane poza t\u0119 us\u0142ug\u0119 i nie s\u0105 przechowywane d\u0142u\u017Cej ni\u017C Twoja sesja. Zgod\u0119 mo\u017Cesz wycofa\u0107 w ka\u017Cdej chwili \u2014 wycofanie wraca do trybu podstawowego (samo po\u0142\u0105czenie Garmin + Tw\xF3j adres MCP) i zatrzymuje pobieranie zakres\xF3w. Je\u015Bli warunki si\u0119 zmieni\u0105, poprosimy Ci\u0119 o ich ponown\u0105 akceptacj\u0119, zanim przetwarzanie wznowi dzia\u0142anie."
  },
  {
    // Spec 050. The FIRST capability that writes to the user's Garmin account, so it requires
    // explicit consent even though everything it writes is the user's own authored content. The
    // read-only tools stay available without it.
    id: "workout_write",
    title: "Zapis trening\xF3w w Garminie",
    summary: "Pozw\xF3l tworzy\u0107 treningi tutaj i wysy\u0142a\u0107 je do kalendarza Garmina (i na zegarek).",
    termsVersion: "1.0",
    requiresConsent: true,
    defaultEnabled: false,
    termsText: "Ta funkcja jako jedyna ZAPISUJE dane na Twoim koncie Garmin. Treningi tworzysz tutaj (w aplikacji lub przez klienta AI); s\u0105 zapisywane lokalnie, a synchronizacja wysy\u0142a je do Twojej biblioteki trening\xF3w i kalendarza w Garminie, sk\u0105d trafiaj\u0105 na zegarek. Wysy\u0142ane s\u0105 tylko treningi, kt\xF3re sam utworzysz: ich nazwa, dyscyplina, dzie\u0144 i kroki. Nic innego na Twoim koncie Garmin nie jest zmieniane ani usuwane. Usuni\u0119cie treningu tutaj usuwa go tak\u017Ce w Garminie. Zgod\u0119 mo\u017Cesz wycofa\u0107 w ka\u017Cdej chwili \u2014 wycofanie zatrzymuje wysy\u0142k\u0119; treningi ju\u017C wys\u0142ane zostaj\u0105 w Garminie, dop\xF3ki ich nie usuniesz."
  }
];
var WORKOUT_WRITE_FEATURE = "workout_write";

// src/lib/server/consent/types.ts
var UnknownFeatureError = class extends Error {
  constructor(featureId) {
    super(`unknown feature: ${featureId}`);
    this.name = "UnknownFeatureError";
  }
};
var TermsVersionMismatchError = class extends Error {
  constructor() {
    super("terms version mismatch \u2014 re-fetch the current terms before accepting");
    this.name = "TermsVersionMismatchError";
  }
};

// src/lib/server/consent/service.ts
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

// src/lib/server/db/index.ts
import postgres from "postgres";
function createDb(databaseUrl) {
  return postgres(databaseUrl, {
    // Keep types plain; we map rows explicitly in the adapters.
    transform: { undefined: null }
  });
}

// src/lib/server/repo/pg.ts
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

// src/lib/server/auth/oidc.ts
import { createRemoteJWKSet, jwtVerify } from "jose";

// src/lib/server/crypto.ts
import { timingSafeEqual } from "node:crypto";
function safeEqual(a, b) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// src/lib/server/auth/types.ts
var AuthExchangeError = class extends Error {
  constructor(message = "OIDC token exchange failed") {
    super(message);
    this.name = "AuthExchangeError";
  }
};

// src/lib/server/auth/oidc.ts
var DEFAULT_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration";
var SCOPE = "openid email profile";
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

// src/lib/server/auth/mock.ts
var MOCK_IDENTITY = {
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

// src/lib/server/rate-limit.ts
function createRateLimiter(opts) {
  const { limit, windowMs, now: now2 } = opts;
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
      const t = now2();
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
      const t = now2();
      const recent = prune(key2, t);
      if (recent.length >= limit) return blocked(recent, t);
      return { allowed: true, retryAfterSeconds: 0, remaining: limit - recent.length };
    }
  };
}

// src/lib/sport-labels.ts
var SPORT_LABELS = [
  /* ---- ride ---- */
  { key: "cycling", label: "Rower", group: "ride" },
  { key: "road_biking", label: "Rower szosowy", group: "ride" },
  { key: "mountain_biking", label: "Rower g\xF3rski", group: "ride" },
  { key: "gravel_cycling", label: "Gravel", group: "ride" },
  { key: "cyclocross", label: "Prze\u0142aje", group: "ride" },
  { key: "downhill_biking", label: "Rower zjazdowy", group: "ride" },
  { key: "virtual_ride", label: "Rower wirtualny", group: "ride" },
  { key: "indoor_cycling", label: "Rower stacjonarny", group: "ride" },
  { key: "track_cycling", label: "Kolarstwo torowe", group: "ride" },
  { key: "bmx", label: "BMX", group: "ride" },
  { key: "recumbent_cycling", label: "Rower poziomy", group: "ride" },
  { key: "handcycling", label: "Handbike", group: "ride" },
  { key: "indoor_handcycling", label: "Handbike stacjonarny", group: "ride" },
  { key: "e_bike_fitness", label: "Rower elektryczny", group: "ride" },
  { key: "e_bike_mountain", label: "Rower elektryczny g\xF3rski", group: "ride" },
  { key: "ebikeride", label: "Rower elektryczny", group: "ride" },
  /* ---- run ---- */
  { key: "running", label: "Bieg", group: "run" },
  { key: "trail_running", label: "Bieg terenowy", group: "run" },
  { key: "street_running", label: "Bieg uliczny", group: "run" },
  { key: "track_running", label: "Bieg na stadionie", group: "run" },
  { key: "treadmill_running", label: "Bie\u017Cnia", group: "run" },
  { key: "indoor_running", label: "Bieg w hali", group: "run" },
  { key: "virtual_run", label: "Bieg wirtualny", group: "run" },
  { key: "obstacle_run", label: "Bieg z przeszkodami", group: "run" },
  { key: "ultra_run", label: "Bieg ultra", group: "run" },
  /* ---- swim ---- */
  { key: "swimming", label: "P\u0142ywanie", group: "swim" },
  { key: "lap_swimming", label: "P\u0142ywanie (basen)", group: "swim" },
  { key: "open_water_swimming", label: "P\u0142ywanie (wody otwarte)", group: "swim" },
  /* ---- walk ---- */
  { key: "walking", label: "Marsz", group: "walk" },
  { key: "casual_walking", label: "Spacer", group: "walk" },
  { key: "speed_walking", label: "Marsz szybki", group: "walk" },
  { key: "indoor_walking", label: "Marsz w pomieszczeniu", group: "walk" },
  { key: "hiking", label: "W\u0119dr\xF3wka", group: "walk" },
  { key: "rucking", label: "Marsz z obci\u0105\u017Ceniem", group: "walk" },
  { key: "mountaineering", label: "Turystyka wysokog\xF3rska", group: "walk" },
  /* ---- strength / gym ---- */
  { key: "strength_training", label: "Si\u0142ownia", group: "strength" },
  { key: "functional_strength", label: "Trening funkcjonalny", group: "strength" },
  { key: "indoor_cardio", label: "Trening cardio", group: "strength" },
  { key: "cardio_training", label: "Trening cardio", group: "strength" },
  { key: "hiit", label: "Trening interwa\u0142owy (HIIT)", group: "strength" },
  { key: "pilates", label: "Pilates", group: "strength" },
  { key: "elliptical", label: "Orbitrek", group: "strength" },
  { key: "stair_climbing", label: "Stepper", group: "strength" },
  { key: "indoor_rowing", label: "Wio\u015Blarstwo (ergometr)", group: "strength" },
  /* ---- other ---- */
  { key: "yoga", label: "Joga", group: "other" },
  { key: "breathwork", label: "Oddech", group: "other" },
  { key: "meditation", label: "Medytacja", group: "other" },
  { key: "stretching", label: "Rozci\u0105ganie", group: "other" },
  { key: "rowing", label: "Wio\u015Blarstwo", group: "other" },
  { key: "kayaking", label: "Kajak", group: "other" },
  { key: "canoeing", label: "Kanadyjka", group: "other" },
  { key: "stand_up_paddleboarding", label: "Deska SUP", group: "other" },
  { key: "whitewater_rafting", label: "Rafting", group: "other" },
  { key: "sailing", label: "\u017Beglarstwo", group: "other" },
  { key: "surfing", label: "Surfing", group: "other" },
  { key: "windsurfing", label: "Windsurfing", group: "other" },
  { key: "kitesurfing", label: "Kitesurfing", group: "other" },
  { key: "inline_skating", label: "Rolki", group: "other" },
  { key: "skateboarding", label: "Deskorolka", group: "other" },
  { key: "ice_skating", label: "\u0141y\u017Cwy", group: "other" },
  { key: "skate_skiing", label: "Narty biegowe (\u0142y\u017Cwa)", group: "other" },
  { key: "cross_country_skiing", label: "Narty biegowe", group: "other" },
  { key: "cross_country_skiing_ws", label: "Narty biegowe", group: "other" },
  { key: "backcountry_skiing", label: "Skitury", group: "other" },
  { key: "resort_skiing", label: "Narty zjazdowe", group: "other" },
  { key: "resort_skiing_snowboarding_ws", label: "Narty / snowboard", group: "other" },
  { key: "snowboarding", label: "Snowboard", group: "other" },
  { key: "snowshoeing", label: "Rakiety \u015Bnie\u017Cne", group: "other" },
  { key: "snowmobiling", label: "Skuter \u015Bnie\u017Cny", group: "other" },
  { key: "rock_climbing", label: "Wspinaczka ska\u0142kowa", group: "other" },
  { key: "indoor_climbing", label: "Wspinaczka (\u015Bcianka)", group: "other" },
  { key: "bouldering", label: "Bouldering", group: "other" },
  { key: "tennis", label: "Tenis", group: "other" },
  { key: "table_tennis", label: "Tenis sto\u0142owy", group: "other" },
  { key: "padel", label: "Padel", group: "other" },
  { key: "squash", label: "Squash", group: "other" },
  { key: "badminton", label: "Badminton", group: "other" },
  { key: "soccer", label: "Pi\u0142ka no\u017Cna", group: "other" },
  { key: "basketball", label: "Koszyk\xF3wka", group: "other" },
  { key: "volleyball", label: "Siatk\xF3wka", group: "other" },
  { key: "golf", label: "Golf", group: "other" },
  { key: "boxing", label: "Boks", group: "other" },
  { key: "horseback_riding", label: "Jazda konna", group: "other" },
  { key: "fishing", label: "W\u0119dkarstwo", group: "other" },
  { key: "hunting", label: "\u0141owiectwo", group: "other" },
  { key: "triathlon", label: "Triatlon", group: "other" },
  { key: "multi_sport", label: "Multisport", group: "other" },
  { key: "transition", label: "Strefa zmian", group: "other" },
  { key: "winter_sports", label: "Sporty zimowe", group: "other" },
  { key: "other", label: "Inne", group: "other" }
];
var BY_KEY = new Map(SPORT_LABELS.map((s) => [s.key, s]));
var SPORT_GROUP_LABELS = {
  ride: "Rower",
  run: "Bieg",
  walk: "Marsz",
  swim: "P\u0142ywanie",
  strength: "Si\u0142a",
  other: "Inne"
};
var KEYS_BY_GROUP = (() => {
  const m = /* @__PURE__ */ new Map();
  for (const s of SPORT_LABELS) {
    const bucket = m.get(s.group);
    if (bucket) bucket.push(s.key);
    else m.set(s.group, [s.key]);
  }
  return m;
})();
function humanizeSportKey(key2) {
  const words = key2.replace(/[_-]+/g, " ").trim().toLocaleLowerCase("pl-PL");
  if (words.length === 0) return "Inne";
  return words.charAt(0).toLocaleUpperCase("pl-PL") + words.slice(1);
}
function sportLabel(key2) {
  return BY_KEY.get(key2)?.label ?? humanizeSportKey(key2);
}
function sportMeta(key2) {
  return BY_KEY.get(key2);
}
function sportGroup(key2) {
  return BY_KEY.get(key2)?.group ?? "other";
}
function sportGroupLabel(group) {
  return SPORT_GROUP_LABELS[group];
}
var SPORT_GROUPS = Object.keys(SPORT_GROUP_LABELS);
function isSportGroup(value) {
  return typeof value === "string" && Object.hasOwn(SPORT_GROUP_LABELS, value);
}
var SPORT_GROUP_LANES = {
  ride: "var(--lane-cyan)",
  run: "var(--lane-orange)",
  walk: "var(--lane-green)",
  swim: "var(--lane-sky)",
  strength: "var(--lane-violet)",
  other: "var(--lane-amber)"
};
function sportGroupLane(group) {
  return SPORT_GROUP_LANES[group];
}
function sportKeysInGroup(group) {
  return KEYS_BY_GROUP.get(group) ?? [];
}

// src/lib/server/store/types.ts
var STREAMS_SCHEMA_VERSION = 2;
var BEST_EFFORTS_VERSION = 1;
var DuplicateGoalError = class extends Error {
  constructor(garminEventId) {
    super("goal already imported for this planned event");
    this.garminEventId = garminEventId;
    this.name = "DuplicateGoalError";
  }
};

// src/lib/server/store/pg.ts
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
var isoDay = (d) => d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
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
var AUTHORED_COLUMNS = [
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
var PUSH_STATES = ["pending", "pushed", "failed", "unsupported"];
var TEMPLATE_COLUMNS = ["id", "sport", "title", "steps", "note", "created_at", "updated_at"];
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
var GOAL_COLUMNS = [
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
var GOAL_KINDS = ["race", "fitness"];
var GOAL_PRIORITIES = ["a", "b", "c"];
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

// src/lib/server/store/memory.ts
var key = (a, b) => `${a}\0${b}`;
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
var localDay = (s) => s.slice(0, 10);
var rankOrder = (a, b) => a.durationS - b.durationS || a.day.localeCompare(b.day) || a.activityId.localeCompare(b.activityId);
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
    if (q.from) list = list.filter((a) => localDay(a.startTimeLocal) >= q.from);
    if (q.to) list = list.filter((a) => localDay(a.startTimeLocal) <= q.to);
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
        if (query.year && Number(localDay(a.startTimeLocal).slice(0, 4)) !== query.year) continue;
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

// src/lib/server/store/local-garmin.ts
var ACTIVITY_READ_LIMIT = 2e3;
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
function localDay2(a) {
  return a.startTimeLocal.slice(0, 10);
}
async function lastActivityDay(store, userId) {
  const [newest] = await store.listActivities(userId, { sort: "date", dir: "desc", limit: 1 });
  return newest ? localDay2(newest) : null;
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
    const day = localDay2(a);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(forWire(a));
    else byDay.set(day, [forWire(a)]);
  }
  const first = oldest ? localDay2(oldest) : null;
  const last = newest ? localDay2(newest) : null;
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

// src/lib/server/garmin/metric-specs.ts
var METRICS = [
  {
    key: "steps",
    label: "Kroki",
    accent: "orange",
    unit: "",
    format: "int",
    goodWhen: "up",
    summable: true,
    // Sourced from the daily summary (the sidecar routes `steps` there).
    keys: ["totalSteps"]
  },
  {
    key: "resting_heart_rate",
    label: "T\u0119tno spoczynkowe",
    accent: "red",
    unit: "bpm",
    format: "int",
    goodWhen: "down",
    summable: false,
    keys: ["restingHeartRate"]
  },
  {
    key: "hrv",
    label: "HRV",
    accent: "green",
    unit: "ms",
    format: "int",
    goodWhen: "up",
    summable: false,
    keys: ["hrvSummary.lastNightAvg", "hrvSummary.weeklyAvg"]
  },
  {
    key: "body_battery",
    label: "Body Battery",
    accent: "cyan",
    unit: "",
    format: "int",
    goodWhen: "up",
    summable: false,
    // Body Battery is a per-reading array over the day; the daily representative
    // is the peak charge reached. Rows are [epochMs, status, level, ...].
    keys: [],
    extract: (data) => maxOfArray(data["bodyBatteryValuesArray"], 2)
  },
  {
    key: "sleep",
    label: "Sen",
    accent: "indigo",
    unit: "",
    format: "duration",
    goodWhen: "up",
    summable: false,
    keys: ["dailySleepDTO.sleepTimeSeconds"]
  },
  {
    key: "stress",
    label: "Stres",
    accent: "amber",
    unit: "",
    format: "int",
    goodWhen: "down",
    summable: false,
    keys: ["avgStressLevel"]
  },
  {
    key: "spo2",
    label: "SpO\u2082",
    accent: "sky",
    unit: "%",
    format: "int",
    goodWhen: "up",
    summable: false,
    // Sourced from the daily summary (garmy has no standalone spo2 metric).
    keys: ["averageSpo2"]
  },
  {
    key: "respiration",
    label: "Oddech",
    accent: "teal",
    unit: "brpm",
    format: "int",
    goodWhen: "down",
    summable: false,
    keys: ["avgWakingRespirationValue", "avgSleepRespirationValue"]
  },
  {
    key: "calories",
    label: "Kalorie",
    accent: "lime",
    unit: "kcal",
    format: "int",
    goodWhen: "up",
    summable: true,
    keys: ["totalKilocalories"]
  },
  {
    key: "training_readiness",
    label: "Gotowo\u015B\u0107 (Garmin)",
    accent: "violet",
    unit: "",
    format: "int",
    goodWhen: "up",
    summable: false,
    // Garmin's own 0–100 verdict (spec 059). Deliberately NOT a contributor to our
    // readiness weights: folding one composite into another would double-count the
    // channels both are already built from, and make neither number explainable.
    keys: ["score"]
  }
];
function inner(raw) {
  if (raw && typeof raw === "object") {
    const obj = raw;
    if ("data" in obj && obj.data && typeof obj.data === "object") return obj.data;
    return obj;
  }
  return null;
}
function readPath(data, path) {
  if (!path.includes(".")) return data[path];
  let cur = data;
  for (const seg of path.split(".")) {
    if (cur == null || typeof cur !== "object") return void 0;
    cur = cur[seg];
  }
  return cur;
}
function pick(data, keys) {
  if (!data) return null;
  for (const k of keys) {
    const v = readPath(data, k);
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}
function maxOfArray(arr, col) {
  if (!Array.isArray(arr)) return null;
  let max = null;
  for (const row of arr) {
    const v = Array.isArray(row) ? row[col] : void 0;
    if (typeof v === "number" && Number.isFinite(v)) max = max === null ? v : Math.max(max, v);
  }
  return max;
}
function extractMetricValue(spec, rawDayData) {
  const data = inner(rawDayData);
  if (!data) return null;
  return spec.extract ? spec.extract(data) : pick(data, spec.keys);
}

// src/lib/analytics/best-efforts.ts
var EFFORT_DISTANCES = [
  { key: "400m", label: "400 m", metres: 400 },
  { key: "1k", label: "1 km", metres: 1e3 },
  { key: "mile", label: "1 mila", metres: 1609 },
  { key: "5k", label: "5 km", metres: 5e3 },
  { key: "10k", label: "10 km", metres: 1e4 },
  { key: "15k", label: "15 km", metres: 15e3 },
  { key: "half", label: "P\xF3\u0142maraton", metres: 21097 },
  { key: "marathon", label: "Maraton", metres: 42195 }
];
function bestEfforts(cumulativeM, elapsedS, distances = EFFORT_DISTANCES) {
  if (!cumulativeM || !elapsedS) return [];
  const n = Math.min(cumulativeM.length, elapsedS.length);
  if (n < 2) return [];
  const total = (cumulativeM[n - 1] ?? 0) - (cumulativeM[0] ?? 0);
  const out = [];
  for (const d of distances) {
    if (!(total >= d.metres)) continue;
    let best = null;
    let j = 0;
    for (let i = 0; i < n; i++) {
      const startM = cumulativeM[i];
      const startT = elapsedS[i];
      if (startM === void 0 || startT === void 0) continue;
      if (j < i) j = i;
      while (j < n && (cumulativeM[j] ?? 0) - startM < d.metres) j++;
      if (j >= n) break;
      const endM = cumulativeM[j];
      const endT = elapsedS[j];
      if (endM === void 0 || endT === void 0) continue;
      const durationS = endT - startT;
      if (!(durationS > 0)) continue;
      const actualM = endM - startM;
      if (best === null || durationS < best.durationS) {
        best = {
          key: d.key,
          label: d.label,
          metres: d.metres,
          durationS: round1(durationS),
          actualM: Math.round(actualM),
          // Paced over what was actually covered, so a coarse sample interval cannot flatter it.
          paceSecPerKm: round1(durationS / (actualM / 1e3)),
          startS: round1(startT),
          samples: j - i + 1
        };
      }
    }
    if (best) out.push(best);
  }
  return out;
}
function round1(v) {
  return Math.round(v * 10) / 10;
}

// src/lib/analytics/stream-axes.ts
var NUMERIC_STREAM_KEYS = [
  "time",
  "heartRate",
  "power",
  "cadence",
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
  "moving"
];
function streamLength(streams) {
  let n = 0;
  for (const key2 of NUMERIC_STREAM_KEYS) {
    const arr = streams[key2];
    if (Array.isArray(arr) && arr.length > n) n = arr.length;
  }
  return n;
}
function elapsedSeconds(streams, n) {
  const time = streams.time;
  const out = [];
  let last = 0;
  for (let i = 0; i < n; i++) {
    const t = time?.[i];
    last = typeof t === "number" && Number.isFinite(t) && t >= last ? t : time ? last : i;
    out.push(last);
  }
  return out;
}
function cumulativeDistance(streams, elapsed) {
  const speed = streams.speed;
  if (!speed || speed.length < 2) return null;
  const out = [];
  let total = 0;
  for (let i = 0; i < elapsed.length; i++) {
    if (i > 0) {
      const dt = (elapsed[i] ?? 0) - (elapsed[i - 1] ?? 0);
      const v = speed[i];
      if (dt > 0 && typeof v === "number" && Number.isFinite(v) && v > 0) total += v * dt;
    }
    out.push(total);
  }
  return total > 0 ? out : null;
}

// src/lib/server/sync/best-efforts.ts
var EFFORT_SPORT_GROUPS = ["run", "walk"];
var EFFORT_SPORT_KEYS = EFFORT_SPORT_GROUPS.flatMap((g) => sportKeysInGroup(g));
var CANDIDATE_SCAN_LIMIT = 2e4;
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

// src/lib/server/sync/normalize.ts
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
var STREAM_FIELDS = [
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

// src/lib/server/sync/engine.ts
function wantsStreams(a) {
  return a.hasGps || a.avgPower != null || a.avgHr != null || a.maxHr != null;
}
var DAILY_METRICS = GARMIN_METRICS.filter(
  (m) => m !== "activities" && m !== "body_composition"
);
var CHUNK_DAYS = 31;
var EMPTY_CHUNK_STOP = 12;
var ACTIVITY_PAGE = 100;
var MAX_ACTIVITY_PAGES = 200;
var WEIGHT_CHUNK_DAYS = 366;
var METRICS_FLOOR_DAYS = 365 * 12;
var METRICS_DEFAULT_TARGET_DAYS = 365;
var METRICS_PRE_ACTIVITY_DAYS = 90;
var BACKFILL_CHUNKS_FULL = 8;
var BACKFILL_CHUNKS_INCREMENTAL = 6;
var WEIGHT_BACKFILL_DAYS = 365 * 8;
var MAX_FRESH_DAYS = 366;
var PLANNED_AHEAD_DAYS = 28;
var PLANNED_BEHIND_DAYS = 1;
var WORKOUT_PUSH_PER_RUN = 20;
var EFFORTS_PER_RUN_FULL = 200;
var EFFORTS_PER_RUN_INCREMENTAL = 60;
var EFFORTS_PER_UNCHANGED_TICK = 40;
var PROBE_ACTIVITIES = 10;
var NotConnected = class extends Error {
  constructor(failure) {
    super("garmin not connected");
    this.failure = failure;
  }
};
var Cancelled = class extends Error {
};
var FAILURE_TEXT = {
  timeout: "Garmin nie odpowiedzia\u0142 na czas",
  sidecar_unreachable: "us\u0142uga Garmin (sidecar) nie odpowiada",
  rate_limited: "Garmin ogranicza tempo zapyta\u0144",
  token_rejected: "Garmin odrzuci\u0142 token \u2014 po\u0142\u0105cz konto ponownie",
  not_connected: "konto Garmin nie jest po\u0142\u0105czone",
  blocked: "Garmin zablokowa\u0142 po\u0142\u0105czenie",
  not_found: "endpoint Garmina nie istnieje",
  bad_response: "nieoczekiwana odpowied\u017A us\u0142ugi",
  internal_key_rejected: "b\u0142\u0105d konfiguracji: web i sidecar maj\u0105 r\xF3\u017Cne INTERNAL_API_KEY",
  upstream_error: "b\u0142\u0105d po stronie Garmina"
};
function phaseFailure(err) {
  if (err instanceof Cancelled) throw err;
  if (err instanceof NotConnected) throw err;
  const failure = garminFailureOf(err);
  if (err instanceof GarminNotAuthenticatedError) throw new NotConnected(failure);
  const text4 = FAILURE_TEXT[failure.code] ?? "b\u0142\u0105d";
  return {
    text: failure.upstreamStatus ? `${text4} (HTTP ${failure.upstreamStatus})` : text4,
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
    log("info", `Start synchronizacji (${kind}). \u015Awie\u017Ce dane od ${freshStart}.`, { phase: "start" });
    try {
      try {
        const knownIds = /* @__PURE__ */ new Set();
        if (kind === "incremental") {
          for (const a of await store.listActivities(userId, { limit: 400 })) knownIds.add(a.activityId);
        }
        let count = 0;
        let pages = 0;
        log("info", "Aktywno\u015Bci: pobieranie listy\u2026", { phase: "activities" });
        for (let page = 0; page < MAX_ACTIVITY_PAGES; page++) {
          const raw = await source.listActivitiesPage(ACTIVITY_PAGE, page * ACTIVITY_PAGE);
          pages++;
          if (raw.length === 0) {
            log("info", `Aktywno\u015Bci: strona ${page + 1} pusta \u2014 koniec listy.`, { phase: "activities" });
            break;
          }
          const normalized = raw.map((r) => normalizeActivity(userId, r)).filter((a) => a !== null);
          await store.putActivities(userId, normalized);
          count += normalized.length;
          log(
            "info",
            `Aktywno\u015Bci: strona ${page + 1} \u2014 ${raw.length} z API, ${normalized.length} zapisanych.`,
            { phase: "activities" }
          );
          if (raw.length > 0 && normalized.length === 0) {
            const first = raw[0];
            const keys = first && typeof first === "object" ? Object.keys(first).slice(0, 20).join(", ") : typeof first;
            log(
              "warn",
              `Aktywno\u015Bci: 0 znormalizowanych z ${raw.length}. Klucze pierwszego rekordu: ${keys}`,
              { phase: "activities" }
            );
          }
          await bump(`activities p${page + 1}`);
          if (kind === "incremental" && normalized.length > 0 && normalized.every((a) => knownIds.has(a.activityId)))
            break;
          if (raw.length < ACTIVITY_PAGE) break;
        }
        detail.activities = { pages, count };
        log(count > 0 ? "info" : "warn", `Aktywno\u015Bci: gotowe \u2014 ${count} zapisanych (${pages} stron).`, {
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
        logFailure("activities", "Aktywno\u015Bci", f);
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
          `Trasy/strumienie: ${missing.length} brakuj\u0105cych, ${stale.length} do od\u015Bwie\u017Cenia (limit pobra\u0144 ${streamsBudget}).`,
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
        log("info", `Trasy/strumienie: pobrano ${fetched} nowych, od\u015Bwie\u017Cono ${repaired}.`, {
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
          `Najlepsze odcinki: policzono dla ${efforts.computed} aktywno\u015Bci` + (efforts.pending > 0 ? `, zosta\u0142o ${efforts.pending}.` : "."),
          { phase: "streams" }
        );
      } catch (err) {
        if (err instanceof Cancelled) throw err;
        log("warn", "Najlepsze odcinki: nie uda\u0142o si\u0119 przeliczy\u0107 w tym przebiegu.", {
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
        log("info", `Waga: ${points} pomiar\xF3w.`, { phase: "weight" });
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
            feed.available ? `Plan treningowy: ${feed.events.length} zaplanowanych pozycji (${from}..${to}).` : "Plan treningowy: Garmin nie udost\u0119pni\u0142 kalendarza dla tego konta.",
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
                    pushError: created.reason === "unsupported_sport" ? "Garmin nie zna tej dyscypliny jako treningu" : "Garmin nie udost\u0119pnia zapisu trening\xF3w dla tego konta",
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
                  pushError: "trening zapisany, ale nie trafi\u0142 do kalendarza",
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
            `Wysy\u0142ka trening\xF3w: ${pushed} wys\u0142anych, ${failed} nieudanych, ${unsupported} niewspieranych, ${stillPending} w kolejce.`,
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
          logFailure("workoutPush", "Wysy\u0142ka trening\xF3w", f);
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
        `Metryki dzienne: \u015Bwie\u017Ce ${freshStart}..${today}; historia do ${backfillTarget}` + (complete ? " (kompletna)." : `, uzupe\u0142niono do ${frontier}.`),
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
                log("warn", `Metryki: ${metric} ${chunkStart}..${chunkEnd} \u2014 ${f.text}.`, {
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
        log("info", `Metryki: \u015Bwie\u017Ce ${freshStart}..${today} \u2014 ${daysWithData} dni z danymi.`, {
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
            log("info", `Metryki: ${EMPTY_CHUNK_STOP} kolejnych blok\xF3w bez danych \u2014 historia wyczerpana.`, {
              phase: "metrics"
            });
          }
          await saveFrontier();
          log("info", `Metryki: uzupe\u0142niono wstecz do ${frontier}.`, { phase: "metrics", day: frontier });
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
            error: `${failed.count} zapyta\u0144 nie powiod\u0142o si\u0119: ${failed.last?.text ?? "b\u0142\u0105d"}`,
            ...failed.last ? { errorCode: failed.last.code, retryable: failed.last.retryable } : {}
          } : {}
        };
        log(
          "info",
          `Metryki dzienne: gotowe \u2014 ${daysWithData} dni, ${chunks} blok\xF3w${failed.count ? `, ${failed.count} b\u0142\u0119d\xF3w` : ""}. ` + (complete ? "Historia kompletna." : `Uzupe\u0142niono do ${frontier}, zosta\u0142o ~${remainingDays} dni.`),
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
        anyData ? "Synchronizacja zako\u0144czona." : "Synchronizacja zako\u0144czona \u2014 brak danych."
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
        log("warn", "Synchronizacja zatrzymana przez u\u017Cytkownika.", { phase: "done" });
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
      logger.info?.("sync probe failed \u2014 syncing anyway", { userId });
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
      logger.info?.("sync skipped \u2014 nothing changed upstream", { userId });
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

// src/lib/server/container.ts
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

// src/lib/mcp/create-server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z as z5 } from "zod";

// src/lib/mcp/tools.ts
import { z as z2 } from "zod";

// src/lib/server/garmin/range.ts
var MAX_RANGE_DAYS = 31;
var MAX_CONCURRENCY = 4;
function toDayNumber(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m > 2 ? m - 3 : m + 9) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function fromDayNumber(days) {
  const z6 = days + 719468;
  const era = Math.floor((z6 >= 0 ? z6 : z6 - 146096) / 146097);
  const doe = z6 - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365
  );
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  const year = m <= 2 ? y + 1 : y;
  return `${String(year).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function chunkRange(start, end, maxDays = MAX_RANGE_DAYS) {
  const endNum = toDayNumber(end);
  const chunks = [];
  let cursor = toDayNumber(start);
  while (cursor <= endNum) {
    const chunkEnd = Math.min(cursor + maxDays - 1, endNum);
    chunks.push({ start: fromDayNumber(cursor), end: fromDayNumber(chunkEnd) });
    cursor = chunkEnd + 1;
  }
  return chunks;
}
async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
async function fetchMetricRangeChunked(garmin, name, start, end) {
  const chunks = chunkRange(start, end);
  if (chunks.length === 0) return [];
  const perChunk = await mapPool(chunks, MAX_CONCURRENCY, async (chunk) => {
    const range = await garmin.getMetricRange(name, chunk.start, chunk.end);
    return range.days;
  });
  const byDate = /* @__PURE__ */ new Map();
  for (const days of perChunk) {
    for (const day of days) {
      if (!byDate.has(day.date)) byDate.set(day.date, day);
    }
  }
  return [...byDate.values()];
}

// src/modules/insights/insights.engine.ts
var DEFAULT_INSIGHTS_CONFIG = {
  minBaselineDays: 5,
  stablePct: 3,
  anomalyZ: 2,
  maxAnomalies: 8,
  minCorrN: 8,
  minCorrR: 0.3,
  readinessWeights: {
    body_battery: 0.3,
    sleep: 0.3,
    hrv: 0.25,
    resting_heart_rate: 0.15
  },
  correlationPairs: [
    { a: "sleep", b: "hrv", lag: 0 },
    { a: "sleep", b: "resting_heart_rate", lag: 0 },
    { a: "stress", b: "body_battery", lag: 0 },
    { a: "steps", b: "sleep", lag: 0 }
  ]
};
function round(n, decimals = 0) {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
function round2(n) {
  return round(n, 2);
}
function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}
function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
function sampleStd(values) {
  const n = values.length;
  if (n < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}
function pearson(xs, ys) {
  const n = xs.length;
  if (n === 0 || ys.length !== n) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let num2 = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num2 += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num2 / den;
}
function toDayNumber2(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m > 2 ? m - 3 : m + 9) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function nonNull(days) {
  return days.filter((d) => d.value !== null);
}
function computeReadiness(series, config) {
  const byKey = new Map(series.map((s) => [s.spec.key, s]));
  const contributors = [];
  for (const [key2, weight] of Object.entries(config.readinessWeights)) {
    const entry = byKey.get(key2);
    if (!entry) continue;
    const present = nonNull(entry.days);
    if (present.length < config.minBaselineDays) continue;
    const values = present.map((p) => p.value);
    const baseline = mean(values);
    const std = sampleStd(values);
    const latest = values[values.length - 1];
    const rawZ = std === 0 ? 0 : (latest - baseline) / std;
    const orientedZ = entry.spec.goodWhen === "down" ? -rawZ : rawZ;
    const subscore = clamp(50 + 15 * clamp(orientedZ, -3, 3), 0, 100);
    contributors.push({
      key: key2,
      label: entry.spec.label,
      accent: entry.spec.accent,
      weight,
      subscore,
      rawZ,
      direction: rawZ >= 0 ? "up" : "down",
      basis: present.length
    });
  }
  if (contributors.length < 2) return null;
  const totalWeight = contributors.reduce((sum, c) => sum + c.weight, 0);
  const score = round(contributors.reduce((sum, c) => sum + c.subscore * c.weight, 0) / totalWeight);
  const drivers = contributors.map((c) => ({
    key: c.key,
    label: c.label,
    accent: c.accent,
    z: round2(c.rawZ),
    direction: c.direction,
    contribution: round(c.subscore * (c.weight / totalWeight))
  }));
  const basisDays = Math.min(...contributors.map((c) => c.basis));
  return { score, band: bandFor(score), drivers, basisDays };
}
function bandFor(score) {
  if (score < 40) return "low";
  if (score < 60) return "moderate";
  if (score < 80) return "high";
  return "peak";
}
function computeTrends(series, config) {
  const trends = [];
  for (const { spec, days } of series) {
    const present = nonNull(days);
    if (present.length < 4) continue;
    const n = present.length;
    const recentCount = Math.ceil(n / 2);
    const recentValues = present.slice(n - recentCount).map((p) => p.value);
    const earlierValues = present.slice(0, n - recentCount).map((p) => p.value);
    const recentAvg = mean(recentValues);
    const earlierAvg = mean(earlierValues);
    const signedMove = recentAvg - earlierAvg;
    const magnitudePct = earlierAvg === 0 ? null : round2(signedMove / Math.abs(earlierAvg) * 100);
    let direction;
    if (magnitudePct === null || Math.abs(magnitudePct) < config.stablePct) {
      direction = "stable";
    } else {
      const improving = spec.goodWhen === "up" ? signedMove > 0 : signedMove < 0;
      direction = improving ? "improving" : "declining";
    }
    trends.push({
      key: spec.key,
      label: spec.label,
      accent: spec.accent,
      unit: spec.unit,
      format: spec.format,
      direction,
      magnitudePct,
      recentAvg: round2(recentAvg),
      earlierAvg: round2(earlierAvg)
    });
  }
  return trends;
}
function computeAnomalies(series, config) {
  const found = [];
  for (const { spec, days } of series) {
    const present = nonNull(days);
    if (present.length < 2) continue;
    const values = present.map((p) => p.value);
    const baseline = mean(values);
    const std = sampleStd(values);
    if (std === 0) continue;
    for (const p of present) {
      const z6 = (p.value - baseline) / std;
      if (Math.abs(z6) < config.anomalyZ) continue;
      found.push({
        key: spec.key,
        label: spec.label,
        accent: spec.accent,
        date: p.date,
        value: p.value,
        z: round2(z6),
        direction: z6 > 0 ? "up" : "down",
        severity: Math.abs(z6) >= 3 ? "strong" : "moderate"
      });
    }
  }
  found.sort((a, b) => {
    const byZ = Math.abs(b.z) - Math.abs(a.z);
    if (byZ !== 0) return byZ;
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });
  return found.slice(0, config.maxAnomalies);
}
function strengthFor(absR) {
  if (absR >= 0.7) return "strong";
  if (absR >= 0.5) return "moderate";
  return "weak";
}
function phraseCorrelation(aLabel, bLabel, r) {
  const dir = r >= 0 ? "wy\u017Cszym" : "ni\u017Cszym";
  return `Wi\u0119cej \u201E${aLabel}\u201D zwykle wi\u0105\u017Ce si\u0119 z ${dir} \u201E${bLabel}\u201D.`;
}
function computeCorrelations(series, config) {
  const byKey = new Map(series.map((s) => [s.spec.key, s]));
  const out = [];
  for (const pair of config.correlationPairs) {
    const aEntry = byKey.get(pair.a);
    const bEntry = byKey.get(pair.b);
    if (!aEntry || !bEntry) continue;
    const bByDay = /* @__PURE__ */ new Map();
    for (const p of nonNull(bEntry.days)) bByDay.set(toDayNumber2(p.date), p.value);
    const xs = [];
    const ys = [];
    for (const p of nonNull(aEntry.days)) {
      const partner = bByDay.get(toDayNumber2(p.date) - pair.lag);
      if (partner === void 0) continue;
      xs.push(p.value);
      ys.push(partner);
    }
    const n = xs.length;
    if (n < config.minCorrN) continue;
    const r = round2(pearson(xs, ys));
    if (Math.abs(r) < config.minCorrR) continue;
    out.push({
      a: pair.a,
      b: pair.b,
      aLabel: aEntry.spec.label,
      bLabel: bEntry.spec.label,
      lag: pair.lag,
      r,
      n,
      strength: strengthFor(Math.abs(r)),
      phrasing: phraseCorrelation(aEntry.spec.label, bEntry.spec.label, r)
    });
  }
  return out;
}
function computeInsights(series, config = DEFAULT_INSIGHTS_CONFIG) {
  return {
    readiness: computeReadiness(series, config),
    trends: computeTrends(series, config),
    anomalies: computeAnomalies(series, config),
    correlations: computeCorrelations(series, config)
  };
}

// src/lib/mcp/tools.ts
var dateArg = z2.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD").optional();
var dateReq = z2.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
var metricArg = z2.enum(GARMIN_METRICS);
var windowArg = z2.number().int().optional();
var DEFAULT_TOOL_CONTEXT = { clock: systemClock, timeZone: DEFAULT_TIME_ZONE };
function text(value) {
  const body = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text", text: body }] };
}
function errorText(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}
function garminErrorResult(err) {
  if (err instanceof GarminNotAuthenticatedError) {
    return errorText("Garmin account is not connected. Open the web app and complete Garmin setup first.");
  }
  if (err instanceof GarminUnavailableError) {
    return errorText("The Garmin service is temporarily unavailable. Try again shortly.");
  }
  throw err;
}
async function safeMetric(garmin, name, date) {
  try {
    return text(await garmin.getMetric(name, date));
  } catch (err) {
    return garminErrorResult(err);
  }
}
function metricTool(name, description) {
  return {
    name: `get_${name}`,
    description,
    inputShape: { date: dateArg },
    handler: (garmin, args) => safeMetric(garmin, name, args.date)
  };
}
var SNAPSHOT_METRICS = ["sleep", "steps", "body_battery", "hrv", "resting_heart_rate"];
var INSIGHT_WINDOWS = [7, 30, 90, 365];
function clampWindow(window) {
  if (window === void 0 || !Number.isFinite(window)) return 30;
  return INSIGHT_WINDOWS.reduce((best, v) => Math.abs(v - window) < Math.abs(best - window) ? v : best, 30);
}
async function insightsForWindow(garmin, windowArgValue, ctx) {
  const window = clampWindow(windowArgValue);
  const end = todayKey(ctx.clock, ctx.timeZone);
  const start = addDays(end, -(window - 1));
  const series = await Promise.all(
    METRICS.map(async (spec) => {
      const days = await fetchMetricRangeChunked(garmin, spec.key, start, end);
      const points = days.map((d) => ({ date: d.date, value: extractMetricValue(spec, d.data) }));
      return { spec, days: points };
    })
  );
  return { window, start, end, series, ...computeInsights(series, DEFAULT_INSIGHTS_CONFIG) };
}
function chartSummaries(series) {
  return series.map(({ spec, days }) => {
    const values = days.map((d) => d.value).filter((v) => v !== null);
    const n = values.length;
    const avg = n ? Math.round(values.reduce((a, b) => a + b, 0) / n * 100) / 100 : null;
    return {
      key: spec.key,
      label: spec.label,
      unit: spec.unit,
      n,
      latest: n ? values[n - 1] : null,
      min: n ? Math.min(...values) : null,
      max: n ? Math.max(...values) : null,
      avg
    };
  });
}
function interpretHealthMessages(window) {
  const parsed = window === void 0 ? void 0 : Number(window);
  const w = clampWindow(Number.isFinite(parsed) ? parsed : void 0);
  return [
    {
      role: "user",
      content: {
        type: "text",
        text: `Give me a short wellness briefing for the last ${w} days.

Call the \`get_readiness\` and \`get_insights\` tools with window=${w}. Then, in a few friendly sentences of plain language, cover: the readiness score and band, the single most notable trend, any anomaly worth mentioning, and one interesting correlation. Be encouraging and concrete, avoid jargon, and do not invent numbers the tools did not return. These are consumer wellness metrics from a Garmin wearable \u2014 not medical data \u2014 so do not diagnose or give medical advice; suggest seeing a professional for any health concern.`
      }
    }
  ];
}
var insightsTools = [
  {
    name: "get_readiness",
    description: "A compact readiness snapshot (0\u2013100 score, band, and per-driver contributions from body battery, sleep, HRV and resting heart rate) computed over a rolling window (default 30 days). Consumer wellness signal \u2014 not medical advice.",
    inputShape: { window: windowArg },
    handler: async (garmin, args, ctx = DEFAULT_TOOL_CONTEXT) => {
      try {
        const { readiness } = await insightsForWindow(garmin, args.window, ctx);
        return text(readiness ?? { status: "insufficient_data" });
      } catch (err) {
        return garminErrorResult(err);
      }
    }
  },
  {
    name: "get_insights",
    description: "Full deterministic insights for a window (default 30 days): readiness, per-metric trends, anomaly flags, and notable correlations. Per-metric charts are returned as compact summaries (count/latest/min/max/avg) rather than full day arrays. Consumer wellness signal \u2014 not medical advice.",
    inputShape: { window: windowArg },
    handler: async (garmin, args, ctx = DEFAULT_TOOL_CONTEXT) => {
      try {
        const { window, start, end, series, readiness, trends, anomalies, correlations } = await insightsForWindow(garmin, args.window, ctx);
        return text({
          window,
          start,
          end,
          readiness,
          trends,
          anomalies,
          correlations,
          charts: chartSummaries(series)
        });
      } catch (err) {
        return garminErrorResult(err);
      }
    }
  }
];
var GARMIN_TOOLS = [
  {
    name: "get_status",
    description: "Whether the Garmin account is connected, and the display name if known.",
    inputShape: {},
    handler: async (garmin) => text(await garmin.getStatus())
  },
  {
    name: "get_health_snapshot",
    description: "A combined daily overview: sleep, steps, body battery, HRV and resting heart rate for a date.",
    inputShape: { date: dateArg },
    handler: async (garmin, args) => {
      try {
        const entries = await Promise.all(
          SNAPSHOT_METRICS.map(async (m) => [m, await garmin.getMetric(m, args.date)])
        );
        return text({ date: args.date ?? "today", ...Object.fromEntries(entries) });
      } catch (err) {
        return garminErrorResult(err);
      }
    }
  },
  {
    name: "get_metric_range",
    description: "Fetch one metric across an inclusive date range (YYYY-MM-DD, max 31 days) \u2014 use for weekly or monthly trends. Returns { metric, start, end, days:[{date, data}] }; a day is null if unavailable.",
    inputShape: { metric: metricArg, start: dateReq, end: dateReq },
    handler: async (garmin, args) => {
      try {
        return text(await garmin.getMetricRange(args.metric, args.start, args.end));
      } catch (err) {
        return garminErrorResult(err);
      }
    }
  },
  metricTool("sleep", "Sleep summary for a date (stages, duration, score)."),
  metricTool("steps", "Step count and distance for a date."),
  metricTool("body_battery", "Body Battery energy levels for a date."),
  metricTool("hrv", "Heart-rate variability status for a date."),
  metricTool("stress", "Stress levels for a date."),
  metricTool("resting_heart_rate", "Resting heart rate for a date."),
  metricTool("activities", "Recorded activities for a date."),
  metricTool("spo2", "Blood oxygen saturation (SpO2) for a date."),
  metricTool("respiration", "Respiration rate for a date."),
  metricTool("calories", "Calories burned (total, active, BMR) for a date."),
  metricTool("body_composition", "Body composition (weight, body fat, muscle mass) for a date."),
  metricTool(
    "training_readiness",
    "Garmin's own Training Readiness for a date: score 0\u2013100, level, per-factor percentages, and recovery time in hours. Distinct from get_readiness, which is this app's own composite."
  ),
  ...insightsTools
];

// src/lib/mcp/workout-tools.ts
import { z as z3 } from "zod";

// src/lib/workouts.ts
var WORKOUT_STEP_KINDS = [
  "warmup",
  "work",
  "recovery",
  "rest",
  "cooldown",
  "repeat"
];
var WORKOUT_DURATION_TYPES = ["time", "distance", "lap", "calories"];
var WORKOUT_TARGET_TYPES = [
  "none",
  "pace",
  "speed",
  "power",
  "hr",
  "cadence"
];
var WORKOUT_TARGET_UNITS = {
  none: "",
  pace: "s_per_km",
  speed: "kph",
  power: "w",
  hr: "bpm",
  cadence: "rpm"
};
var WORKOUT_TARGETS_BY_GROUP = {
  run: ["none", "pace", "speed", "hr", "cadence"],
  ride: ["none", "power", "speed", "hr", "cadence"],
  swim: ["none", "pace", "hr"],
  walk: ["none", "pace", "speed", "hr"],
  strength: ["none", "hr"],
  other: ["none", "hr"]
};
var WORKOUT_LIMITS = {
  maxTitle: 80,
  maxNote: 512,
  maxSteps: 50,
  maxChildSteps: 40,
  maxRepeats: 50,
  /** 24 h in seconds / 500 km in metres — anything past this is a typo, not a session. */
  maxDurationS: 86400,
  maxDistanceM: 5e5,
  maxCalories: 1e4
};
var WorkoutValidationError = class extends Error {
};
function normalizeWorkout(input) {
  const sport = (input.sport ?? "").trim();
  if (!sportMeta(sport)) {
    throw new WorkoutValidationError(
      `unknown sport '${sport}' \u2014 use a Garmin type key such as running, cycling, walking`
    );
  }
  const title = (input.title ?? "").trim();
  if (!title) throw new WorkoutValidationError("title is required");
  if (title.length > WORKOUT_LIMITS.maxTitle) {
    throw new WorkoutValidationError(`title is longer than ${WORKOUT_LIMITS.maxTitle} characters`);
  }
  const steps = input.steps ?? [];
  if (steps.length === 0) throw new WorkoutValidationError("a workout needs at least one step");
  if (steps.length > WORKOUT_LIMITS.maxSteps) {
    throw new WorkoutValidationError(`a workout cannot have more than ${WORKOUT_LIMITS.maxSteps} steps`);
  }
  const group = sportGroup(sport);
  return {
    sport,
    title,
    steps: steps.map((step) => normalizeStep(step, group, 0)),
    note: cleanNote(input.note)
  };
}
function normalizeStep(step, group, depth) {
  if (!step || typeof step !== "object") throw new WorkoutValidationError("each step must be an object");
  const kind = step.kind;
  if (!WORKOUT_STEP_KINDS.includes(kind)) {
    throw new WorkoutValidationError(`unknown step kind '${kind}' \u2014 use ${WORKOUT_STEP_KINDS.join(", ")}`);
  }
  if (kind === "repeat") return normalizeRepeat(step, group, depth);
  const durationType = step.durationType ?? "lap";
  if (!WORKOUT_DURATION_TYPES.includes(durationType)) {
    throw new WorkoutValidationError(
      `unknown duration type '${durationType}' \u2014 use ${WORKOUT_DURATION_TYPES.join(", ")}`
    );
  }
  let durationValue = null;
  if (durationType !== "lap") {
    const value = numberOrNull(step.durationValue);
    if (value === null || value <= 0) {
      throw new WorkoutValidationError(`a ${durationType} step needs a positive durationValue`);
    }
    const max = durationType === "time" ? WORKOUT_LIMITS.maxDurationS : durationType === "distance" ? WORKOUT_LIMITS.maxDistanceM : WORKOUT_LIMITS.maxCalories;
    if (value > max) {
      throw new WorkoutValidationError(`${durationType} step value ${value} is beyond the ${max} limit`);
    }
    durationValue = value;
  }
  return {
    kind,
    durationType,
    durationValue,
    target: normalizeTarget(step.target, group),
    repeats: null,
    steps: null,
    note: cleanNote(step.note)
  };
}
function normalizeRepeat(step, group, depth) {
  if (depth > 0) {
    throw new WorkoutValidationError("repeat blocks cannot be nested");
  }
  const repeats = numberOrNull(step.repeats);
  if (repeats === null || !Number.isInteger(repeats) || repeats < 1) {
    throw new WorkoutValidationError('a repeat block needs a positive whole "repeats"');
  }
  if (repeats > WORKOUT_LIMITS.maxRepeats) {
    throw new WorkoutValidationError(
      `a repeat block cannot repeat more than ${WORKOUT_LIMITS.maxRepeats} times`
    );
  }
  const children = step.steps ?? [];
  if (children.length === 0) {
    throw new WorkoutValidationError("a repeat block needs at least one child step");
  }
  if (children.length > WORKOUT_LIMITS.maxChildSteps) {
    throw new WorkoutValidationError(
      `a repeat block cannot hold more than ${WORKOUT_LIMITS.maxChildSteps} steps`
    );
  }
  return {
    kind: "repeat",
    durationType: null,
    durationValue: null,
    target: null,
    repeats,
    steps: children.map((child) => normalizeStep(child, group, depth + 1)),
    note: cleanNote(step.note)
  };
}
function normalizeTarget(target, group) {
  if (!target) return null;
  const type = target.type ?? "none";
  if (!WORKOUT_TARGET_TYPES.includes(type)) {
    throw new WorkoutValidationError(
      `unknown target type '${type}' \u2014 use ${WORKOUT_TARGET_TYPES.join(", ")}`
    );
  }
  if (type === "none") return null;
  const allowed = WORKOUT_TARGETS_BY_GROUP[group];
  if (!allowed.includes(type)) {
    throw new WorkoutValidationError(
      `target '${type}' does not apply to this sport \u2014 allowed: ${allowed.filter((t) => t !== "none").join(", ")}`
    );
  }
  const low = positiveOrNull(target.low);
  const high = positiveOrNull(target.high);
  if (low === null && high === null) {
    throw new WorkoutValidationError(
      `target '${type}' needs a low and/or high value in ${WORKOUT_TARGET_UNITS[type]}`
    );
  }
  if (low !== null && high !== null && low > high) {
    throw new WorkoutValidationError(`target '${type}' has low above high`);
  }
  return { type, low, high };
}
function cleanNote(note) {
  if (typeof note !== "string") return null;
  const text4 = note.trim();
  if (!text4) return null;
  if (text4.length > WORKOUT_LIMITS.maxNote) {
    throw new WorkoutValidationError(`a note is longer than ${WORKOUT_LIMITS.maxNote} characters`);
  }
  return text4;
}
function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function positiveOrNull(value) {
  const number = numberOrNull(value);
  return number !== null && number > 0 ? number : null;
}
function countWorkoutSteps(steps) {
  return steps.reduce((total, step) => total + 1 + (step.steps?.length ?? 0), 0);
}
function estimateWorkoutDurationS(steps) {
  let total = 0;
  let known = false;
  for (const step of steps) {
    if (step.kind === "repeat") {
      const inner2 = estimateWorkoutDurationS(step.steps ?? []);
      if (inner2 !== null) {
        total += inner2 * (step.repeats ?? 1);
        known = true;
      }
      continue;
    }
    if (step.durationType === "time" && step.durationValue) {
      total += step.durationValue;
      known = true;
      continue;
    }
    if (step.durationType === "distance" && step.durationValue && step.target) {
      const speed = targetSpeedMs(step.target);
      if (speed) {
        total += step.durationValue / speed;
        known = true;
      }
    }
  }
  return known ? Math.round(total) : null;
}
function estimateWorkoutDistanceM(steps) {
  let total = 0;
  let known = false;
  for (const step of steps) {
    if (step.kind === "repeat") {
      const inner2 = estimateWorkoutDistanceM(step.steps ?? []);
      if (inner2 !== null) {
        total += inner2 * (step.repeats ?? 1);
        known = true;
      }
      continue;
    }
    if (step.durationType === "distance" && step.durationValue) {
      total += step.durationValue;
      known = true;
    }
  }
  return known ? Math.round(total) : null;
}
function targetSpeedMs(target) {
  const values = [target.low, target.high].filter((v) => typeof v === "number" && v > 0);
  if (values.length === 0) return null;
  const mid = values.reduce((a, b) => a + b, 0) / values.length;
  if (target.type === "pace") return 1e3 / mid;
  if (target.type === "speed") return mid / 3.6;
  return null;
}

// src/lib/workout-presets.ts
var WORKOUT_PRESETS = [
  "intervals",
  "tempo",
  "long",
  "easy",
  "ftp_test"
];
function buildWorkoutPreset(preset, options) {
  const group = sportGroup(options.sport);
  const target = presetTarget(options);
  const warmupS = options.warmupS ?? 600;
  const cooldownS = options.cooldownS ?? 600;
  switch (preset) {
    case "intervals": {
      const repeats = options.repeats ?? 5;
      const work = workStep(options, target, "intervals");
      const recoveryS = options.recoveryS ?? Math.min(work.durationValue ?? 120, 180);
      return {
        title: `Interwa\u0142y ${repeats}\xD7${describeWork(work)}`,
        steps: [
          ...maybeStep("warmup", warmupS),
          {
            kind: "repeat",
            durationType: null,
            durationValue: null,
            target: null,
            repeats,
            steps: [work, timeStep("recovery", recoveryS)],
            note: null
          },
          ...maybeStep("cooldown", cooldownS)
        ]
      };
    }
    case "tempo": {
      const work = workStep({ ...options, workS: options.workS ?? 1200 }, target, "tempo");
      return {
        title: `Tempo ${describeWork(work)}`,
        steps: [...maybeStep("warmup", warmupS), work, ...maybeStep("cooldown", cooldownS)]
      };
    }
    case "long": {
      const work = workStep({ ...options, workS: options.workS ?? 5400 }, target, "long");
      return { title: `D\u0142ugi ${describeWork(work)}`, steps: [work] };
    }
    case "easy": {
      const work = workStep({ ...options, workS: options.workS ?? 2700 }, target, "easy");
      return { title: `Spokojnie ${describeWork(work)}`, steps: [work] };
    }
    case "ftp_test": {
      if (group !== "ride" && group !== "run") {
        throw new WorkoutValidationError("the ftp_test preset only applies to a ride or a run");
      }
      const work = workStep({ ...options, workS: options.workS ?? 1200, workM: null }, target, "ftp_test");
      return {
        title: group === "ride" ? `Test FTP ${describeWork(work)}` : `Test progu ${describeWork(work)}`,
        steps: [...maybeStep("warmup", options.warmupS ?? 900), work, ...maybeStep("cooldown", cooldownS)]
      };
    }
    default: {
      const exhaustive = preset;
      throw new WorkoutValidationError(`unknown preset '${String(exhaustive)}'`);
    }
  }
}
function presetTarget(options) {
  const type = options.targetType ?? null;
  const low = options.targetLow ?? null;
  const high = options.targetHigh ?? null;
  if (!type || type === "none") {
    if (low !== null || high !== null) {
      throw new WorkoutValidationError("target values need a targetType (pace, power, hr, \u2026)");
    }
    return null;
  }
  if (low === null && high === null) {
    throw new WorkoutValidationError(`targetType '${type}' needs targetLow and/or targetHigh`);
  }
  return { type, low, high };
}
function workStep(options, target, preset) {
  const metres = options.workM ?? null;
  if (metres !== null) {
    return {
      kind: "work",
      durationType: "distance",
      durationValue: metres,
      target,
      repeats: null,
      steps: null,
      note: null
    };
  }
  const seconds = options.workS ?? null;
  if (seconds === null) {
    throw new WorkoutValidationError(`the ${preset} preset needs workS (seconds) or workM (metres)`);
  }
  return {
    kind: "work",
    durationType: "time",
    durationValue: seconds,
    target,
    repeats: null,
    steps: null,
    note: null
  };
}
function timeStep(kind, seconds) {
  return {
    kind,
    durationType: "time",
    durationValue: seconds,
    target: null,
    repeats: null,
    steps: null,
    note: null
  };
}
function maybeStep(kind, seconds) {
  return seconds > 0 ? [timeStep(kind, seconds)] : [];
}
function describeWork(step) {
  if (step.durationType === "distance" && step.durationValue) {
    const metres = step.durationValue;
    return metres >= 1e3 ? `${trimNumber(metres / 1e3)} km` : `${trimNumber(metres)} m`;
  }
  const seconds = step.durationValue ?? 0;
  if (seconds >= 3600 && seconds % 3600 === 0) return `${seconds / 3600} h`;
  if (seconds >= 60) return `${trimNumber(seconds / 60)} min`;
  return `${trimNumber(seconds)} s`;
}
function trimNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

// src/lib/mcp/workout-tools.ts
function text2(value) {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }]
  };
}
function errorText2(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}
var dayArg = z3.string().regex(/^\d{4}-\d{2}-\d{2}$/, "day must be YYYY-MM-DD");
var timeArg = z3.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time must be HH:MM").nullish();
var stepArg = z3.lazy(
  () => z3.object({
    kind: z3.enum(WORKOUT_STEP_KINDS),
    durationType: z3.enum(WORKOUT_DURATION_TYPES).nullish(),
    durationValue: z3.number().positive().nullish(),
    target: z3.object({
      type: z3.enum(WORKOUT_TARGET_TYPES),
      low: z3.number().positive().nullish(),
      high: z3.number().positive().nullish()
    }).nullish(),
    repeats: z3.number().int().min(1).max(WORKOUT_LIMITS.maxRepeats).nullish(),
    steps: z3.array(stepArg).max(WORKOUT_LIMITS.maxChildSteps).nullish(),
    note: z3.string().max(WORKOUT_LIMITS.maxNote).nullish()
  })
);
var UNITS = Object.entries(WORKOUT_TARGET_UNITS).filter(([type]) => type !== "none").map(([type, unit]) => `${type}=${unit}`).join(", ");
async function requireConsent(deps) {
  const enabled = await deps.consent.isEnabled(WORKOUT_WRITE_FEATURE);
  if (enabled) return null;
  return errorText2(
    'Writing workouts to Garmin is not enabled for this account. Open the web app \u2192 Ustawienia and accept "Zapis trening\xF3w w Garminie" first. Reading data is unaffected.'
  );
}
function view(workout) {
  return {
    id: workout.id,
    day: workout.day,
    time: workout.time,
    sport: workout.sport,
    sportLabel: sportLabel(workout.sport),
    title: workout.title,
    stepCount: countWorkoutSteps(workout.steps),
    estimatedDurationS: estimateWorkoutDurationS(workout.steps),
    estimatedDistanceM: estimateWorkoutDistanceM(workout.steps),
    pushState: workout.pushState,
    ...workout.pushError ? { pushError: workout.pushError } : {},
    ...workout.garminWorkoutId ? { garminWorkoutId: workout.garminWorkoutId } : {}
  };
}
function pushHint(workout) {
  switch (workout.pushState) {
    case "pushed":
      return "W Garminie (kalendarz + zegarek).";
    case "failed":
      return "Zapisane lokalnie; ostatnia wysy\u0142ka do Garmina nie powiod\u0142a si\u0119 \u2014 kolejna synchronizacja spr\xF3buje ponownie.";
    case "unsupported":
      return "Zapisane lokalnie; Garmin nie przyjmie tego treningu (patrz pushError).";
    default:
      return "Zapisane lokalnie; nast\u0119pna synchronizacja wy\u015Ble je do Garmina.";
  }
}
function stepsFrom(args, sport) {
  const preset = args.preset;
  const explicit = args.steps;
  if (preset && explicit) {
    throw new WorkoutValidationError("pass either steps or preset, not both");
  }
  if (preset) {
    if (!WORKOUT_PRESETS.includes(preset)) {
      throw new WorkoutValidationError(`unknown preset '${preset}' \u2014 use ${WORKOUT_PRESETS.join(", ")}`);
    }
    const options = {
      sport,
      repeats: args.repeats ?? null,
      workS: args.workS ?? null,
      workM: args.workM ?? null,
      recoveryS: args.recoveryS ?? null,
      warmupS: args.warmupS ?? null,
      cooldownS: args.cooldownS ?? null,
      targetType: args.targetType ?? null,
      targetLow: args.targetLow ?? null,
      targetHigh: args.targetHigh ?? null
    };
    const built = buildWorkoutPreset(preset, options);
    return { title: built.title, steps: built.steps };
  }
  if (!explicit || explicit.length === 0) {
    throw new WorkoutValidationError("pass steps (a step list) or preset");
  }
  return { steps: explicit };
}
var createWorkoutTool = {
  name: "create_workout",
  description: "Create a structured training session (any sport: running, cycling, walking, swimming, strength) for a given day. Saved locally first, then pushed to the Garmin calendar by the next sync \u2014 so it reaches the watch. Pass an explicit `steps` tree, or a `preset` (" + WORKOUT_PRESETS.join(", ") + `) with its parameters. Steps: kind (warmup/work/recovery/rest/cooldown/repeat), durationType (time=seconds, distance=metres, lap, calories) + durationValue, and an optional target with low/high in canonical units (${UNITS}). A repeat step carries repeats + child steps. Targets are checked against the sport (no power target on a walk).`,
  inputShape: {
    sport: z3.string().min(1).describe("Garmin sport type key, e.g. running, cycling, walking"),
    day: dayArg,
    time: timeArg,
    title: z3.string().min(1).max(WORKOUT_LIMITS.maxTitle).nullish(),
    steps: z3.array(stepArg).max(WORKOUT_LIMITS.maxSteps).nullish(),
    preset: z3.enum(WORKOUT_PRESETS).nullish(),
    repeats: z3.number().int().min(1).max(WORKOUT_LIMITS.maxRepeats).nullish(),
    workS: z3.number().positive().nullish(),
    workM: z3.number().positive().nullish(),
    recoveryS: z3.number().positive().nullish(),
    warmupS: z3.number().min(0).nullish(),
    cooldownS: z3.number().min(0).nullish(),
    targetType: z3.enum(WORKOUT_TARGET_TYPES).nullish(),
    targetLow: z3.number().positive().nullish(),
    targetHigh: z3.number().positive().nullish(),
    note: z3.string().max(WORKOUT_LIMITS.maxNote).nullish()
  },
  async handler(deps, args) {
    const gate = await requireConsent(deps);
    if (gate) return gate;
    try {
      const sport = String(args.sport ?? "");
      const wantedTitle = String(args.title ?? "").trim();
      const fromLibrary = wantedTitle && !args.steps && !args.preset ? await deps.store.findWorkoutTemplateByTitle(deps.userId, sport, wantedTitle) : null;
      const built = fromLibrary ? { title: fromLibrary.title, steps: fromLibrary.steps } : stepsFrom(args, sport);
      const workout = normalizeWorkout({
        sport,
        title: String(args.title ?? built.title ?? ""),
        steps: built.steps,
        note: args.note ?? null
      });
      const day = String(args.day ?? "");
      const created = await deps.store.createWorkout(deps.userId, {
        // 12 bytes of CSPRNG from the injected Random — never Math.random, never a timestamp.
        id: `w_${deps.random.token(12)}`,
        day,
        time: args.time ?? null,
        sport: workout.sport,
        title: workout.title,
        steps: workout.steps,
        note: workout.note,
        createdAt: deps.clock.now().toISOString()
      });
      let libraryAction = fromLibrary ? "used" : "none";
      if (!fromLibrary) {
        try {
          const existing = await deps.store.findWorkoutTemplateByTitle(
            deps.userId,
            workout.sport,
            workout.title
          );
          if (!existing) {
            await deps.store.createWorkoutTemplate(deps.userId, {
              id: `wt_${deps.random.token(12)}`,
              sport: workout.sport,
              title: workout.title,
              steps: workout.steps,
              note: workout.note,
              createdAt: deps.clock.now().toISOString()
            });
            libraryAction = "added";
          }
        } catch {
        }
      }
      return text2({ ...view(created), library: libraryAction, next: pushHint(created) });
    } catch (err) {
      if (err instanceof WorkoutValidationError) return errorText2(err.message);
      throw err;
    }
  }
};
var listWorkoutTemplatesTool = {
  name: "list_workout_templates",
  description: "List the athlete REUSABLE workout library \u2014 sessions saved without a date, which can be scheduled onto any day. Use this before composing a new session: if one of these matches what the athlete asked for, schedule it by passing its exact title to create_workout with no steps and no preset, and the stored step tree is reused verbatim.",
  inputShape: {},
  async handler(deps) {
    const templates = await deps.store.listWorkoutTemplates(deps.userId);
    return text2({
      count: templates.length,
      templates: templates.map((t) => ({
        title: t.title,
        sport: t.sport,
        sportLabel: sportLabel(t.sport),
        steps: countWorkoutSteps(t.steps),
        estimatedDurationS: estimateWorkoutDurationS(t.steps),
        estimatedDistanceM: estimateWorkoutDistanceM(t.steps),
        note: t.note
      }))
    });
  }
};
var listWorkoutsTool = {
  name: "list_workouts",
  description: "List training sessions authored here, with their push state (pending = not on Garmin yet, pushed = in the Garmin calendar, failed = will retry, unsupported = Garmin will not take it). Defaults to today onwards. Does NOT list plans that came FROM Garmin \u2014 those are in the timeline.",
  inputShape: {
    from: dayArg.nullish(),
    to: dayArg.nullish(),
    pushState: z3.enum(["pending", "pushed", "failed", "unsupported"]).nullish()
  },
  async handler(deps, args) {
    const from = args.from ?? todayKey(deps.clock, deps.timeZone);
    const workouts = await deps.store.listWorkouts(deps.userId, {
      from,
      ...args.to ? { to: String(args.to) } : {},
      ...args.pushState ? { pushState: args.pushState } : {},
      limit: 100
    });
    return text2({ from, count: workouts.length, workouts: workouts.map(view) });
  }
};
var updateWorkoutTool = {
  name: "update_workout",
  description: "Change an authored session (day, time, title, note, or the whole step tree). Any change resets the push state so the next sync re-sends it to Garmin. Only fields you pass are changed.",
  inputShape: {
    id: z3.string().min(1),
    day: dayArg.nullish(),
    time: timeArg,
    title: z3.string().min(1).max(WORKOUT_LIMITS.maxTitle).nullish(),
    sport: z3.string().min(1).nullish(),
    steps: z3.array(stepArg).max(WORKOUT_LIMITS.maxSteps).nullish(),
    note: z3.string().max(WORKOUT_LIMITS.maxNote).nullish()
  },
  async handler(deps, args) {
    const gate = await requireConsent(deps);
    if (gate) return gate;
    const id = String(args.id ?? "");
    const current = await deps.store.getWorkout(deps.userId, id);
    if (!current) return errorText2(`No authored workout with id '${id}'.`);
    try {
      const sport = args.sport ?? current.sport;
      if (args.sport !== void 0 && args.sport !== null && !sportMeta(sport)) {
        return errorText2(`unknown sport '${sport}'`);
      }
      const validated = normalizeWorkout({
        sport,
        title: args.title ?? current.title,
        steps: args.steps ?? current.steps,
        note: args.note !== void 0 ? args.note ?? null : current.note
      });
      const updated = await deps.store.updateWorkout(deps.userId, id, {
        ...args.day !== void 0 && args.day !== null ? { day: String(args.day) } : {},
        ...args.time !== void 0 ? { time: args.time ?? null } : {},
        sport: validated.sport,
        title: validated.title,
        steps: validated.steps,
        note: validated.note,
        // Content changed, so whatever is in Garmin is now stale: queue a re-push. The existing
        // garminWorkoutId is kept, so the push phase updates rather than duplicating.
        pushState: "pending",
        pushError: null,
        updatedAt: deps.clock.now().toISOString()
      });
      if (!updated) return errorText2(`No authored workout with id '${id}'.`);
      return text2({ ...view(updated), next: pushHint(updated) });
    } catch (err) {
      if (err instanceof WorkoutValidationError) return errorText2(err.message);
      throw err;
    }
  }
};
var deleteWorkoutTool = {
  name: "delete_workout",
  description: "Delete an authored session. If it already reached Garmin it is removed there too, in the same call \u2014 the local row is kept (and the failure reported) if Garmin cannot be reached, so a session is never silently left on the watch.",
  inputShape: { id: z3.string().min(1) },
  async handler(deps, args) {
    const gate = await requireConsent(deps);
    if (gate) return gate;
    const id = String(args.id ?? "");
    const current = await deps.store.getWorkout(deps.userId, id);
    if (!current) return errorText2(`No authored workout with id '${id}'.`);
    if (!current.garminWorkoutId) {
      await deps.store.deleteWorkout(deps.userId, id);
      return text2({ id, deleted: true, upstreamRemoved: false });
    }
    if (!deps.garmin?.deleteWorkout) {
      return errorText2(
        `'${current.title}' is in Garmin (id ${current.garminWorkoutId}) and this connection cannot remove it. Delete it in Garmin Connect, or retry once the Garmin service is reachable.`
      );
    }
    try {
      const result = await deps.garmin.deleteWorkout(current.garminWorkoutId);
      if (!result.supported) {
        await deps.store.updateWorkout(deps.userId, id, {
          pushState: "failed",
          pushError: "nie uda\u0142o si\u0119 usun\u0105\u0107 treningu w Garminie",
          updatedAt: deps.clock.now().toISOString()
        });
        return errorText2(
          `Could not remove '${current.title}' from Garmin, so it was NOT deleted here either. Remove it in Garmin Connect, or try again later.`
        );
      }
      await deps.store.deleteWorkout(deps.userId, id);
      return text2({ id, deleted: true, upstreamRemoved: result.removed });
    } catch {
      await deps.store.updateWorkout(deps.userId, id, {
        pushState: "failed",
        pushError: "Garmin nie odpowiedzia\u0142 przy usuwaniu treningu",
        updatedAt: deps.clock.now().toISOString()
      });
      return errorText2(
        `Garmin did not respond, so '${current.title}' was NOT deleted (here or there). Try again shortly.`
      );
    }
  }
};
var WORKOUT_TOOLS = [
  createWorkoutTool,
  listWorkoutTemplatesTool,
  listWorkoutsTool,
  updateWorkoutTool,
  deleteWorkoutTool
];

// src/lib/mcp/season-tools.ts
import { z as z4 } from "zod";

// src/lib/server/tier.ts
var ADVANCED_FEATURE = "detailed_analytics";

// src/lib/server/analytics/training-load.ts
var DAY_MS = 864e5;
var NP_WINDOW = 30;
function ewma(values, days) {
  const alpha = 1 - Math.exp(-1 / days);
  const out = [];
  let prev = 0;
  for (const v of values) {
    prev = prev + alpha * (v - prev);
    out.push(prev);
  }
  return out;
}
function rollingAverage(samples, window) {
  if (window <= 1) return samples.slice();
  const out = [];
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i];
    if (i >= window) sum -= samples[i - window];
    const count = Math.min(i + 1, window);
    out.push(sum / count);
  }
  return out;
}
function normalizedPower(power) {
  const clean = power.filter((p) => Number.isFinite(p) && p >= 0);
  if (clean.length === 0) return null;
  const roll = rollingAverage(clean, Math.min(NP_WINDOW, clean.length));
  const meanFourth = roll.reduce((a, p) => a + p ** 4, 0) / roll.length;
  return meanFourth ** 0.25;
}
function powerTss(normPower, ftpWatts, durationS) {
  if (ftpWatts <= 0 || durationS <= 0) return 0;
  const intensity = normPower / ftpWatts;
  return intensity * intensity * (durationS / 3600) * 100;
}
function hrTrimp(durationS, avgHr, hrRest, hrMax) {
  if (durationS <= 0 || hrMax <= hrRest) return 0;
  const reserve = (avgHr - hrRest) / (hrMax - hrRest);
  if (reserve <= 0) return 0;
  const clamped = Math.min(reserve, 1);
  const minutes = durationS / 60;
  return minutes * clamped * 0.64 * Math.exp(1.92 * clamped);
}
function activityLoad(a, opts) {
  if (a.trainingLoad != null && a.trainingLoad > 0) return { tss: a.trainingLoad, method: "garmin" };
  const durationS = a.durationS ?? (a.power ? a.power.length : 0);
  if (opts.ftpWatts != null && opts.ftpWatts > 0 && a.power && a.power.length > 0) {
    const np = normalizedPower(a.power);
    if (np != null) return { tss: powerTss(np, opts.ftpWatts, durationS), method: "power" };
  }
  if (a.avgHr != null && a.avgHr > 0 && durationS > 0) {
    const hrRest = opts.hrRest ?? 60;
    const hrMax = opts.hrMax ?? a.maxHr ?? 190;
    const trimp = hrTrimp(durationS, a.avgHr, hrRest, hrMax);
    if (trimp > 0) return { tss: trimp, method: "hr" };
  }
  return { tss: 0, method: "none" };
}
function bandForTsb(tsb) {
  if (tsb > 25) return "fresh";
  if (tsb >= 5) return "optimal";
  if (tsb >= -10) return "neutral";
  if (tsb >= -30) return "fatigued";
  return "very-fatigued";
}
var RECOMMENDATIONS = {
  fresh: "Jeste\u015B wypocz\u0119ty \u2014 dobry moment na mocny trening lub start w zawodach.",
  optimal: "Forma optymalna \u2014 utrzymuj obecne obci\u0105\u017Cenie treningowe.",
  neutral: "R\xF3wnowaga mi\u0119dzy zm\u0119czeniem a form\u0105 \u2014 kontynuuj bie\u017C\u0105cy plan.",
  fatigued: "Wyra\u017Ane zm\u0119czenie \u2014 rozwa\u017C dzie\u0144 regeneracji lub l\u017Cejszy trening.",
  "very-fatigued": "Bardzo du\u017Ce zm\u0119czenie \u2014 zaplanuj odpoczynek, aby unikn\u0105\u0107 przetrenowania."
};
var NO_DATA_RECOMMENDATION = "Za ma\u0142o danych, aby oceni\u0107 form\u0119. Zsynchronizuj wi\u0119cej trening\xF3w z pomiarem mocy lub t\u0119tna.";
function addDays2(day, n) {
  const d = (/* @__PURE__ */ new Date(`${day}T00:00:00Z`)).getTime() + n * DAY_MS;
  return new Date(d).toISOString().slice(0, 10);
}
function daysBetween2(start, end) {
  return Math.round(
    ((/* @__PURE__ */ new Date(`${end}T00:00:00Z`)).getTime() - (/* @__PURE__ */ new Date(`${start}T00:00:00Z`)).getTime()) / DAY_MS
  );
}
function buildTrainingLoad(activities, opts) {
  const perDay = /* @__PURE__ */ new Map();
  let hasData = false;
  for (const a of activities) {
    const { tss } = activityLoad(a, opts);
    if (tss > 0) hasData = true;
    perDay.set(a.day, (perDay.get(a.day) ?? 0) + tss);
  }
  if (perDay.size === 0) {
    return {
      series: [],
      ctl: 0,
      atl: 0,
      tsb: 0,
      band: "neutral",
      recommendation: NO_DATA_RECOMMENDATION,
      hasData: false
    };
  }
  const days = [...perDay.keys()].sort();
  const startDay = days[0];
  const lastActivity = days[days.length - 1];
  const endDay = opts.endDay > lastActivity ? opts.endDay : lastActivity;
  const span = Math.max(0, daysBetween2(startDay, endDay));
  const dayList = [];
  const tssSeries = [];
  for (let i = 0; i <= span; i++) {
    const day = addDays2(startDay, i);
    dayList.push(day);
    tssSeries.push(perDay.get(day) ?? 0);
  }
  const ctl = ewma(tssSeries, 42);
  const atl = ewma(tssSeries, 7);
  const series = dayList.map((day, i) => ({
    day,
    tss: tssSeries[i],
    ctl: ctl[i],
    atl: atl[i],
    // TSB uses the PREVIOUS day's fitness/fatigue; day 0 seeds from 0.
    tsb: (i === 0 ? 0 : ctl[i - 1]) - (i === 0 ? 0 : atl[i - 1])
  }));
  const latest = series[series.length - 1];
  const band = bandForTsb(latest.tsb);
  return {
    series,
    ctl: latest.ctl,
    atl: latest.atl,
    tsb: latest.tsb,
    band,
    recommendation: hasData ? RECOMMENDATIONS[band] : NO_DATA_RECOMMENDATION,
    hasData
  };
}

// src/lib/server/analytics/power-profile.ts
var STANDARD_DURATIONS = [
  1,
  5,
  10,
  15,
  30,
  60,
  120,
  180,
  300,
  480,
  600,
  900,
  1200,
  1800,
  2700,
  3600,
  5400,
  7200
];
function bestAverageForDuration(power, durationS) {
  const n = power.length;
  if (durationS <= 0 || n < durationS) return null;
  const prefix = new Array(n + 1);
  prefix[0] = 0;
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + (Number.isFinite(power[i]) ? power[i] : 0);
  let best = -Infinity;
  for (let i = durationS; i <= n; i++) {
    const avg = (prefix[i] - prefix[i - durationS]) / durationS;
    if (avg > best) best = avg;
  }
  return best === -Infinity ? null : best;
}
var yearOf = (day) => Number(day.slice(0, 4));
var ROUND = (n) => Math.round(n);
function curveFor(activities, durations) {
  const points = [];
  for (const d of durations) {
    let best = -Infinity;
    for (const a of activities) {
      if (!a.power || a.power.length < d) continue;
      const avg = bestAverageForDuration(a.power, d);
      if (avg != null && avg > best) best = avg;
    }
    if (best > -Infinity) points.push({ durationS: d, watts: ROUND(best) });
  }
  return points;
}
var RIDER_AXES = [
  { key: "sprint", label: "Sprint (5 s)", durationS: 5 },
  { key: "punch", label: "Punch (1 min)", durationS: 60 },
  { key: "climb", label: "VO2/Podjazd (5 min)", durationS: 300 },
  { key: "tt", label: "Pr\xF3g/TT (20 min)", durationS: 1200 },
  { key: "endurance", label: "Wytrzyma\u0142o\u015B\u0107 (60 min)", durationS: 3600 }
];
function zonesFromFtp(ftp) {
  const spec = [
    { zone: 1, name: "Regeneracja", minPct: 0, maxPct: 0.55 },
    { zone: 2, name: "Wytrzyma\u0142o\u015B\u0107", minPct: 0.56, maxPct: 0.75 },
    { zone: 3, name: "Tempo", minPct: 0.76, maxPct: 0.9 },
    { zone: 4, name: "Pr\xF3g", minPct: 0.91, maxPct: 1.05 },
    { zone: 5, name: "VO2max", minPct: 1.06, maxPct: 1.2 },
    { zone: 6, name: "Anaerobowa", minPct: 1.21, maxPct: 1.5 },
    { zone: 7, name: "Neuromi\u0119\u015Bniowa", minPct: 1.51, maxPct: null }
  ];
  return spec.map((z6) => ({
    ...z6,
    minW: ROUND(z6.minPct * ftp),
    maxW: z6.maxPct == null ? null : ROUND(z6.maxPct * ftp)
  }));
}
function buildPowerProfile(activities, opts) {
  const durations = [...opts.durations ?? STANDARD_DURATIONS];
  const weightKg = opts.weightKg ?? null;
  const withPower = activities.filter(
    (a) => Array.isArray(a.power) && a.power.length > 0
  );
  const wkg = (w) => w != null && weightKg != null && weightKg > 0 ? Math.round(w / weightKg * 100) / 100 : null;
  if (withPower.length === 0) {
    return {
      hasPower: false,
      durations,
      bests: [],
      allTimeCurve: [],
      yearCurves: [],
      years: [],
      ftpWatts: opts.ftpOverride ?? null,
      ftpWattsPerKg: wkg(opts.ftpOverride ?? null),
      ftpSource: opts.ftpOverride != null ? "settings" : null,
      best20MinWatts: null,
      best60MinWatts: null,
      zones: opts.ftpOverride != null ? zonesFromFtp(opts.ftpOverride) : [],
      radar: [],
      weightKg
    };
  }
  const bests = [];
  for (const d of durations) {
    let bestW = -Infinity;
    let bestAct = null;
    for (const a of withPower) {
      const avg = bestAverageForDuration(a.power, d);
      if (avg != null && avg > bestW) {
        bestW = avg;
        bestAct = a;
      }
    }
    if (bestW > -Infinity && bestAct) {
      const watts = ROUND(bestW);
      bests.push({
        durationS: d,
        watts,
        wattsPerKg: wkg(watts),
        activityId: bestAct.activityId,
        day: bestAct.day
      });
    }
  }
  const allTimeCurve = bests.map((b) => ({ durationS: b.durationS, watts: b.watts }));
  const bestAt = (d) => bests.find((b) => b.durationS === d)?.watts ?? null;
  const best20MinWatts = bestAt(1200);
  const best60MinWatts = bestAt(3600);
  const ftpEstimate = best20MinWatts != null ? ROUND(0.95 * best20MinWatts) : null;
  const ftpWatts = opts.ftpOverride ?? ftpEstimate;
  const ftpSource = opts.ftpOverride != null ? "settings" : ftpEstimate != null ? "estimated" : null;
  const byYear = /* @__PURE__ */ new Map();
  for (const a of withPower) {
    const y = yearOf(a.day);
    const list = byYear.get(y);
    if (list) list.push(a);
    else byYear.set(y, [a]);
  }
  const years = [...byYear.keys()].sort((x, y) => y - x);
  const yearCurves = years.map((year) => ({
    year,
    activityCount: byYear.get(year).length,
    points: curveFor(byYear.get(year), durations)
  }));
  const radar = RIDER_AXES.map((axis) => {
    const watts = bestAt(axis.durationS) ?? 0;
    return { key: axis.key, label: axis.label, durationS: axis.durationS, watts, wattsPerKg: wkg(watts) };
  });
  return {
    hasPower: true,
    durations,
    bests,
    allTimeCurve,
    yearCurves,
    years,
    ftpWatts,
    ftpWattsPerKg: wkg(ftpWatts),
    ftpSource,
    best20MinWatts,
    best60MinWatts,
    zones: ftpWatts != null ? zonesFromFtp(ftpWatts) : [],
    radar,
    weightKg
  };
}

// src/lib/server/analytics/load-risk.ts
var MIN_HISTORY_DAYS = 28;
var ACWR_LOW = 0.8;
var ACWR_HIGH = 1.3;
var ACWR_VERY_HIGH = 1.5;
var RAMP_HIGH = 7;
var RAMP_LOW = -7;
var RAMP_WINDOW_DAYS = 14;
var ADVICE = {
  detraining: "Obci\u0105\u017Cenie spad\u0142o wyra\u017Anie poni\u017Cej tego, do czego jeste\u015B przygotowany. Je\u015Bli to nie zaplanowane roztrenowanie ani choroba, wr\xF3\u0107 do regularnych jednostek \u2014 forma tlenowa cofa si\u0119 szybciej, ni\u017C narasta.",
  steady: "Obci\u0105\u017Cenie ostatniego tygodnia mie\u015Bci si\u0119 w tym, do czego jeste\u015B przygotowany. To zakres, w kt\xF3rym mo\u017Cna bezpiecznie budowa\u0107.",
  building: "Budujesz form\u0119 w rozs\u0105dnym tempie \u2014 obci\u0105\u017Cenie ro\u015Bnie, ale nie ucieka bazie. Utrzymaj ten kierunek i pilnuj tygodni odci\u0105\u017Caj\u0105cych.",
  overreaching: "Ostatni tydzie\u0144 jest wyra\u017Anie mocniejszy od Twojej bazy. Jeden taki tydzie\u0144 to normalny bodziec; dwa lub trzy pod rz\u0105d to najcz\u0119stsza droga do kontuzji przeci\u0105\u017Ceniowej.",
  spike: "Skok obci\u0105\u017Cenia: ostatni tydzie\u0144 znacznie przewy\u017Csza to, do czego jeste\u015B przygotowany. Najbezpieczniejszy ruch to l\u017Cejszy tydzie\u0144, zanim wr\xF3ci normalny plan."
};
function bandFor2(acwr, rampPerWeek) {
  if (acwr >= ACWR_VERY_HIGH) return "spike";
  if (acwr > ACWR_HIGH) return "overreaching";
  if (acwr < ACWR_LOW) return rampPerWeek <= RAMP_LOW ? "detraining" : "steady";
  if (rampPerWeek > RAMP_HIGH) return "overreaching";
  if (rampPerWeek <= RAMP_LOW) return "detraining";
  return rampPerWeek > 0 ? "building" : "steady";
}
function loadRisk(series) {
  const historyDays = series.length;
  const last = series[historyDays - 1];
  if (!last || historyDays < MIN_HISTORY_DAYS || last.ctl <= 0) {
    return {
      acwr: null,
      rampRatePerWeek: null,
      band: "steady",
      advice: "Za ma\u0142o historii, aby oceni\u0107 tempo narastania obci\u0105\u017Cenia. Potrzebne s\u0105 oko\u0142o cztery tygodnie ci\u0105g\u0142ych danych \u2014 wcze\u015Bniej wska\u017Aniki liczone z niepe\u0142nej bazy tylko strasz\u0105.",
      historyDays
    };
  }
  const acwr = round22(last.atl / last.ctl);
  const backIndex = Math.max(0, historyDays - 1 - RAMP_WINDOW_DAYS);
  const back = series[backIndex];
  const spanDays = historyDays - 1 - backIndex;
  const rampRatePerWeek = back && spanDays > 0 ? round12((last.ctl - back.ctl) / spanDays * 7) : null;
  const band = bandFor2(acwr, rampRatePerWeek ?? 0);
  return { acwr, rampRatePerWeek, band, advice: ADVICE[band], historyDays };
}
function round12(v) {
  return Math.round(v * 10) / 10;
}
function round22(v) {
  return Math.round(v * 100) / 100;
}

// src/lib/server/analytics/running-profile.ts
var RUN_DISTANCES = [
  { key: "1k", label: "1 km", meters: 1e3 },
  { key: "5k", label: "5 km", meters: 5e3 },
  { key: "10k", label: "10 km", meters: 1e4 },
  { key: "half", label: "P\xF3\u0142maraton", meters: 21097.5 },
  { key: "marathon", label: "Maraton", meters: 42195 }
];
function personalBests(runs) {
  const out = [];
  for (const d of RUN_DISTANCES) {
    let best = null;
    for (const r of runs) {
      if (!r.distanceM || !r.durationS || r.distanceM < d.meters * 0.995) continue;
      const projected = r.durationS * (d.meters / r.distanceM);
      if (best === null || projected < best.timeS) {
        best = {
          key: d.key,
          label: d.label,
          meters: d.meters,
          timeS: projected,
          paceSecPerKm: projected / (d.meters / 1e3),
          activityId: r.activityId,
          day: r.day
        };
      }
    }
    if (best) out.push(best);
  }
  return out;
}

// src/lib/analytics/pace-model.ts
var CHEAPEST_GRADE_PCT = -10;
var VERTEX_COST = 5 / 6;
var CURVATURE = (1 - VERTEX_COST) / CHEAPEST_GRADE_PCT ** 2;
var CURVE_DURATIONS = [
  15,
  30,
  60,
  120,
  300,
  600,
  1200,
  1800,
  2700,
  3600,
  5400,
  7200
];
function speedDurationCurve(speed, sampleSeconds = 1, durations = CURVE_DURATIONS) {
  if (!speed || speed.length === 0 || !(sampleSeconds > 0)) return [];
  const prefix = new Array(speed.length + 1).fill(0);
  for (let i = 0; i < speed.length; i++) {
    const v = speed[i];
    prefix[i + 1] = (prefix[i] ?? 0) + (isNum(v) && v > 0 ? v : 0);
  }
  const out = [];
  for (const durationS of durations) {
    const window = Math.round(durationS / sampleSeconds);
    if (window < 1 || window > speed.length) continue;
    let best = 0;
    for (let i = 0; i + window <= speed.length; i++) {
      const mean2 = ((prefix[i + window] ?? 0) - (prefix[i] ?? 0)) / window;
      if (mean2 > best) best = mean2;
    }
    if (best <= 0) continue;
    out.push({
      durationS,
      speedMps: round3(best),
      paceSecPerKm: Math.round(1e3 / best)
    });
  }
  return out;
}
function mergeSpeedCurves(curves) {
  const best = /* @__PURE__ */ new Map();
  for (const curve of curves) {
    for (const p of curve) {
      const current = best.get(p.durationS);
      if (current === void 0 || p.speedMps > current) best.set(p.durationS, p.speedMps);
    }
  }
  return [...best.entries()].sort((a, b) => a[0] - b[0]).map(([durationS, speedMps]) => ({
    durationS,
    speedMps,
    paceSecPerKm: Math.round(1e3 / speedMps)
  }));
}
var CS_SHORT_S = 180;
var CS_LONG_S = 1200;
function criticalSpeed(curve) {
  if (curve.length < 2) return null;
  const short = nearestPoint(curve, CS_SHORT_S);
  const long = nearestPoint(curve, CS_LONG_S);
  if (!short || !long) return null;
  if (long.durationS <= short.durationS * 2) return null;
  const d1 = short.speedMps * short.durationS;
  const d2 = long.speedMps * long.durationS;
  const cs = (d2 - d1) / (long.durationS - short.durationS);
  if (!(cs > 0)) return null;
  const dPrime = d1 - cs * short.durationS;
  return {
    speedMps: round3(cs),
    paceSecPerKm: Math.round(1e3 / cs),
    // A negative intercept means the two points do not fit the model; report zero rather than nonsense.
    dPrimeM: Math.max(0, Math.round(dPrime)),
    fromDurationsS: [short.durationS, long.durationS]
  };
}
function nearestPoint(curve, targetS) {
  let best;
  let bestGap = Infinity;
  for (const p of curve) {
    const gap = Math.abs(p.durationS - targetS);
    if (gap < bestGap) {
      bestGap = gap;
      best = p;
    }
  }
  return best;
}
var isNum = (v) => typeof v === "number" && Number.isFinite(v);
function round3(v) {
  return Math.round(v * 1e3) / 1e3;
}

// src/lib/analytics/race-predictor.ts
var RIEGEL_EXPONENT = 1.06;
var MAX_EXTRAPOLATION = 4;
var CONFIDENT_EXTRAPOLATION = 2.5;
var RACE_TARGETS = [
  { key: "5k", label: "5 km", metres: 5e3 },
  { key: "10k", label: "10 km", metres: 1e4 },
  { key: "half", label: "P\xF3\u0142maraton", metres: 21097.5 },
  { key: "marathon", label: "Maraton", metres: 42195 }
];
function riegelTime(sourceTimeS, sourceMetres, targetMetres, exponent = RIEGEL_EXPONENT) {
  if (!(sourceTimeS > 0) || !(sourceMetres > 0) || !(targetMetres > 0)) return null;
  return Math.round(sourceTimeS * (targetMetres / sourceMetres) ** exponent);
}
function criticalSpeedTime(csMps, dPrimeM, targetMetres) {
  if (!isNum2(csMps) || csMps <= 0 || !(targetMetres > 0)) return null;
  const reserve = isNum2(dPrimeM) && dPrimeM > 0 ? dPrimeM : 0;
  const aerobic = targetMetres - reserve;
  if (aerobic <= 0) return null;
  return Math.round(aerobic / csMps);
}
function predictRaces(bests, opts = {}) {
  const targets = opts.targets ?? RACE_TARGETS;
  const usable = bests.filter((b) => b.metres > 0 && b.timeS > 0);
  const out = [];
  for (const target of targets) {
    const source = closestBest(usable, target.metres);
    const extrapolation = source ? ratio(target.metres, source.metres) : null;
    const withinRange = source !== null && extrapolation !== null && extrapolation <= MAX_EXTRAPOLATION;
    const riegelS = withinRange ? riegelTime(source.timeS, source.metres, target.metres, opts.exponent) : null;
    const criticalSpeedS = criticalSpeedTime(opts.csMps, opts.dPrimeM, target.metres);
    if (riegelS === null && criticalSpeedS === null) continue;
    out.push({
      key: target.key,
      label: target.label,
      metres: target.metres,
      riegelS,
      criticalSpeedS,
      paceSecPerKm: riegelS === null ? null : Math.round(riegelS / (target.metres / 1e3)),
      fromLabel: riegelS === null ? null : source?.label ?? null,
      fromDay: riegelS === null ? null : source?.day ?? null,
      fromBasis: riegelS === null ? null : source?.basis ?? null,
      extrapolation: riegelS === null ? null : round23(extrapolation ?? 1),
      confident: riegelS !== null && extrapolation !== null && extrapolation <= CONFIDENT_EXTRAPOLATION
    });
  }
  return out;
}
function closestBest(bests, targetMetres) {
  let best = null;
  let bestRatio = Infinity;
  for (const b of bests) {
    const r = ratio(targetMetres, b.metres);
    if (r < bestRatio) {
      bestRatio = r;
      best = b;
    }
  }
  return best;
}
function ratio(a, b) {
  if (!(a > 0) || !(b > 0)) return Infinity;
  return a > b ? a / b : b / a;
}
var isNum2 = (v) => typeof v === "number" && Number.isFinite(v);
function round23(v) {
  return Math.round(v * 100) / 100;
}

// src/lib/server/analytics/season.ts
var RACE_WEEK_DAYS = 7;
var TAPER_DAYS = 14;
var PEAK_DAYS = 28;
var BUILD_DAYS = 84;
var BASE_DAYS = 168;
var TAPER_MAX_RATIO = 0.8;
var CTL_TOLERANCE = 3;
var round13 = (n) => Math.round(n * 10) / 10;
function goalPhase(daysOut) {
  if (daysOut < 0) return "done";
  if (daysOut < RACE_WEEK_DAYS) return "race-week";
  if (daysOut < TAPER_DAYS) return "taper";
  if (daysOut < PEAK_DAYS) return "peak";
  if (daysOut < BUILD_DAYS) return "build";
  if (daysOut < BASE_DAYS) return "base";
  return "far";
}
function inTaperWindow(daysOut) {
  return daysOut >= 0 && daysOut < TAPER_DAYS;
}
function requiredRamp(currentCtl, targetCtl, daysOut) {
  if (currentCtl === null || targetCtl === null) return null;
  if (!Number.isFinite(currentCtl) || !Number.isFinite(targetCtl)) return null;
  const buildDays = daysOut - TAPER_DAYS;
  if (buildDays <= 0) return null;
  const gap = targetCtl - currentCtl;
  if (gap <= 0) return 0;
  return round13(gap / buildDays * 7);
}
function projectCtl(currentCtl, rampPerWeek, daysOut) {
  if (currentCtl === null || !Number.isFinite(currentCtl)) return null;
  const buildDays = Math.max(0, daysOut - TAPER_DAYS);
  const ramp = rampPerWeek ?? 0;
  if (!Number.isFinite(ramp)) return null;
  return round13(Math.max(0, currentCtl + ramp * buildDays / 7));
}
function taperCheck(series, daysOut, today) {
  if (!inTaperWindow(daysOut)) return null;
  const upTo = series.filter((p) => p.day <= today);
  if (upTo.length < 35) return null;
  const recent = upTo.slice(-7);
  const baseline = upTo.slice(-35, -7);
  if (recent.length < 7 || baseline.length < 28) return null;
  const mean2 = (points) => points.reduce((sum, p) => sum + p.tss, 0) / points.length;
  const recentDailyLoad = round13(mean2(recent));
  const baselineDailyLoad = round13(mean2(baseline));
  if (baselineDailyLoad <= 0) return null;
  const ratio2 = round13(recentDailyLoad / baselineDailyLoad);
  return {
    recentDailyLoad,
    baselineDailyLoad,
    ratio: ratio2,
    tapering: ratio2 <= TAPER_MAX_RATIO
  };
}
function goalStatus(input) {
  const { daysOut, currentCtl, targetCtl, projectedCtl, risk } = input;
  if (daysOut < 0) return "unknown";
  if (currentCtl === null || risk === null || risk.historyDays < MIN_HISTORY_DAYS) return "unknown";
  const ramp = risk.rampRatePerWeek;
  if (ramp !== null && ramp > RAMP_HIGH) return "at-risk";
  if (targetCtl === null || projectedCtl === null) return "unknown";
  if (projectedCtl >= targetCtl + CTL_TOLERANCE) return "ahead";
  if (projectedCtl >= targetCtl - CTL_TOLERANCE) return "on-track";
  return "behind";
}
function daysOutTo(today, day) {
  return daysBetween(today, day);
}

// src/modules/season/season.validate.ts
var MAX_TITLE = 120;
var MAX_NOTE = 500;
var MAX_DISTANCE_M = 1e6;
var MAX_TARGET_TIME_S = 36e4;
var MAX_TARGET_CTL = 200;
var KINDS = ["race", "fitness"];
var PRIORITIES = ["a", "b", "c"];
var fail = (error) => ({ ok: false, error });
function asRecord2(body) {
  return typeof body === "object" && body !== null && !Array.isArray(body) ? body : null;
}
function optionalNumber(value, max, label) {
  if (value === void 0 || value === null || value === "") return { ok: true, value: null };
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return fail(`${label} musi by\u0107 liczb\u0105`);
  if (n <= 0) return fail(`${label} musi by\u0107 wi\u0119ksze od zera`);
  if (n > max) return fail(`${label} jest poza dopuszczalnym zakresem`);
  return { ok: true, value: n };
}
function optionalText(value, max, label) {
  if (value === void 0 || value === null) return { ok: true, value: null };
  if (typeof value !== "string") return fail(`${label} musi by\u0107 tekstem`);
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > max) return fail(`${label} jest za d\u0142ugie`);
  return { ok: true, value: trimmed };
}
function parseNewGoal(body) {
  const b = asRecord2(body);
  if (!b) return fail("oczekiwano obiektu JSON");
  if (!isDayKey(b.day)) return fail("data celu musi by\u0107 w formacie RRRR-MM-DD");
  if (!isSportGroup(b.sport)) return fail("nieznana dyscyplina");
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (title.length === 0) return fail("nazwa celu jest wymagana");
  if (title.length > MAX_TITLE) return fail("nazwa celu jest za d\u0142uga");
  const kind = b.kind === void 0 ? "race" : b.kind;
  if (!KINDS.includes(kind)) return fail("nieznany rodzaj celu");
  const priority = b.priority === void 0 ? "a" : b.priority;
  if (!PRIORITIES.includes(priority)) return fail("nieznany priorytet");
  const distance = optionalNumber(b.distanceM, MAX_DISTANCE_M, "dystans");
  if (!distance.ok) return distance;
  const targetTime = optionalNumber(b.targetTimeS, MAX_TARGET_TIME_S, "czas docelowy");
  if (!targetTime.ok) return targetTime;
  const targetCtl = optionalNumber(b.targetCtl, MAX_TARGET_CTL, "docelowa forma (CTL)");
  if (!targetCtl.ok) return targetCtl;
  const note = optionalText(b.note, MAX_NOTE, "notatka");
  if (!note.ok) return note;
  const eventId = optionalText(b.garminEventId, MAX_TITLE, "identyfikator wydarzenia");
  if (!eventId.ok) return eventId;
  if (targetTime.value !== null && distance.value === null) {
    return fail("czas docelowy wymaga podania dystansu");
  }
  return {
    ok: true,
    value: {
      day: b.day,
      sport: b.sport,
      title,
      kind,
      priority,
      distanceM: distance.value,
      targetTimeS: targetTime.value,
      targetCtl: targetCtl.value,
      note: note.value,
      garminEventId: eventId.value
    }
  };
}

// src/modules/season/season.api.ts
var HISTORY_DAYS = 540;
var MAX_HORIZON_DAYS = 730;
var PAST_GOALS_SHOWN = 5;
var SPEED_STREAM_CAP = 40;
var PHASE_LABELS = {
  done: "Po starcie",
  "race-week": "Tydzie\u0144 startowy",
  taper: "Tapering",
  peak: "Szczyt formy",
  build: "Budowanie",
  base: "Baza",
  far: "Daleko"
};
var round14 = (n) => Math.round(n * 10) / 10;
function numberSetting(settings, key2) {
  const v = settings[key2];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}
function verdictNote(status, daysOut, requiredRampPerWeek, taper) {
  if (daysOut < 0) return "Cel jest ju\u017C za Tob\u0105.";
  if (taper) {
    return taper.tapering ? `Obci\u0105\u017Cenie spad\u0142o do ${Math.round(taper.ratio * 100)}% poziomu sprzed taperingu \u2014 to prawdziwy tapering. Forma z ostatnich tygodni zd\u0105\u017Cy wyj\u015B\u0107 na wierzch.` : `Obci\u0105\u017Cenie trzyma si\u0119 na ${Math.round(taper.ratio * 100)}% poziomu sprzed taperingu. To zwyk\u0142y tydzie\u0144 pod nazw\u0105 taperingu \u2014 na starcie zostaniesz ze zm\u0119czeniem, nie z form\u0105.`;
  }
  switch (status) {
    case "at-risk":
      return "Forma ro\u015Bnie szybciej, ni\u017C baza jest w stanie unie\u015B\u0107. To najcz\u0119stsza droga do kontuzji przeci\u0105\u017Ceniowej \u2014 zanim do\u0142o\u017Cysz cokolwiek do planu, wple\u0107 l\u017Cejszy tydzie\u0144.";
    case "behind":
      return requiredRampPerWeek === null ? "Obecne tempo nie dowozi celu, a na budowanie nie ma ju\u017C czasu. Realniejszy jest cel skromniejszy ni\u017C plan, kt\xF3ry si\u0119 nie domknie." : `Obecne tempo nie dowozi celu. Potrzeba oko\u0142o ${requiredRampPerWeek} pkt CTL tygodniowo \u2014 dok\u0142adaj stopniowo, nie jednym mocnym tygodniem.`;
    case "ahead":
      return "Jeste\u015B przed planem. Nie ma powodu dok\u0142ada\u0107 \u2014 nadmiar formy przed czasem zwykle ko\u0144czy si\u0119 przetrenowaniem, nie lepszym startem.";
    case "on-track":
      return "Obecne tempo dowozi cel na start taperingu. Utrzymaj kierunek i pilnuj tygodni odci\u0105\u017Caj\u0105cych.";
    default:
      return "Za ma\u0142o ci\u0105g\u0142ej historii treningowej, aby oceni\u0107 trajektori\u0119 do tego celu. Wska\u017Aniki liczone z niepe\u0142nej bazy tylko strasz\u0105.";
  }
}
function buildPrediction(goal, runs, speedCurve) {
  if (goal.sport !== "run" || goal.distanceM === null || runs.length === 0) return null;
  const bests = personalBests(
    runs.map((a) => ({
      activityId: a.activityId,
      day: toDayKey(a.startTimeLocal),
      distanceM: a.distanceM,
      durationS: a.durationS,
      movingS: a.movingS
    }))
  );
  if (bests.length === 0) return null;
  const critical = criticalSpeed(speedCurve);
  const target = RACE_TARGETS.find((t) => Math.abs(t.metres - goal.distanceM) < 1) ?? {
    key: "goal",
    label: goal.title,
    metres: goal.distanceM
  };
  const [prediction] = predictRaces(
    bests.map((b) => ({ metres: b.meters, timeS: b.timeS, label: b.label, day: b.day })),
    {
      csMps: critical?.speedMps ?? null,
      dPrimeM: critical?.dPrimeM ?? null,
      targets: [target]
    }
  );
  if (!prediction) return null;
  const predicted = prediction.riegelS ?? prediction.criticalSpeedS;
  return {
    riegelS: prediction.riegelS,
    criticalSpeedS: prediction.criticalSpeedS,
    fromLabel: prediction.fromLabel,
    fromDay: prediction.fromDay,
    confident: prediction.confident,
    gapS: goal.targetTimeS !== null && predicted !== null ? Math.round(goal.targetTimeS - predicted) : null
  };
}
async function loadSeason(deps, req) {
  const today = todayKey(deps.clock);
  if (!await deps.consent.isEnabled(ADVANCED_FEATURE)) {
    return { enabled: false, today, goals: [], suggestions: [], hasData: false, sports: [] };
  }
  const historyStart = addDays(today, -(HISTORY_DAYS - 1));
  const [goals, activities, userSettings, sportCounts] = await Promise.all([
    deps.store.listGoals(req.userId),
    deps.store.listActivities(req.userId, { from: historyStart, limit: 2e4 }),
    deps.settings.get(req.userId),
    deps.store.listSports(req.userId)
  ]);
  const needsStream = activities.filter((a) => a.trainingLoad == null || a.trainingLoad <= 0);
  const streamById = await deps.store.getStreamField(
    req.userId,
    needsStream.map((a) => a.activityId),
    "power"
  );
  let ftpWatts = numberSetting(userSettings, "ftpWatts");
  if (ftpWatts == null) {
    const powerActs = needsStream.flatMap((a) => {
      const power = streamById.get(a.activityId);
      return power ? [{ activityId: a.activityId, day: toDayKey(a.startTimeLocal), power }] : [];
    });
    if (powerActs.length > 0) ftpWatts = buildPowerProfile(powerActs, { weightKg: null }).ftpWatts;
  }
  const loadOpts = { ftpWatts, endDay: today };
  const toLoadActivity = (a) => ({
    day: toDayKey(a.startTimeLocal),
    durationS: a.movingS ?? a.durationS,
    trainingLoad: a.trainingLoad,
    avgHr: a.avgHr,
    maxHr: a.maxHr,
    power: a.trainingLoad != null && a.trainingLoad > 0 ? null : streamById.get(a.activityId) ?? null
  });
  const families = new Set(goals.map((g) => g.sport));
  const pmcByFamily = /* @__PURE__ */ new Map();
  for (const family of families) {
    const keys = new Set(sportKeysInGroup(family));
    const own = activities.filter((a) => keys.has(a.sport) || sportGroup(a.sport) === family);
    pmcByFamily.set(family, buildTrainingLoad(own.map(toLoadActivity), loadOpts));
  }
  const runs = activities.filter((a) => sportGroup(a.sport) === "run");
  const needsPrediction = goals.some(
    (g) => g.sport === "run" && g.kind === "race" && g.distanceM !== null && daysOutTo(today, g.day) >= 0
  );
  let speedCurve = mergeSpeedCurves([]);
  if (needsPrediction && runs.length > 0) {
    const curveRuns = [...runs].sort((a, b) => a.startTimeLocal < b.startTimeLocal ? 1 : -1).slice(0, SPEED_STREAM_CAP);
    const speedById = await deps.store.getStreamField(
      req.userId,
      curveRuns.map((a) => a.activityId),
      "speed"
    );
    speedCurve = mergeSpeedCurves(
      curveRuns.flatMap((a) => {
        const speed = speedById.get(a.activityId);
        return speed && speed.length > 0 ? [speedDurationCurve(speed)] : [];
      })
    );
  }
  const statuses = goals.map((goal) => {
    const daysOut = daysOutTo(today, goal.day);
    const phase = goalPhase(daysOut);
    const pmc = pmcByFamily.get(goal.sport);
    const hasFamilyData = pmc !== void 0 && pmc.hasData;
    const risk = hasFamilyData ? loadRisk(pmc.series) : null;
    const past2 = daysOut < 0;
    const ctl = hasFamilyData ? pmc.ctl : null;
    const rampPerWeek = past2 ? null : risk?.rampRatePerWeek ?? null;
    const projectedCtl = past2 ? null : projectCtl(ctl, rampPerWeek, daysOut);
    const requiredRampPerWeek = past2 ? null : requiredRamp(ctl, goal.targetCtl, daysOut);
    const taper = past2 || !hasFamilyData ? null : taperCheck(pmc.series, daysOut, today);
    const status = goalStatus({
      daysOut,
      currentCtl: ctl,
      targetCtl: goal.targetCtl,
      projectedCtl,
      risk
    });
    return {
      goal,
      daysOut,
      weeksOut: Math.trunc(daysOut / 7),
      phase,
      phaseLabel: PHASE_LABELS[phase] ?? phase,
      sportLabel: sportGroupLabel(goal.sport),
      color: sportGroupLane(goal.sport),
      ctl: ctl === null ? null : round14(ctl),
      projectedCtl,
      rampPerWeek,
      requiredRampPerWeek,
      taper,
      prediction: past2 ? null : buildPrediction(goal, runs, speedCurve),
      status,
      note: verdictNote(status, daysOut, requiredRampPerWeek, taper)
    };
  });
  const future = statuses.filter((s) => s.daysOut >= 0).sort((a, b) => a.daysOut - b.daysOut);
  const past = statuses.filter((s) => s.daysOut < 0).sort((a, b) => b.daysOut - a.daysOut).slice(0, PAST_GOALS_SHOWN);
  return {
    enabled: true,
    today,
    goals: [...future, ...past],
    suggestions: await loadSuggestions(deps, req.userId, today, goals),
    hasData: [...pmcByFamily.values()].some((p) => p.hasData) || activities.length > 0,
    sports: [...new Set(sportCounts.map((s) => sportGroup(s.sport)))].map((group) => ({
      group,
      label: sportGroupLabel(group)
    }))
  };
}
async function loadSuggestions(deps, userId, today, goals) {
  const events = await deps.store.listPlannedEvents(userId, today, addDays(today, MAX_HORIZON_DAYS));
  const adopted = new Set(goals.flatMap((g) => g.garminEventId === null ? [] : [g.garminEventId]));
  return events.filter((e) => e.kind === "race" && !adopted.has(e.id)).map((e) => {
    const group = e.sport === null ? "other" : sportGroup(e.sport);
    return {
      eventId: e.id,
      day: e.day,
      title: e.title,
      sport: group,
      sportLabel: sportGroupLabel(group),
      distanceM: e.estimatedDistanceM
    };
  });
}
async function createGoal(deps, userId, body) {
  const parsed = parseNewGoal(body);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  const now2 = deps.clock.now().toISOString();
  try {
    const goal = await deps.store.createGoal(userId, {
      // id and createdAt come from the injected ports, never from the caller's body.
      id: deps.random.token(12),
      ...parsed.value,
      source: parsed.value.garminEventId === null ? "manual" : "garmin",
      createdAt: now2
    });
    return { ok: true, goal };
  } catch (err) {
    if (err instanceof DuplicateGoalError) {
      return { ok: false, status: 409, error: "ten start jest ju\u017C dodany jako cel" };
    }
    throw err;
  }
}
async function deleteGoal(deps, userId, id) {
  const goal = await deps.store.deleteGoal(userId, id);
  if (goal === null) return { ok: false, status: 404, error: "nie znaleziono celu" };
  return { ok: true, deleted: true };
}

// src/lib/mcp/season-tools.ts
function text3(value) {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }]
  };
}
function errorText3(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}
var api = (deps) => ({
  store: deps.store,
  settings: deps.settings,
  consent: deps.consent,
  clock: deps.clock,
  random: deps.random
});
async function requireConsent2(deps) {
  if (await deps.consent.isEnabled(ADVANCED_FEATURE)) return null;
  return errorText3(
    "Season goals require the data-processing consent (Advanced mode). Enable it in the app settings first."
  );
}
function view2(s) {
  return {
    id: s.goal.id,
    title: s.goal.title,
    day: s.goal.day,
    sport: s.goal.sport,
    kind: s.goal.kind,
    priority: s.goal.priority,
    daysOut: s.daysOut,
    phase: s.phase,
    status: s.status,
    verdict: s.note,
    distanceM: s.goal.distanceM,
    targetTimeS: s.goal.targetTimeS,
    targetCtl: s.goal.targetCtl,
    currentCtl: s.ctl,
    projectedCtl: s.projectedCtl,
    rampPerWeek: s.rampPerWeek,
    requiredRampPerWeek: s.requiredRampPerWeek,
    ...s.taper ? { taper: { ratio: s.taper.ratio, tapering: s.taper.tapering } } : {},
    ...s.prediction ? {
      prediction: {
        riegelS: s.prediction.riegelS,
        criticalSpeedS: s.prediction.criticalSpeedS,
        fromBest: s.prediction.fromLabel,
        confident: s.prediction.confident,
        gapToTargetS: s.prediction.gapS
      }
    } : {}
  };
}
var listGoalsTool = {
  name: "list_goals",
  description: "The athlete's season goals \u2014 races and fitness targets \u2014 each with days remaining, which phase of the block today falls in (base/build/peak/taper/race-week), and a verdict on whether the current training trajectory reaches the target. Also lists races already on their Garmin calendar that have not been adopted as goals yet. Use this before advising on any session: a hard workout eleven days before an A race is a different answer than the same workout in base.",
  inputShape: {},
  async handler(deps) {
    const gate = await requireConsent2(deps);
    if (gate) return gate;
    const data = await loadSeason(api(deps), { userId: deps.userId });
    return text3({
      today: data.today,
      goals: data.goals.map(view2),
      unadoptedRaces: data.suggestions
    });
  }
};
var goalPlanTool = {
  name: "get_goal_plan",
  description: "One goal in full: countdown, phase, the fitness (CTL) it needs versus where the current ramp actually lands by the start of the taper, whether the taper is real (load actually falling), and \u2014 for a running race with a distance \u2014 the predicted finish time against the wanted one. A status of `at-risk` means the athlete is building faster than is safe and outranks being behind: do not advise adding load in that case.",
  inputShape: {
    goalId: z4.string().min(1).describe("Goal id from list_goals")
  },
  async handler(deps, args) {
    const gate = await requireConsent2(deps);
    if (gate) return gate;
    const goalId = String(args.goalId ?? "");
    const data = await loadSeason(api(deps), { userId: deps.userId });
    const found = data.goals.find((g) => g.goal.id === goalId);
    if (!found) return errorText3(`no goal with id ${goalId}`);
    return text3({ today: data.today, goal: view2(found) });
  }
};
var createGoalTool = {
  name: "create_goal",
  description: "Add a season goal: a race (with an optional distance in metres and target finish time in seconds) or a fitness target for a date. `sport` is a sport FAMILY \u2014 run, ride, walk, swim, strength or other \u2014 because the trajectory is scored against that family's own fitness. `targetCtl` is optional; without it the goal still gets a countdown and a phase but no on-track verdict. Pass `garminEventId` to adopt a race already on the Garmin calendar.",
  inputShape: {
    day: z4.string().regex(/^\d{4}-\d{2}-\d{2}$/, "day must be YYYY-MM-DD"),
    sport: z4.string().min(1).describe("Sport family: run, ride, walk, swim, strength, other"),
    title: z4.string().min(1).max(120),
    kind: z4.enum(["race", "fitness"]).nullish(),
    priority: z4.enum(["a", "b", "c"]).nullish(),
    distanceM: z4.number().positive().nullish(),
    targetTimeS: z4.number().positive().nullish(),
    targetCtl: z4.number().positive().nullish(),
    note: z4.string().max(500).nullish(),
    garminEventId: z4.string().max(120).nullish()
  },
  async handler(deps, args) {
    const gate = await requireConsent2(deps);
    if (gate) return gate;
    const result = await createGoal(api(deps), deps.userId, args);
    if (!result.ok) return errorText3(result.error);
    return text3({
      created: result.goal,
      next: "Call get_goal_plan with this id for the trajectory to it."
    });
  }
};
var deleteGoalTool = {
  name: "delete_goal",
  description: "Remove a season goal. Only the goal is deleted \u2014 a race imported from the Garmin calendar stays on that calendar, and simply becomes available to adopt again.",
  inputShape: {
    goalId: z4.string().min(1).describe("Goal id from list_goals")
  },
  async handler(deps, args) {
    const gate = await requireConsent2(deps);
    if (gate) return gate;
    const result = await deleteGoal(api(deps), deps.userId, String(args.goalId ?? ""));
    if (!result.ok) return errorText3(result.error);
    return text3({ deleted: true });
  }
};
var SEASON_TOOLS = [
  listGoalsTool,
  goalPlanTool,
  createGoalTool,
  deleteGoalTool
];

// src/lib/mcp/create-server.ts
function createMcpServer(garmin, ctx = DEFAULT_TOOL_CONTEXT, workouts, season) {
  const server = new McpServer(
    { name: "vagus", version: "0.1.0" },
    {
      instructions: "Access to the user's own Garmin Connect data (sleep, steps, HRV, body battery, stress, resting heart rate, activities, SpO2, respiration, calories, body composition) \u2014 all READ-ONLY. Dates are YYYY-MM-DD and default to today. Use get_metric_range for multi-day trends (max 31 days). For interpreted, plain-language wellness insights use get_readiness (compact score) and get_insights (readiness + trends + anomalies + correlations over a 7/30/90/365-day window), or the interpret_health prompt to have the assistant narrate them. Insights are consumer wellness signals, not medical advice." + (workouts ? " The create_workout / update_workout / delete_workout tools WRITE: they store a structured training session locally and the next sync puts it in the user's Garmin calendar (and so on their watch). list_workouts shows those sessions and whether they have reached Garmin yet. Nothing else on the Garmin account is ever modified." : "") + (season ? " list_goals / get_goal_plan say what the training is FOR: the races and fitness targets ahead, how far away each is, which phase of the block today falls in, and whether the current trajectory reaches the target. Consult them before advising on any session \u2014 the same workout is a good idea in base and a bad one in taper. A goal reported as `at-risk` means the athlete is already building faster than is safe; never advise adding load there, even when they are also behind target. create_goal / delete_goal manage that list." : "")
    }
  );
  for (const tool of GARMIN_TOOLS) {
    const callback = async (args) => tool.handler(garmin, args, ctx);
    server.registerTool(tool.name, { description: tool.description, inputSchema: tool.inputShape }, callback);
  }
  if (workouts) {
    for (const tool of WORKOUT_TOOLS) {
      const callback = async (args) => tool.handler(workouts, args ?? {});
      server.registerTool(
        tool.name,
        { description: tool.description, inputSchema: tool.inputShape },
        callback
      );
    }
  }
  if (season) {
    for (const tool of SEASON_TOOLS) {
      const callback = async (args) => tool.handler(season, args ?? {});
      server.registerTool(
        tool.name,
        { description: tool.description, inputSchema: tool.inputShape },
        callback
      );
    }
  }
  server.registerPrompt(
    "interpret_health",
    {
      description: "Have the assistant call get_readiness/get_insights for a window and give a short, encouraging, non-medical plain-language wellness briefing.",
      argsSchema: { window: z5.string().optional() }
    },
    ({ window }) => ({
      messages: interpretHealthMessages(window)
    })
  );
  return server;
}

// src/lib/server/security-headers.ts
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

// src/lib/mcp/http.ts
async function mcpGate(deps, input) {
  const headers = securityHeaders({ https: input.https });
  const reject = (status, error, retryAfter) => ({
    action: "reject",
    status,
    headers: {
      ...headers,
      "content-type": "application/json",
      ...retryAfter === void 0 ? {} : { "retry-after": String(retryAfter) }
    },
    body: JSON.stringify({ error })
  });
  const standing = deps.authFailures.peek(input.clientIp);
  if (!standing.allowed) return reject(429, "rate_limited", standing.retryAfterSeconds);
  const userId = input.token ? await deps.resolveUser(input.token) : null;
  if (!userId) {
    deps.authFailures.check(input.clientIp);
    return reject(401, "unauthorized");
  }
  const gate = deps.perUser.check(userId);
  if (!gate.allowed) return reject(429, "rate_limited", gate.retryAfterSeconds);
  return { action: "serve", userId, headers };
}
function extractMcpToken(input) {
  const fromQuery = input.searchParams.get("token");
  if (fromQuery) return fromQuery;
  const header = input.authorization;
  return typeof header === "string" ? header.replace(/^Bearer\s+/i, "").trim() : "";
}
var MCP_MAX_BODY_BYTES = 1e6;
async function readJsonBody(source, maxBytes = MCP_MAX_BODY_BYTES) {
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of source) {
      size += chunk.byteLength;
      if (size > maxBytes) return void 0;
      chunks.push(chunk);
    }
  } catch {
    return void 0;
  }
  if (size === 0) return void 0;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return void 0;
  }
}
function clientIpOf(input) {
  if (input.trustProxy && input.forwardedFor) {
    const first = input.forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return input.remoteAddress ?? "unknown";
}

// src/lib/mcp/entry.ts
var ref = null;
function container() {
  if (!ref) ref = createContainer();
  return ref;
}
var PER_USER_LIMIT = Number(process.env.MCP_RATE_LIMIT ?? 120);
var AUTH_FAILURE_LIMIT = Number(process.env.MCP_AUTH_FAILURE_LIMIT ?? 30);
var now = () => container().clock.now().getTime();
var perUser = createRateLimiter({ limit: PER_USER_LIMIT, windowMs: 6e4, now });
var authFailures = createRateLimiter({ limit: AUTH_FAILURE_LIMIT, windowMs: 6e4, now });
var trustProxy = (process.env.MCP_TRUST_PROXY ?? "off") === "on";
function gateMcpRequest(input) {
  return mcpGate(
    { resolveUser: (token) => container().repo.mcpTokens.resolve(token), authFailures, perUser },
    input
  );
}
function newMcpServerForUser(userId) {
  const c = container();
  return createMcpServer(
    c.garminFor(userId),
    { clock: c.clock, timeZone: c.config.appTimeZone },
    // Workout authoring (spec 050): writes go to the LOCAL store, which the sync then projects onto
    // Garmin. The sidecar source is passed only so a delete can be cleaned up upstream immediately.
    {
      store: c.store,
      userId,
      clock: c.clock,
      timeZone: c.config.appTimeZone,
      random: c.random,
      consent: c.consentFor(userId),
      garmin: c.garminSyncFor(userId)
    },
    // Season goals (spec 060): read + write, entirely against the local store — no Garmin call at all.
    {
      store: c.store,
      settings: c.repo.settings,
      userId,
      clock: c.clock,
      consent: c.consentFor(userId),
      random: c.random
    }
  );
}
export {
  MCP_MAX_BODY_BYTES,
  clientIpOf,
  extractMcpToken,
  gateMcpRequest,
  newMcpServerForUser,
  readJsonBody,
  trustProxy
};
