/**
 * Catalog parity (spec 076). TypeScript already forces `en` to cover every `pl` key, but it cannot
 * see *inside* a message — an empty string, a dropped `{placeholder}` or a plural written as a
 * plain string all type-check and then render wrong. These are the checks the type system can't do.
 */
import { describe, expect, it } from 'vitest';
import { isPluralMessage, type Message } from '../message';
import { en, pl } from './index';

type Entry = readonly [string, Message];

const plEntries = Object.entries(pl) as Entry[];
const enEntries = Object.entries(en) as Entry[];

/** Every string a message can render, whether it is plain or a set of plural forms. */
function forms(message: Message): string[] {
  return isPluralMessage(message)
    ? Object.values(message).filter((form): form is string => typeof form === 'string')
    : [message];
}

/** The `{placeholder}` names a message interpolates, deduplicated and sorted. */
function placeholders(message: Message): string[] {
  const found = new Set<string>();
  for (const form of forms(message)) {
    for (const match of form.matchAll(/\{(\w+)\}/g)) found.add(match[1]!);
  }
  return [...found].sort();
}

describe('catalog parity', () => {
  it('covers exactly the same keys in both languages', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(pl).sort());
  });

  it('has no blank messages', () => {
    const blank = [...plEntries, ...enEntries]
      .filter(([, message]) => forms(message).some((form) => form.trim() === ''))
      .map(([key]) => key);
    expect(blank).toEqual([]);
  });

  it('interpolates the same params in both languages', () => {
    // A translation that drops `{count}` silently loses the number it was supposed to show.
    const mismatched = plEntries
      .filter(([key, message]) => {
        const other = en[key as keyof typeof en];
        return other !== undefined && placeholders(message).join() !== placeholders(other).join();
      })
      .map(([key]) => key);
    expect(mismatched).toEqual([]);
  });

  it('keeps plural messages plural in both languages', () => {
    const mismatched = plEntries
      .filter(([key, message]) => {
        const other = en[key as keyof typeof en];
        return other !== undefined && isPluralMessage(message) !== isPluralMessage(other);
      })
      .map(([key]) => key);
    expect(mismatched).toEqual([]);
  });

  it('gives every plural message an `other` form, the one form every locale has', () => {
    const incomplete = [...plEntries, ...enEntries]
      .filter(([, message]) => isPluralMessage(message) && !message.other)
      .map(([key]) => key);
    expect(incomplete).toEqual([]);
  });

  it('leaves no Polish text in the English catalog', () => {
    // The cheapest possible check for a key that was copied across and never translated.
    const untranslated = enEntries
      .filter(([, message]) => forms(message).some((form) => /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(form)))
      .map(([key]) => key);
    expect(untranslated).toEqual([]);
  });
});
