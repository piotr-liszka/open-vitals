/**
 * i18n public surface (spec 076). Import from `$lib/i18n`, never from its internals.
 *
 * Two entry points, by side:
 * - **Components** call `getI18n()` and use `t` / `locale` from the context the root layout set.
 * - **Server code** (hooks, loaders, API handlers) calls `createTranslator(locals.locale)` directly,
 *   because there is no component tree there.
 */
export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_SETTING_KEY,
  intlLocale,
  isLocale,
  negotiateLocale,
  resolveLocale
} from './locale';
export type { Locale, LocaleSources } from './locale';

export { isPluralMessage } from './message';
export type { Message, PluralMessage, TranslateParams } from './message';

export { createTranslator } from './translate';
export type { MessageKey, Translator } from './translate';

export { getI18n, setI18nContext, translatorFor } from './context';
export type { I18nContext } from './context';

export { capitalize, formatDecimals, formatInteger, formatNumber, lowerCase, numberFormat } from './format';

export { CATALOGS } from './messages';
export type { Catalog } from './messages';
