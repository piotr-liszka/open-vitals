import { g as garminFailureOf, G as GarminUnavailableError } from './interfaces.js-CRv0EuSy.js';

const progressOf = (run) => {
  if (!run || run.total <= 0) return run?.status === "succeeded" ? 1 : 0;
  return Math.max(0, Math.min(1, run.done / run.total));
};
const STALE_RUN_MS = 60 * 6e4;
async function cancelSync(deps, userId, now) {
  const latest = await deps.store.getLatestRun(userId);
  if (latest && latest.userId === userId && latest.status === "running") {
    await deps.store.updateRun(latest.id, {
      status: "cancelled",
      step: "zatrzymano",
      finishedAt: now.toISOString()
    });
  }
  return getSyncStatus(deps, userId);
}
async function triggerSync(deps, userId, kind, now = /* @__PURE__ */ new Date()) {
  const latest = await deps.store.getLatestRun(userId);
  if (latest && latest.status === "running") {
    const age = now.getTime() - new Date(latest.startedAt).getTime();
    if (age < STALE_RUN_MS) {
      return { runId: latest.id, status: "running", alreadyRunning: true };
    }
    await deps.store.updateRun(latest.id, {
      status: "failed",
      error: "interrupted",
      finishedAt: now.toISOString()
    });
  }
  let resolveId;
  const idReady = new Promise((resolve) => resolveId = resolve);
  const opts = { kind, onStart: (id) => resolveId(id) };
  void deps.syncEngine.syncUser(userId, opts).catch(() => {
  });
  const runId = await idReady;
  return { runId, status: "running", alreadyRunning: false };
}
async function getSyncStatus(deps, userId, runId) {
  const [run, state] = await Promise.all([
    runId ? deps.store.getRun(runId) : deps.store.getLatestRun(userId),
    deps.store.getSyncState(userId, "garmin")
  ]);
  const scoped = run && run.userId === userId ? run : null;
  const scheduler = deps.scheduler ?? null;
  return {
    run: scoped,
    progress: progressOf(scoped),
    lastSyncAt: state?.lastSyncAt ?? null,
    // `lastCheckAt` covers the ticks that fast-returned (spec 027): freshness is "when did we last
    // LOOK", which is what makes a quiet half hour distinguishable from a broken scheduler.
    lastCheckAt: asIso(state?.cursor?.lastCheckAt) ?? state?.lastSyncAt ?? null,
    lastResult: asCheckResult(state?.cursor?.lastResult),
    autoSync: scheduler ? { intervalMs: scheduler.intervalMs, nextRunAt: scheduler.nextRunAt().toISOString() } : null
  };
}
function asIso(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
function asCheckResult(value) {
  return value === "synced" || value === "unchanged" ? value : null;
}
async function getSidecarLog(deps, limit = 100) {
  const source = deps.garminSync;
  if (!source?.getDiagnostics) return { available: false, entries: [], reason: "unsupported" };
  try {
    return { available: true, entries: await source.getDiagnostics(Math.max(1, Math.min(400, limit))) };
  } catch (err) {
    const failure = garminFailureOf(err);
    return {
      available: false,
      entries: [],
      reason: failure.code,
      ...err instanceof GarminUnavailableError && failure.status ? { status: failure.status } : {}
    };
  }
}
async function getCoverage(deps, userId) {
  const [coverage, lastRun] = await Promise.all([
    deps.store.coverage(userId),
    deps.store.getLatestRun(userId)
  ]);
  return { coverage, lastRun };
}

export { getSidecarLog as a, getSyncStatus as b, cancelSync as c, getCoverage as g, triggerSync as t };
//# sourceMappingURL=sync.api.js-WZxo88-X.js.map
