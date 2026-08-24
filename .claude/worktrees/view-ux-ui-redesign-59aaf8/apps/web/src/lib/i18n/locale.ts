/**
 * The locale primitive (spec 076) — what languages exist, how one is picked, and which BCP-47 tag
 * `Intl` should be handed.
 *
 * Deliberately dependency-free and pure: `negotiateLocale` and `resolveLocale` take their inputs as
 * arguments rather than reading a request, a cookie jar or `process.env`, so the precedence rules
 * unit-test without a server (AGENTS.md §4).
 */

/** Every language the UI ships. Polish is the source of truth for the copy; English mirrors it. */
export const LOCALES = ['pl', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

/** What an unresolvable request falls back to — this app was Polish first and stays Polish by default. */
export const DEFAULT_LOCALE: Locale = 'pl';

/** Name of the cookie mirroring the choice, so an anonymous visitor's switch survives a reload. */
export const LOCALE_COOKIE = 'gb-lang';

/** Key the choice occupies inside the per-user settings bag (`SettingsRepo`, spec 012). */
export const LOCALE_SETTING_KEY = 'locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * The BCP-47 tag every `Intl` formatter is constructed with.
 *
 * English is **en-GB**, not en-US: this is a European athlete's instrument — metric distances, a
 * 24-hour clock and day-first dates — and en-US would silently flip the clock to AM/PM and the date
 * to month-first while every unit around it stayed metric.
 */
const INTL_TAGS: Record<Locale, string> = {
  pl: 'pl-PL',
  en: 'en-GB'
};

/**
 * Defensive for the same reason `createTranslator` is: this is handed values that came from a
 * settings bag or a request. An unknown one must not become `new Intl.DateTimeFormat(undefined)`,
 * which silently formats in the SERVER's locale — a bug that only shows up in production.
 */
export function intlLocale(locale: Locale): string {
  return INTL_TAGS[locale] ?? INTL_TAGS[DEFAULT_LOCALE];
}

/**
 * Pick a locale from an `Accept-Language` header, honouring quality values and language-only tags
 * (`en-US` matches `en`). Returns `null` when the visitor asks for nothing we speak, so the caller
 * can fall through to the next source rather than being handed a default it cannot distinguish from
 * a real match.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale | null {
  if (!acceptLanguage) return null;

  const ranked = acceptLanguage
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params
        .map((p) => /^\s*q\s*=\s*([\d.]+)\s*$/i.exec(p))
        .find((m): m is RegExpExecArray => m !== null);
      const quality = q ? Number.parseFloat(q[1]!) : 1;
      return {
        // Only the primary subtag matters: `en-GB`, `en-US` and `en` are all English to us.
        language: tag!.trim().toLowerCase().split('-')[0] ?? '',
        // `q=0` means "explicitly not this one"; NaN from junk is treated the same way.
        quality: Number.isFinite(quality) ? quality : 0,
        index
      };
    })
    .filter((entry) => entry.quality > 0 && isLocale(entry.language))
    // Equal qualities keep header order, which is the client's own preference order.
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  return ranked.length > 0 ? (ranked[0]!.language as Locale) : null;
}

export interface LocaleSources {
  /** The signed-in user's stored setting (raw, straight out of the settings bag — may be anything). */
  stored?: unknown;
  /** The `gb-lang` cookie, for anonymous visitors and for the paint right after a switch. */
  cookie?: string | null;
  /** The request's `Accept-Language` header. */
  acceptLanguage?: string | null;
}

/**
 * Resolve the language for one request.
 *
 * Precedence — **account beats device beats browser**: an explicit choice stored on the user's
 * account wins everywhere they sign in, the cookie carries a choice made before signing in (or on a
 * device where the account setting has not been read yet), and only a visitor who has never chosen
 * gets what their browser asked for.
 *
 * Every source is validated, never trusted: a settings bag or a cookie can hold anything.
 */
export function resolveLocale({ stored, cookie, acceptLanguage }: LocaleSources = {}): Locale {
  if (isLocale(stored)) return stored;
  if (isLocale(cookie)) return cookie;
  return negotiateLocale(acceptLanguage) ?? DEFAULT_LOCALE;
}
