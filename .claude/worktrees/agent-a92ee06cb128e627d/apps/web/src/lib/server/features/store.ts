/**
 * FeatureStore adapters (spec 071).
 *  - `createPgFeatureStore`: rows in `feature_settings` keyed by (user_id, feature_id); parameterized
 *    queries only. Injected Clock so `updated_at` never comes from `Date.now()` inline.
 *  - `createMemoryFeatureStore`: in-memory, per-user, for tests.
 *
 * Rows hold NO secrets/PII/tokens. Unlike the consent table this replaces, a row means "the user set
 * this switch to X", not "the user accepted terms" — so an explicit `false` is a real, stored value.
 */
import type { Sql } from 'postgres';
import type { Clock } from '../clock';
import type { FeatureOverrides, FeatureStore } from './types';

interface FeatureRow {
  feature_id: string;
  enabled: boolean;
}

/** Postgres-backed FeatureStore. Overrides are keyed by (user_id, feature_id). */
export function createPgFeatureStore(sql: Sql, clock: Clock): FeatureStore {
  return {
    async get(userId) {
      const rows = await sql<FeatureRow[]>`
        SELECT feature_id, enabled FROM feature_settings WHERE user_id = ${userId}`;
      const out: FeatureOverrides = {};
      for (const row of rows) out[row.feature_id] = row.enabled;
      return out;
    },
    async set(userId, featureId, enabled) {
      const updatedAt = clock.now().toISOString();
      await sql`
        INSERT INTO feature_settings (user_id, feature_id, enabled, updated_at)
        VALUES (${userId}, ${featureId}, ${enabled}, ${updatedAt})
        ON CONFLICT (user_id, feature_id)
          DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = EXCLUDED.updated_at`;
    }
  };
}

/** In-memory, per-user FeatureStore for tests. `seed` maps userId → that user's overrides. */
export function createMemoryFeatureStore(seed: Record<string, FeatureOverrides> = {}): FeatureStore {
  const byUser = new Map<string, FeatureOverrides>();
  for (const [userId, overrides] of Object.entries(seed)) byUser.set(userId, { ...overrides });

  return {
    async get(userId) {
      return { ...(byUser.get(userId) ?? {}) };
    },
    async set(userId, featureId, enabled) {
      const current = byUser.get(userId) ?? {};
      current[featureId] = enabled;
      byUser.set(userId, current);
    }
  };
}
