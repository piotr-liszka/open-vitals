/** Contract shared by the health-check UI and API. */
export interface HealthStatus {
  /** True when Garmin tokens are present and valid. */
  connected: boolean;
  displayName: string | null;
  /** ISO expiry of the Garmin session, if known. */
  expiresAt: string | null;
  /** False when the sidecar could not be reached at all. */
  reachable: boolean;
}
