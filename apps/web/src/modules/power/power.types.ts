/** Contracts for the Power Profile slice (PWRX §5). Shared by the API handler and the view. */
import type { SportGroup } from '$lib/sport-labels';
import type { Locale } from '$lib/i18n';
import type {
  BestPowerEntry,
  PowerCurvePoint,
  PowerProfile,
  PowerZone,
  RiderAxis,
  YearCurve
} from '$lib/server/analytics/power-profile';

export type {
  BestPowerEntry,
  PowerCurvePoint,
  PowerProfile,
  PowerZone,
  RiderAxis,
  RiderAxisKey,
  YearCurve
} from '$lib/server/analytics/power-profile';

/** The full profile plus where the athlete weight came from. */
export interface PowerData extends PowerProfile {
  /** Weight provenance: from settings, derived from the latest weigh-in, or unknown. */
  readonly weightSource: 'settings' | 'measured' | null;
}

export interface PowerRequest {
  readonly userId: string;
  /**
   * Restrict the profile to one sport family (spec 025). The cycling page passes `ride`, which is
   * what stops a running-power activity from landing in the rider-type radar. Omit for every sport.
   */
  readonly group?: SportGroup;
  /**
   * The reader's locale (spec 076) — resolves the rider-radar spoke labels and Coggan zone names.
   * Optional so every non-web caller (tests, MCP tools) keeps compiling unchanged, defaulting to the
   * Polish catalog. Only the real web route passes the actual locale.
   */
  readonly locale?: Locale;
}

// Re-exported below the type block so consumers only import from the module contract.
export type PowerBests = BestPowerEntry[];
export type PowerCurve = PowerCurvePoint[];
export type PowerZones = PowerZone[];
export type PowerRadar = RiderAxis[];
export type PowerYearCurves = YearCurve[];
