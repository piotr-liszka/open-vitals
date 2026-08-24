/** FeatureService — pure resolver over a FeatureStore + the switch registry (spec 071). */
import { FEATURES } from './registry';
import {
  UnknownFeatureError,
  type Feature,
  type FeatureOverrides,
  type FeatureService,
  type FeatureStore,
  type ResolvedFeature
} from './types';

export interface FeatureServiceDeps {
  store: FeatureStore;
  /** The user this service instance is scoped to — every store call is keyed by it. */
  userId: string;
  /** Defaults to the shipped registry; injectable for tests. */
  features?: readonly Feature[];
}

/** A stored override wins; otherwise the registry default. */
function resolve(feature: Feature, overrides: FeatureOverrides): ResolvedFeature {
  return { ...feature, enabled: overrides[feature.id] ?? feature.defaultEnabled };
}

export function createFeatureService(deps: FeatureServiceDeps): FeatureService {
  const features = deps.features ?? FEATURES;
  const { store, userId } = deps;
  const find = (id: string): Feature => {
    const f = features.find((x) => x.id === id);
    if (!f) throw new UnknownFeatureError(id);
    return f;
  };

  return {
    async list() {
      const overrides = await store.get(userId);
      return features.map((f) => resolve(f, overrides));
    },
    async isEnabled(featureId) {
      const feature = find(featureId);
      return resolve(feature, await store.get(userId)).enabled;
    },
    async setEnabled(featureId, enabled) {
      const feature = find(featureId);
      // Written even when it matches the default: a switch the user deliberately left alone and one
      // they deliberately set to the same value are the same to us, and storing both keeps the
      // resolution rule a single line.
      await store.set(userId, featureId, enabled);
      return resolve(feature, await store.get(userId));
    }
  };
}
