/** Contracts shared by the integrations API handlers and the IntegrationsPanel UI. */
import type { IntegrationProvider } from '$lib/server/integrations/types';
import type { StravaLink } from '$lib/server/integrations/matching';

export type { IntegrationProvider, StravaLink };

/** Connection + provenance summary for the Strava card. */
export interface StravaStatus {
  readonly connected: boolean;
  readonly athleteId: string | null;
  /** How many Garmin activities currently carry a Strava link. */
  readonly linkedCount: number;
}

/** Connection + provenance summary for the Withings card. */
export interface WithingsStatus {
  readonly connected: boolean;
  /** Weigh-ins in the store that came from Withings. */
  readonly weightCount: number;
  readonly firstDay: string | null;
  readonly lastDay: string | null;
}

export interface IntegrationsStatus {
  readonly strava: StravaStatus;
  readonly withings: WithingsStatus;
}

/** The short-lived OAuth transaction stashed in httpOnly cookies between begin- and complete-auth. */
export interface IntegrationTransaction {
  readonly state: string;
  readonly codeVerifier: string;
}

export interface BeginAuthResult {
  /** Provider (or, in mock mode, our own callback) URL to redirect the browser to. */
  readonly location: string;
  readonly transaction: IntegrationTransaction;
}

export interface CompleteAuthResult {
  readonly ok: boolean;
  readonly provider: IntegrationProvider;
  /** User-facing (localized) error when `ok` is false. Never contains secrets. */
  readonly error?: string;
}

export type SyncActionResult =
  | {
      readonly provider: 'withings';
      readonly imported: number;
      readonly firstDay: string | null;
      readonly lastDay: string | null;
    }
  | {
      readonly provider: 'strava';
      readonly scanned: number;
      readonly matched: number;
      readonly links: readonly StravaLink[];
    };
