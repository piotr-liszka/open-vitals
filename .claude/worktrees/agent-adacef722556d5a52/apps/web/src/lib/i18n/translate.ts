/**
 * The translator (spec 076): a message key plus params in, a finished string out.
 *
 * Two rules shape this file:
 *
 * 1. **It never throws.** A label is not worth a 500 or a blank page, so an unknown key renders the
 *    key itself (visible in review, harmless in production) and an unfilled `{placeholder}` is left
 *    standing rather than becoming `undefined`.
 * 2. **Plurals come from `Intl.PluralRules`**, not from hand-written rules. Polish needs three forms
 *    and picks between them by the last one and two digits (1 dzień · 2–4 dni · 5–21 dni · 22–24
 *    dni · 25 dni); re-deriving that by hand is how "22 dni" becomes "22 dzień".
 */
import { CATALOGS, type MessageKey } from './messages';
import { isPluralMessage, type Message, type PluralMessage, type TranslateParams } from './message';
import { DEFAULT_LOCALE, intlLocale, type Locale } from './locale';

export interface Translator {
  (key: MessageKey, params?: TranslateParams): string;
  /** The locale this translator was built for — handy for `Intl` calls at the call site. */
  readonly locale: Locale;
}

/** `Intl.PluralRules` is not free to construct; one per locale is plenty. */
const pluralRules = new Map<Locale, Intl.PluralRules>();

function rulesFor(locale: Locale): Intl.PluralRules {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(intlLocale(locale) ?? intlLocale(DEFAULT_LOCALE));
    pluralRules.set(locale, rules);
  }
  return rules;
}

/**
 * Choose a plural form. `count` is required for a plural message — without it there is nothing to
 * select on, so we take `other`, the form every locale defines.
 */
function selectPlural(message: PluralMessage, locale: Locale, count: unknown): string {
  if (typeof count !== 'number' || !Number.isFinite(count)) return message.other;
  const category = rulesFor(locale).select(count);
  // `category` is a CLDR name; the message may legitimately omit forms this locale never selects.
  return message[category as keyof PluralMessage] ?? message.other;
}

/**
 * Fill `{name}` slots. An absent param leaves its placeholder visible instead of erasing the slot,
 * and a non-finite number counts as absent — "NaN dni" is worse than a visible `{count}`, because
 * the first looks like a measurement and the second looks like the bug it is.
 */
function interpolate(template: string, params: TranslateParams | undefined): string {
  if (!params || !template.includes('{')) return template;
  return template.replace(/\{(\w+)\}/g, (slot, name: string) => {
    const value = params[name];
    if (value === undefined) return slot;
    if (typeof value === 'number' && !Number.isFinite(value)) return slot;
    return String(value);
  });
}

/**
 * Build a translator bound to one locale.
 *
 * A missing message falls back to the Polish catalog before falling back to the key: Polish is the
 * source of truth, so a key that somehow escaped the English catalog still shows real words. In
 * practice TypeScript makes that unreachable — `en` is typed against `pl`'s key set, so an omission
 * fails `pnpm run check` — but the runtime should not depend on the type checker having run.
 */
export function createTranslator(locale: Locale): Translator {
  // `locale` is typed, but this is a boundary: it arrives from a settings bag, a cookie, a JSON
  // request body. An unknown value must degrade to the default catalog, not make every `t()` call
  // throw on an undefined lookup — "never throws" has to hold for bad input too, not just bad keys.
  const catalog = CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE];
  const fallback = CATALOGS[DEFAULT_LOCALE];

  const t = (key: MessageKey, params?: TranslateParams): string => {
    const message: Message | undefined = catalog[key] ?? fallback[key];
    if (message === undefined) return key;
    const text = isPluralMessage(message) ? selectPlural(message, locale, params?.count) : message;
    return interpolate(text, params);
  };

  return Object.assign(t, { locale }) as Translator;
}

export type { MessageKey };
