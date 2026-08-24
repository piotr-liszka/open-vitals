/** Contracts for the Power Profile slice (PWRX §5). Shared by the API handler and the view. */
import type { SportGroup } from '$lib/sport-labels';
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
}

// Re-exported below the type block so consumers only import from the module contract.
export type PowerBests = BestPowerEntry[];
export type PowerCurve = PowerCurvePoint[];
export type PowerZones = PowerZone[];
export type PowerRadar = RiderAxis[];
export type PowerYearCurves = YearCurve[];
