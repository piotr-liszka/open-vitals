/**
 * Persisting an explicit language choice (spec 076).
 *
 * Two storage layers, on purpose:
 * - the **account** (`SettingsRepo`), so the choice follows the user to every device they sign in on;
 * - the **cookie**, so the very next server render is already correct, and so a visitor who has not
 *   signed in yet can still read the landing page in their language.
 *
 * The handler owns the account write and tells the route whether one happened; setting the cookie is
 * the route's job, because only it holds the `cookies` API.
 */
import { z } from 'zod';
import { LOCALES, LOCALE_SETTING_KEY, type Locale } from '$lib/i18n';
import type { SettingsRepo } from '$lib/server/repo/types';
import type { SetLocaleResponse } from './locale.types';

const setLocaleSchema = z.object({
  locale: z.enum(LOCALES)
});

export type SetLocaleResult =
  { ok: true; body: SetLocaleResponse } | { ok: false; status: 400; error: 'invalid_locale' };

/**
 * Validate a language choice and store it on the user's account when there is one.
 *
 * An anonymous caller is NOT an error: they get a 200 with `persisted: false`, and the route gives
 * them the cookie. Rejecting them with a 401 would mean the switch silently does nothing on the
 * login screen, which is exactly where someone who cannot read Polish first needs it.
 */
export async function setLocale(
  settings: SettingsRepo,
  userId: string | null,
  body: unknown
): Promise<SetLocaleResult> {
  const parsed = setLocaleSchema.safeParse(body);
  if (!parsed.success) return { ok: false, status: 400, error: 'invalid_locale' };

  const locale: Locale = parsed.data.locale;
  if (!userId) return { ok: true, body: { locale, persisted: false } };

  // Merge, never replace: the bag is shared with every other per-user setting, and a language
  // change must not wipe them.
  const current = await settings.get(userId);
  await settings.set(userId, { ...current, [LOCALE_SETTING_KEY]: locale });
  return { ok: true, body: { locale, persisted: true } };
}
