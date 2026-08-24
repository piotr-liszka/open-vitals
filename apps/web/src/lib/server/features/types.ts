/**
 * Feature switches (spec 071). Replaces the consent/terms machinery of spec 011.
 *
 * A switch is exactly what it looks like: a per-user boolean with a default. There is no terms text,
 * no version, and no acceptance — this is a self-hosted app whose only user is its owner, and asking
 * them to accept terms for their own data was ceremony, not protection.
 *
 * The one structural consequence: "off" must be STORED. The old consent store encoded off as
 * "row absent", which cannot express a switch that defaults ON and was deliberately turned off.
 */

import type { MessageKey } from '$lib/i18n';

/** Which integration card a switch belongs to on the Settings page. */
export type FeatureIntegration = 'garmin' | 'mcp';

/**
 * A switchable capability. The registry is the single source of truth.
 *
 * `titleKey`/`summaryKey` rather than plain strings (spec 076 follow-up): this shape is a JSON
 * contract that reaches the client (`FeatureView`), so a literal string here rendered directly would
 * never change with the reader's language. The catalog key does.
 */
export interface Feature {
  id: string;
  titleKey: MessageKey;
  /** One line shown next to the switch. */
  summaryKey: MessageKey;
  /** The card this switch renders under. */
  integration: FeatureIntegration;
  /** Effective state before the user has ever touched it. */
  defaultEnabled: boolean;
}

/** A feature plus the user's resolved state. */
export interface ResolvedFeature extends Feature {
  enabled: boolean;
}

/** Stored overrides, by feature id. A missing key means "never touched — use the default". */
export type FeatureOverrides = Record<string, boolean>;

/**
 * Port: per-user persistence of switch state (spec 012 isolation rules still apply — every call is
 * keyed by `userId`). Adapters: pg-backed (prod) + in-memory (tests). Holds no secrets or PII.
 */
export interface FeatureStore {
  get(userId: string): Promise<FeatureOverrides>;
  set(userId: string, featureId: string, enabled: boolean): Promise<void>;
}

/** Pure resolver over the store + registry, scoped to one user. */
export interface FeatureService {
  list(): Promise<ResolvedFeature[]>;
  isEnabled(featureId: string): Promise<boolean>;
  /** Persist a switch position; throws {@link UnknownFeatureError} for an id not in the registry. */
  setEnabled(featureId: string, enabled: boolean): Promise<ResolvedFeature>;
}

export class UnknownFeatureError extends Error {
  constructor(featureId: string) {
    super(`unknown feature: ${featureId}`);
    this.name = 'UnknownFeatureError';
  }
}
