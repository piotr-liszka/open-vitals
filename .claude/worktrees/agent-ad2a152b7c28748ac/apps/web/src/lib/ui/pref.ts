/**
 * Device-level VIEW preferences (spec 032) — layout choices that belong to this browser, not to the
 * user's account: which way the timeline runs, which chart mode was last open, and so on.
 *
 * Deliberately `localStorage` and not the server: there is no round-trip, no DB column and no
 * per-request read for something that only affects how one device draws a card. Nothing here may
 * ever hold user data — keys are opinions about pixels.
 *
 * The storage is a parameter (defaulting to the real `localStorage` when one exists) so the helpers
 * stay pure enough to unit-test in node, and so every access is wrapped: Safari private mode, a
 * disabled-storage policy and a full quota all *throw* on plain `localStorage` access, and a view
 * preference must never be able to break a page.
 */

/** The slice of `Storage` we use. Any object with these two methods works (tests pass a fake). */
export interface PrefStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The ambient store, or `null` when there is none (SSR) or touching it throws (private mode). */
function ambientStorage(): PrefStorage | null {
  try {
    const store = (globalThis as { localStorage?: PrefStorage }).localStorage;
    return store ?? null;
  } catch {
    return null;
  }
}

/**
 * Read a preference constrained to a known set of values. Anything else — absent key, a value from
 * an older version of the app, hand-edited junk — yields `fallback`.
 */
export function readEnumPref<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
  storage: PrefStorage | null = ambientStorage()
): T {
  if (!storage) return fallback;
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return fallback;
  }
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

/**
 * Read an on/off preference — "is this section expanded", "is that column shown". Stored as the
 * strings `'1'`/`'0'` so it reads the same as every other pref and an unknown value falls back
 * instead of coercing (`Boolean('false')` is `true`, which is exactly the bug this avoids).
 */
export function readBoolPref(
  key: string,
  fallback: boolean,
  storage: PrefStorage | null = ambientStorage()
): boolean {
  return readEnumPref(key, ['1', '0'] as const, fallback ? '1' : '0', storage) === '1';
}

/** Write an on/off preference in the form `readBoolPref` expects. */
export function writeBoolPref(
  key: string,
  value: boolean,
  storage: PrefStorage | null = ambientStorage()
): void {
  writePref(key, value ? '1' : '0', storage);
}

/** Write a preference. A failing store (quota, private mode) is not an error worth surfacing. */
export function writePref(key: string, value: string, storage: PrefStorage | null = ambientStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // Preference not persisted; the in-memory choice still applies for this session.
  }
}
