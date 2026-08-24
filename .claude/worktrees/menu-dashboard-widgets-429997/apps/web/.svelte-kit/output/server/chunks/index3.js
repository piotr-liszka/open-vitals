import { a as safeEqual } from "./crypto.js";
import { c as codeChallengeS256 } from "./pkce.js";
class IntegrationNotConnectedError extends Error {
  constructor(provider) {
    super(`Integration not connected: ${provider}`);
    this.provider = provider;
    this.name = "IntegrationNotConnectedError";
  }
}
class IntegrationRemoteError extends Error {
  constructor(provider, message = "Integration remote call failed") {
    super(message);
    this.provider = provider;
    this.name = "IntegrationRemoteError";
  }
}
const DEFAULTS = {
  startToleranceS: 180,
  durationTolerancePct: 0.1,
  distanceTolerancePct: 0.1
};
function toMs(iso) {
  return new Date(iso).getTime();
}
function relDiff(a, b) {
  const max = Math.max(Math.abs(a), Math.abs(b));
  if (max === 0) return 0;
  return Math.abs(a - b) / max;
}
function matchStravaActivity(ref, candidates, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const refStart = toMs(ref.startTime);
  if (Number.isNaN(refStart)) return null;
  let best = null;
  for (const cand of candidates) {
    const candStart = toMs(cand.startTime);
    if (Number.isNaN(candStart)) continue;
    const startDeltaS = Math.abs(candStart - refStart) / 1e3;
    if (startDeltaS > opts.startToleranceS) continue;
    const candDuration = cand.durationS ?? cand.movingS;
    let durDiff = null;
    if (candDuration != null && ref.durationS > 0) {
      durDiff = relDiff(ref.durationS, candDuration);
      if (durDiff > opts.durationTolerancePct) continue;
    }
    let distDiff = null;
    if (cand.distanceM != null && ref.distanceM > 0) {
      distDiff = relDiff(ref.distanceM, cand.distanceM);
      if (distDiff > opts.distanceTolerancePct) continue;
    }
    if (durDiff === null && distDiff === null) continue;
    const startScore = 1 - startDeltaS / opts.startToleranceS;
    const durScore = durDiff === null ? 1 : 1 - durDiff / opts.durationTolerancePct;
    const distScore = distDiff === null ? 1 : 1 - distDiff / opts.distanceTolerancePct;
    const matchScore = Number(((startScore + durScore + distScore) / 3).toFixed(4));
    const link = {
      activityId: cand.activityId,
      stravaId: ref.stravaId,
      permalink: ref.permalink,
      matchScore,
      startDeltaS: Number(startDeltaS.toFixed(3))
    };
    if (best === null || link.startDeltaS < best.startDeltaS || link.startDeltaS === best.startDeltaS && link.matchScore > best.matchScore) {
      best = link;
    }
  }
  return best;
}
function matchAll(refs, candidates, options = {}) {
  const claimed = /* @__PURE__ */ new Set();
  const links = [];
  const scored = refs.map((ref) => ({ ref, link: matchStravaActivity(ref, candidates, options) })).filter((x) => x.link !== null).sort((a, b) => b.link.matchScore - a.link.matchScore || a.link.startDeltaS - b.link.startDeltaS);
  for (const { link } of scored) {
    if (claimed.has(link.activityId)) continue;
    claimed.add(link.activityId);
    links.push(link);
  }
  return links;
}
const WITHINGS_LOOKBACK_DAYS = 365;
const STRAVA_LOOKBACK_DAYS = 90;
function isoDay(d) {
  return d.toISOString().slice(0, 10);
}
function daysAgo(now, n) {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}
async function syncWithingsWeight(deps, userId) {
  const tokens = await deps.tokens.get(userId, "withings");
  if (!tokens) throw new IntegrationNotConnectedError("withings");
  const now = deps.clock.now();
  const start = isoDay(daysAgo(now, WITHINGS_LOOKBACK_DAYS));
  const end = isoDay(now);
  const weighIns = await deps.withings.getWeighIns(tokens, start, end);
  if (weighIns.length > 0) {
    await deps.store.putWeight(
      userId,
      weighIns.map((w) => ({ day: w.day, weightKg: w.weightKg, source: "withings", raw: w.raw }))
    );
  }
  const days = weighIns.map((w) => w.day).sort();
  deps.logger.info("withings weight import", { userId, imported: weighIns.length });
  return {
    provider: "withings",
    imported: weighIns.length,
    firstDay: days[0] ?? null,
    lastDay: days[days.length - 1] ?? null
  };
}
async function linkStravaActivities(deps, userId, options = {}) {
  const tokens = await deps.tokens.get(userId, "strava");
  if (!tokens) throw new IntegrationNotConnectedError("strava");
  const now = deps.clock.now();
  const since = Math.floor(daysAgo(now, STRAVA_LOOKBACK_DAYS).getTime() / 1e3);
  const raw = await deps.strava.listActivities(tokens, since);
  const refs = raw.map((a) => deps.strava.normalizeToMatchKey(a));
  const candidates = await deps.store.listActivities(userId);
  const links = matchAll(refs, candidates, options);
  await deps.links.put(userId, links);
  deps.logger.info("strava link", { userId, scanned: refs.length, matched: links.length });
  return { provider: "strava", scanned: refs.length, matched: links.length, links };
}
const MIN_DAY = "0001-01-01";
const MAX_DAY = "9999-12-31";
async function getIntegrationsStatus(deps, userId) {
  const [stravaTokens, withingsTokens, links, weights] = await Promise.all([
    deps.tokens.get(userId, "strava"),
    deps.tokens.get(userId, "withings"),
    deps.links.list(userId),
    deps.store.getWeightRange(userId, MIN_DAY, MAX_DAY)
  ]);
  const withingsWeights = weights.filter((w) => w.source === "withings");
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
async function beginAuth(deps, provider) {
  const state = deps.random.token(24);
  const codeVerifier = deps.random.token(32);
  const codeChallenge = codeChallengeS256(codeVerifier);
  const client = provider === "strava" ? deps.strava : deps.withings;
  const location = client.buildAuthUrl(state, codeChallenge);
  return { location, transaction: { state, codeVerifier } };
}
async function completeAuth(deps, provider, input, userId) {
  const { transaction } = input;
  if (!transaction || !transaction.state || !transaction.codeVerifier) {
    return { ok: false, provider, error: "Sesja połączenia wygasła. Spróbuj ponownie." };
  }
  if (!input.code) {
    return { ok: false, provider, error: "Brak kodu autoryzacji." };
  }
  if (!input.state || !safeEqual(input.state, transaction.state)) {
    return { ok: false, provider, error: "Nieprawidłowy stan połączenia. Spróbuj ponownie." };
  }
  try {
    const client = provider === "strava" ? deps.strava : deps.withings;
    const tokens = await client.exchangeCode(input.code, transaction.codeVerifier);
    await deps.tokens.set(userId, provider, tokens);
    return { ok: true, provider };
  } catch (err) {
    if (err instanceof IntegrationRemoteError) {
      return { ok: false, provider, error: "Nie udało się połączyć z dostawcą. Spróbuj ponownie." };
    }
    throw err;
  }
}
async function runProviderSync(deps, provider, userId) {
  if (provider === "withings") {
    const r2 = await syncWithingsWeight(deps, userId);
    return { provider: "withings", imported: r2.imported, firstDay: r2.firstDay, lastDay: r2.lastDay };
  }
  const r = await linkStravaActivities(deps, userId);
  return { provider: "strava", scanned: r.scanned, matched: r.matched, links: r.links };
}
async function disconnect(deps, provider, userId) {
  await deps.tokens.clear(userId, provider);
  if (provider === "strava") await deps.links.clear(userId);
}
const STRAVA_MOCK_ACTIVITIES = [
  {
    id: 9001,
    name: "Morning Ride",
    start_date: "2026-08-01T07:00:00Z",
    elapsed_time: 3600,
    moving_time: 3500,
    distance: 3e4,
    type: "Ride",
    sport_type: "Ride"
  },
  {
    id: 9002,
    name: "Lunch Run",
    start_date: "2026-08-03T17:30:00Z",
    elapsed_time: 1800,
    moving_time: 1780,
    distance: 5e3,
    type: "Run",
    sport_type: "Run"
  },
  {
    id: 9003,
    name: "Long Ride",
    start_date: "2026-08-06T06:15:00Z",
    elapsed_time: 5400,
    moving_time: 5200,
    distance: 45e3,
    type: "Ride",
    sport_type: "MountainBikeRide"
  }
];
const MOCK_TOKENS$1 = {
  accessToken: "mock-strava-access",
  refreshToken: "mock-strava-refresh",
  expiresAt: null,
  scope: "activity:read",
  providerUserId: "mock-athlete-1"
};
function createStravaMock(deps = {}) {
  const redirectUri = deps.redirectUri ?? "/api/integrations/strava/callback";
  return {
    buildAuthUrl(state, _codeChallenge) {
      const url = new URL(redirectUri, "http://mock.local");
      url.searchParams.set("code", "mock-strava-code");
      url.searchParams.set("state", state);
      return redirectUri.startsWith("http") ? url.toString() : `${url.pathname}${url.search}`;
    },
    async exchangeCode(_code, _verifier) {
      return MOCK_TOKENS$1;
    },
    async listActivities(_tokens, since) {
      if (since == null) return [...STRAVA_MOCK_ACTIVITIES];
      return STRAVA_MOCK_ACTIVITIES.filter((a) => new Date(a.start_date).getTime() / 1e3 >= since);
    },
    normalizeToMatchKey(activity) {
      const ref = {
        stravaId: String(activity.id),
        name: activity.name,
        startTime: new Date(activity.start_date).toISOString(),
        durationS: activity.elapsed_time || activity.moving_time,
        distanceM: activity.distance,
        sport: (activity.sport_type ?? activity.type).toLowerCase(),
        permalink: `https://www.strava.com/activities/${activity.id}`
      };
      return ref;
    }
  };
}
const MOCK_TOKENS = {
  accessToken: "mock-withings-access",
  refreshToken: "mock-withings-refresh",
  expiresAt: null,
  scope: "user.metrics",
  providerUserId: "mock-withings-1"
};
function addDays(day, n) {
  const d = /* @__PURE__ */ new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function createWithingsMock(deps = {}) {
  const redirectUri = deps.redirectUri ?? "/api/integrations/withings/callback";
  const seriesStart = deps.seriesStart ?? "2026-06-01";
  const startWeightKg = deps.startWeightKg ?? 82.5;
  const weeklyDeltaKg = deps.weeklyDeltaKg ?? 0.3;
  const weeks = deps.weeks ?? 10;
  const series = Array.from({ length: weeks }, (_, i) => {
    const day = addDays(seriesStart, i * 7);
    const weightKg = Number((startWeightKg - i * weeklyDeltaKg).toFixed(3));
    return { day, weightKg, raw: { day, weightKg, source: "withings-mock" } };
  });
  return {
    buildAuthUrl(state, _codeChallenge) {
      const url = new URL(redirectUri, "http://mock.local");
      url.searchParams.set("code", "mock-withings-code");
      url.searchParams.set("state", state);
      return redirectUri.startsWith("http") ? url.toString() : `${url.pathname}${url.search}`;
    },
    async exchangeCode(_code, _verifier) {
      return MOCK_TOKENS;
    },
    async getWeighIns(_tokens, start, end) {
      return series.filter((w) => w.day >= start && w.day <= end);
    }
  };
}
const key = (userId, provider) => `${userId}\0${provider}`;
function createMemoryIntegrationTokenStore() {
  const map = /* @__PURE__ */ new Map();
  return {
    async get(userId, provider) {
      return map.get(key(userId, provider)) ?? null;
    },
    async set(userId, provider, tokens) {
      map.set(key(userId, provider), tokens);
    },
    async clear(userId, provider) {
      map.delete(key(userId, provider));
    }
  };
}
function createMemoryStravaLinkStore() {
  const map = /* @__PURE__ */ new Map();
  return {
    async put(userId, links) {
      map.set(userId, [...links]);
    },
    async list(userId) {
      return [...map.get(userId) ?? []];
    },
    async clear(userId) {
      map.delete(userId);
    }
  };
}
const tokenStore = createMemoryIntegrationTokenStore();
const linkStore = createMemoryStravaLinkStore();
function integrationRedirectUri(container, provider) {
  return `${container.config.publicBaseUrl}/api/integrations/${provider}/callback`;
}
function createIntegrations(locals) {
  const c = locals.container;
  return {
    store: c.store,
    tokens: tokenStore,
    links: linkStore,
    strava: createStravaMock({ redirectUri: integrationRedirectUri(c, "strava") }),
    withings: createWithingsMock({ redirectUri: integrationRedirectUri(c, "withings") }),
    random: c.random,
    clock: c.clock,
    logger: c.logger
  };
}
export {
  IntegrationNotConnectedError as I,
  createIntegrations as a,
  beginAuth as b,
  completeAuth as c,
  disconnect as d,
  getIntegrationsStatus as g,
  runProviderSync as r
};
