/**
 * Locale-aware number formatting (spec 076).
 *
 * Before this file the app constructed `new Intl.NumberFormat('pl-PL', …)` in about forty places,
 * which is both a duplicated decision and a hidden one: switching language would have left every
 * number reading `1 234,5` in an English UI. Formatters are built with an **explicit** locale tag
 * and memoized, so output never depends on the server's ambient locale — the same input renders the
 * same way in SSR and in the browser, which is what keeps hydration quiet.
 *
 * Units are NOT converted: kilometres, metres, kilograms and °C stay metric in both languages
 * (spec 076) — `en-GB` is the tag precisely because it agrees with that.
 */
import { intlLocale, type Locale } from './locale';

const numberFormatters = new Map<string, Intl.NumberFormat>();

/** A memoized `Intl.NumberFormat`. Options are part of the cache key, so callers can pass any shape. */
export function numberFormat(locale: Locale, options?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const cacheKey = `${locale}|${options ? JSON.stringify(options) : ''}`;
  let fmt = numberFormatters.get(cacheKey);
  if (!fmt) {
    fmt = new Intl.NumberFormat(intlLocale(locale), options);
    numberFormatters.set(cacheKey, fmt);
  }
  return fmt;
}

/**
 * Format a number in the active locale. A non-finite value renders as `'—'` rather than `NaN`: an
 * absent measurement is a normal state in this app (a day Garmin has no data for), not an error.
 */
export function formatNumber(
  locale: Locale,
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions
): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return numberFormat(locale, options).format(value);
}

/** Format with a fixed number of decimals — the common case for paces, ratios and efficiency. */
export function formatDecimals(locale: Locale, value: number | null | undefined, decimals: number): string {
  return formatNumber(locale, value, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/** Format as a whole number — distances in metres, step counts, calories. */
export function formatInteger(locale: Locale, value: number | null | undefined): string {
  return formatNumber(locale, value, { maximumFractionDigits: 0 });
}

/**
 * Lowercase in the active locale. Matters for Polish, where `İ`/`I` casing rules differ from the
 * invariant ones, and it is the reason `toLocaleLowerCase` exists at all.
 */
export function lowerCase(locale: Locale, value: string): string {
  return value.toLocaleLowerCase(intlLocale(locale));
}

/** Uppercase the first character in the active locale, leaving the rest untouched. */
export function capitalize(locale: Locale, value: string): string {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase(intlLocale(locale)) + value.slice(1);
}
