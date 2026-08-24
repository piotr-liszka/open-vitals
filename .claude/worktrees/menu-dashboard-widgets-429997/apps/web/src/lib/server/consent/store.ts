/**
 * ConsentStore adapters (spec 011 semantics, spec 012 per-user persistence).
 *  - `createPgConsentStore`: rows in the `consents` table keyed by (user_id, feature_id); parameterized
 *    queries only. Injected Clock so `accepted_at` never comes from `Date.now()` inline.
 *  - `createMemoryConsentStore`: in-memory, per-user, for tests.
 * Consent records hold NO secrets/PII/tokens — safe to store unencrypted, separate from the token store.
 */
import type { Sql } from 'postgres';
import type { Clock } from '../clock';
import type { ConsentRecords, ConsentStore } from './types';

interface ConsentRow {
  feature_id: string;
  terms_version: string;
  accepted_at: Date | string;
}

/** Postgres-backed ConsentStore. Records are keyed by (user_id, feature_id). */
export function createPgConsentStore(sql: Sql, clock: Clock): ConsentStore {
  return {
    async get(userId) {
      const rows = await sql<ConsentRow[]>`
        SELECT feature_id, terms_version, accepted_at FROM consents WHERE user_id = ${userId}`;
      const out: ConsentRecords = {};
      for (const row of rows) {
        out[row.feature_id] = {
          termsVersion: row.terms_version,
          acceptedAt:
            row.accepted_at instanceof Date ? row.accepted_at.toISOString() : String(row.accepted_at)
        };
      }
      return out;
    },
    async set(userId, featureId, termsVersion) {
      const acceptedAt = clock.now().toISOString();
      await sql`
        INSERT INTO consents (user_id, feature_id, terms_version, accepted_at)
        VALUES (${userId}, ${featureId}, ${termsVersion}, ${acceptedAt})
        ON CONFLICT (user_id, feature_id)
          DO UPDATE SET terms_version = EXCLUDED.terms_version, accepted_at = EXCLUDED.accepted_at`;
    },
    async revoke(userId, featureId) {
      await sql`DELETE FROM consents WHERE user_id = ${userId} AND feature_id = ${featureId}`;
    }
  };
}

/** In-memory, per-user ConsentStore for tests. `seed` maps userId → that user's initial records. */
export function createMemoryConsentStore(
  clock: Clock,
  seed: Record<string, ConsentRecords> = {}
): ConsentStore {
  const byUser = new Map<string, ConsentRecords>();
  for (const [userId, records] of Object.entries(seed)) byUser.set(userId, { ...records });

  const forUser = (userId: string): ConsentRecords => {
    let records = byUser.get(userId);
    if (!records) {
      records = {};
      byUser.set(userId, records);
    }
    return records;
  };

  return {
    async get(userId) {
      return { ...(byUser.get(userId) ?? {}) };
    },
    async set(userId, featureId, termsVersion) {
      forUser(userId)[featureId] = { termsVersion, acceptedAt: clock.now().toISOString() };
    },
    async revoke(userId, featureId) {
      delete forUser(userId)[featureId];
    }
  };
}
