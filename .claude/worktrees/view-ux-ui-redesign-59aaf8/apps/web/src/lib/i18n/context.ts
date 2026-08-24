/**
 * How a component gets the active language (spec 076).
 *
 * **Context, not a module-level store.** The Node server renders every user's pages in one process,
 * so a module-scoped `$state` holding "the current locale" is shared across concurrent requests —
 * one user's language would bleed into another user's SSR output. Context is per component tree,
 * which is per request, which is the only correct scope for this.
 *
 * The stored value exposes `locale`/`t` as **getters** over a caller-supplied source function rather
 * than as frozen fields, so when the root layout's `data.locale` changes after a switch, every
 * consumer re-reads it and re-renders — no per-component subscription, no manual invalidation.
 */
import { getContext, setContext } from 'svelte';
import { DEFAULT_LOCALE, type Locale } from './locale';
import { createTranslator, type Translator } from './translate';

const I18N_KEY = Symbol('vagus:i18n');

export interface I18nContext {
  readonly locale: Locale;
  readonly t: Translator;
}

/** One translator per locale — the getter below runs on every read, so it must be cheap. */
const translators = new Map<Locale, Translator>();

export function translatorFor(locale: Locale): Translator {
  let translator = translators.get(locale);
  if (!translator) {
    translator = createTranslator(locale);
    translators.set(locale, translator);
  }
  return translator;
}

/**
 * Publish the active locale to the component tree. Called once, by the root layout, with a function
 * that reads the reactive locale (`() => data.locale`).
 */
export function setI18nContext(source: () => Locale): void {
  const context: I18nContext = {
    get locale() {
      return source();
    },
    get t() {
      return translatorFor(source());
    }
  };
  setContext(I18N_KEY, context);
}

/**
 * The default-locale context, used when no ancestor set one. That happens in component unit tests,
 * which mount a single component with no layout above it — falling back keeps those tests mounting
 * instead of forcing every one of them to wrap the subject in a provider.
 */
const FALLBACK: I18nContext = {
  get locale() {
    return DEFAULT_LOCALE;
  },
  get t() {
    return translatorFor(DEFAULT_LOCALE);
  }
};

/** Read the active locale and translator. Safe to call from any component. */
export function getI18n(): I18nContext {
  return getContext<I18nContext | undefined>(I18N_KEY) ?? FALLBACK;
}
