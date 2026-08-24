/**
 * Reading and writing the athlete profile (spec 090).
 *
 * Storage is the existing per-user settings bag behind `SettingsRepo` — no new table, and the keys
 * are the ones `activity-detail.api.ts` already reads, so what this writes is what the analysis
 * picks up on the next page load.
 *
 * Two invariants worth stating:
 *
 * 1. **Merge, never replace.** The bag is shared with the language choice and the dashboard layout;
 *    saving a body weight must not wipe either.
 * 2. **A cleared field is a DELETED key**, not a stored `null`. Every consumer treats "absent" as
 *    "estimate it", so removing the key restores exactly the pre-090 behaviour rather than leaving a
 *    null behind for a future reader to trip over.
 */
import type { SettingsRepo, UserSettings } from '$lib/server/repo/types';
import { PROFILE_FIELDS, type AthleteProfile, type ProfileErrorResponse } from './profile.types';
import { parseProfile, readStoredProfile } from './profile.validate';

export type PutProfileResult =
  | { readonly ok: true; readonly body: AthleteProfile }
  | { readonly ok: false; readonly status: 400; readonly body: ProfileErrorResponse };

/** The user's profile, with every field they have not set reported as `null` ("estimate it"). */
export async function getProfile(settings: SettingsRepo, userId: string): Promise<AthleteProfile> {
  return readStoredProfile(await settings.get(userId));
}

/**
 * Validate and store the whole profile. Out of bounds → 400 with a reason per offending field, and
 * NOTHING written: the profile is saved as a unit, so a rejected weight cannot leave a new FTP
 * half-applied.
 */
export async function putProfile(
  settings: SettingsRepo,
  userId: string,
  body: unknown
): Promise<PutProfileResult> {
  const parsed = parseProfile(body);
  if (!parsed.ok) {
    return { ok: false, status: 400, body: { error: 'invalid_profile', fields: parsed.fields } };
  }

  const bag = await settings.get(userId);
  const next: UserSettings = { ...bag };
  for (const field of PROFILE_FIELDS) {
    const value = parsed.profile[field];
    if (value === null) delete next[field];
    else next[field] = value;
  }
  await settings.set(userId, next);

  return { ok: true, body: parsed.profile };
}
