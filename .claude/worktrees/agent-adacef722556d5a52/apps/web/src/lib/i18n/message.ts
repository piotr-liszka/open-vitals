/**
 * The shape of one catalog entry (spec 076).
 *
 * Most messages are a plain string. A message whose wording depends on a count is written as its
 * plural forms instead — never as `n === 1 ? 'dzień' : 'dni'`, which is correct in English and wrong
 * in Polish, where 2 dni, 5 dni and 22 dni are three different grammatical cases.
 */

/**
 * Plural forms, named after the CLDR categories `Intl.PluralRules` selects.
 *
 * `other` is the only required form because it is the one every locale has: English uses
 * `one`/`other`, Polish uses `one`/`few`/`many` (and `other` for fractions). A locale asking for a
 * form the message does not define falls back to `other`, so an under-specified message degrades to
 * readable text instead of `undefined`.
 */
export interface PluralMessage {
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
  readonly other: string;
}

export type Message = string | PluralMessage;

/** Values interpolated into `{placeholder}` slots. Numbers are formatted by the caller, not here. */
export type TranslateParams = Readonly<Record<string, string | number>>;

export function isPluralMessage(message: Message): message is PluralMessage {
  return typeof message !== 'string';
}
