/** Contracts shared by the sync/coverage API and its UI (specs 015, 019). */
import type { SidecarLogEntry } from '$lib/server/interfaces';
import type { CoverageSnapshot, SyncRun } from '$lib/server/store/types';

export type { SidecarLogEntry };

export interface SyncTriggerResponse {
  runId: string;
  status: SyncRun['status'];
  /** True when a run was already in flight and we returned that one instead of starting another. */
  alreadyRunning: boolean;
}

/** What the last background tick did: real work, or a fast return on an unchanged probe (spec 027). */
export type SyncCheckResult = 'synced' | 'unchanged';

/** The background scheduler's cadence, as reported to the UI (spec 027). */
export interface AutoSyncStatus {
  intervalMs: number;
  /** ISO instant the next automatic tick is due, or null when the handle cannot say. */
  nextRunAt: string | null;
}

export interface SyncStatusResponse {
  run: SyncRun | null;
  /** 0..1 progress for the bar (done/total, clamped). */
  progress: number;
  /** ISO instant of the last sync that actually pulled data ("Ostatnia synchronizacja"). */
  lastSyncAt: string | null;
  /** ISO instant of the last check, INCLUDING ticks that fast-returned without syncing. */
  lastCheckAt: string | null;
  lastResult: SyncCheckResult | null;
  /** Null when no scheduler runs in this process (dev/mock, tests) — the UI then shows no countdown. */
  autoSync: AutoSyncStatus | null;
}

export interface CoverageResponse {
  coverage: CoverageSnapshot;
  lastRun: SyncRun | null;
}

/**
 * The sidecar's own log tail (spec 019). `available: false` is a real answer — `reason` then carries
 * the failure classification (`sidecar_unreachable`, `not_connected`, …), which is usually the very
 * diagnosis the user opened this panel for.
 */
export interface SidecarLogResponse {
  available: boolean;
  entries: SidecarLogEntry[];
  reason?: string;
  status?: number;
}
