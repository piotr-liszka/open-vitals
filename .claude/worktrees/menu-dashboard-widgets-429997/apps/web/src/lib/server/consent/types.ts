/**
 * Consent & feature-gating ports (spec 011). A small feature registry + a consent store let some
 * features require explicit, versioned acceptance before they turn on, while stateless features
 * (MCP) stay consent-free. Consent records are plain preferences — NOT secrets — kept separate
 * from the encrypted Garmin token store.
 */

/** A gateable capability. The registry is the single source of truth for terms + version. */
export interface Feature {
  id: string;
  title: string;
  /** One line shown next to the toggle. */
  summary: string;
  /** Bumping this invalidates prior acceptances by construction (records store the version). */
  termsVersion: string;
  /** Full, plain-language terms shown before accepting. */
  termsText: string;
  /** When true, the feature is off until consent is recorded for the current termsVersion. */
  requiresConsent: boolean;
  /** Effective state for a `requiresConsent:false` feature. */
  defaultEnabled: boolean;
}

/** One stored acceptance. */
export interface ConsentRecord {
  termsVersion: string;
  /** ISO timestamp, from the injected clock — never `Date.now()` inline. */
  acceptedAt: string;
}

export type ConsentRecords = Record<string, ConsentRecord>;

/** A feature plus its resolved, user-facing status. */
export interface ResolvedFeature {
  id: string;
  title: string;
  summary: string;
  termsVersion: string;
  termsText: string;
  requiresConsent: boolean;
  enabled: boolean;
  acceptedAt?: string;
}

/**
 * Port: per-user persistence of consent records (spec 012). Every operation is scoped to a
 * `userId` so one user's acceptances never leak into another's. Adapters: pg-backed (prod) +
 * in-memory (tests).
 */
export interface ConsentStore {
  get(userId: string): Promise<ConsentRecords>;
  set(userId: string, featureId: string, termsVersion: string): Promise<void>;
  revoke(userId: string, featureId: string): Promise<void>;
}

/** Pure resolver over the store + registry. */
export interface ConsentService {
  listFeatures(): Promise<ResolvedFeature[]>;
  isEnabled(featureId: string): Promise<boolean>;
  /** Record acceptance; throws on unknown feature or a stale/mismatched termsVersion. */
  accept(featureId: string, termsVersion: string): Promise<ResolvedFeature>;
  /** Clear a feature's acceptance (no-op for consent-free features). */
  revoke(featureId: string): Promise<ResolvedFeature>;
}

export class UnknownFeatureError extends Error {
  constructor(featureId: string) {
    super(`unknown feature: ${featureId}`);
    this.name = 'UnknownFeatureError';
  }
}

export class TermsVersionMismatchError extends Error {
  constructor() {
    super('terms version mismatch — re-fetch the current terms before accepting');
    this.name = 'TermsVersionMismatchError';
  }
}
