/** ConsentService — pure resolver over a ConsentStore + the feature registry (spec 011). */
import { FEATURES } from './registry';
import {
  TermsVersionMismatchError,
  UnknownFeatureError,
  type ConsentRecords,
  type ConsentService,
  type ConsentStore,
  type Feature,
  type ResolvedFeature
} from './types';

export interface ConsentServiceDeps {
  store: ConsentStore;
  /** The user this service instance is scoped to — every store call is keyed by it. */
  userId: string;
  /** Defaults to the shipped registry; injectable for tests. */
  features?: readonly Feature[];
}

/** A feature is enabled if it needs no consent, or a record matches its CURRENT terms version. */
function resolve(feature: Feature, records: ConsentRecords): ResolvedFeature {
  const record = records[feature.id];
  const enabled = feature.requiresConsent
    ? record?.termsVersion === feature.termsVersion
    : feature.defaultEnabled;
  const base: ResolvedFeature = {
    id: feature.id,
    title: feature.title,
    summary: feature.summary,
    termsVersion: feature.termsVersion,
    termsText: feature.termsText,
    requiresConsent: feature.requiresConsent,
    enabled
  };
  // Only surface acceptedAt when it applies to the current terms version.
  return enabled && record?.termsVersion === feature.termsVersion && record?.acceptedAt
    ? { ...base, acceptedAt: record.acceptedAt }
    : base;
}

export function createConsentService(deps: ConsentServiceDeps): ConsentService {
  const features = deps.features ?? FEATURES;
  const { store, userId } = deps;
  const find = (id: string): Feature => {
    const f = features.find((x) => x.id === id);
    if (!f) throw new UnknownFeatureError(id);
    return f;
  };

  return {
    async listFeatures() {
      const records = await store.get(userId);
      return features.map((f) => resolve(f, records));
    },
    async isEnabled(featureId) {
      const feature = find(featureId);
      const records = await store.get(userId);
      return resolve(feature, records).enabled;
    },
    async accept(featureId, termsVersion) {
      const feature = find(featureId);
      if (termsVersion !== feature.termsVersion) throw new TermsVersionMismatchError();
      // Consent-free features need no record; report resolved state directly.
      if (feature.requiresConsent) await store.set(userId, featureId, termsVersion);
      return resolve(feature, await store.get(userId));
    },
    async revoke(featureId) {
      const feature = find(featureId);
      await store.revoke(userId, featureId);
      return resolve(feature, await store.get(userId));
    }
  };
}
