/**
 * The switch registry — single source of truth for what Settings can turn on and off (spec 071).
 *
 * Every switch here MUST have a consumer that reads it. A decorative toggle is worse than no toggle:
 * the `mcp` entry sat in this list for four specs while nothing on the `/mcp` path ever asked
 * whether it was on.
 */
import type { Feature, FeatureService } from './types';

export const FEATURES: readonly Feature[] = [
  {
    // Read by `runScheduledSync` (lib/server/sync/scheduler.ts).
    id: 'auto_sync',
    titleKey: 'features.autoSync.title',
    summaryKey: 'features.autoSync.summary',
    integration: 'garmin',
    defaultEnabled: true
  },
  {
    // Read by every workout WRITE path (spec 050) — authoring here and the push itself, manual or
    // automatic. Id kept from the consent era so existing rows keep meaning the same thing.
    // Spec 083 narrowed what it MEANS: permission to write at all, no longer a claim about timing.
    id: 'workout_write',
    titleKey: 'features.workoutWrite.title',
    summaryKey: 'features.workoutWrite.summary',
    integration: 'garmin',
    defaultEnabled: true
  },
  {
    // Read by the sync engine's push phase, and by nothing else (spec 083).
    id: 'workout_auto_push',
    titleKey: 'features.workoutAutoPush.title',
    summaryKey: 'features.workoutAutoPush.summary',
    integration: 'garmin',
    defaultEnabled: true
  },
  {
    // Read by `mcpGate` (lib/mcp/http.ts).
    id: 'mcp',
    titleKey: 'features.mcp.title',
    summaryKey: 'features.mcp.summary',
    integration: 'mcp',
    defaultEnabled: true
  }
] as const;

/** The switch every workout WRITE path checks (spec 050) — permission, not timing. */
export const WORKOUT_WRITE_FEATURE = 'workout_write';
/**
 * The switch the sync engine's push phase checks, on top of {@link WORKOUT_WRITE_FEATURE} (spec 083).
 * Off means sessions reach Garmin only when the athlete presses the button in the planner — which is
 * why the manual path must NOT consult this one.
 */
export const WORKOUT_AUTO_PUSH_FEATURE = 'workout_auto_push';
/** The switch the background scheduler checks per user (spec 071). */
export const AUTO_SYNC_FEATURE = 'auto_sync';
/** The switch `/mcp` checks for the resolved user (spec 071). */
export const MCP_FEATURE = 'mcp';

export function getFeature(id: string): Feature | undefined {
  return FEATURES.find((f) => f.id === id);
}

/**
 * Whether the SYNC may push workouts unasked (spec 083) — permission AND automation, in that order.
 *
 * A named function rather than an `&&` buried in the container, because the asymmetry is the whole
 * point and is easy to get backwards: the manual button checks only the first of these two.
 */
export async function autoWorkoutPushAllowed(features: FeatureService): Promise<boolean> {
  const [mayWrite, autoPush] = await Promise.all([
    features.isEnabled(WORKOUT_WRITE_FEATURE),
    features.isEnabled(WORKOUT_AUTO_PUSH_FEATURE)
  ]);
  return mayWrite && autoPush;
}
