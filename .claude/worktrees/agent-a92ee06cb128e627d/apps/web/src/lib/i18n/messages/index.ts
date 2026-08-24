/**
 * The catalog registry (spec 076).
 *
 * `pl` is the **source of truth**: the key union is derived from it, and `en.ts` is typed against
 * that union, so adding a Polish message without its English counterpart fails `pnpm run check`
 * rather than rendering a blank label in production.
 */
import type { Message } from '../message';
import type { Locale } from '../locale';
import { pl } from './pl';
import { en } from './en';

/** Every message key the app can render. Derived from the Polish catalog, never written by hand. */
export type MessageKey = keyof typeof pl;

/** A complete catalog: every key the Polish one defines, translated. */
export type Catalog = Readonly<Record<MessageKey, Message>>;

export const CATALOGS: Readonly<Record<Locale, Catalog>> = { pl, en };

export { pl, en };
