/**
 * Client-safe sport display metadata — the SINGLE source of truth for which Garmin activity
 * `typeKey`s exist and how they are grouped for sport-family filters. Lives outside
 * `$lib/server` so both Svelte components and API handlers can import it (spec 020).
 *
 * Before this module the same partial map was copy-pasted into six components with four different
 * key sets, so keys like `indoor_cardio` / `inline_skating` rendered as raw English and `swimming`
 * vs `lap_swimming` rendered as two identical chips. Mirrors the shape of `metric-labels.ts`.
 *
 * Keys are Garmin Connect `activityType.typeKey` values (see `sync/normalize.ts`, which falls back
 * to `other` when Garmin sends nothing usable).
 *
 * The DISPLAY NAMES live in the message catalog under `sport.<typeKey>` (spec 076), not here: this
 * module is imported by loaders that run before a language is known, and a name has to follow the
 * reader's. `sport-labels.test.ts` asserts every key below has an entry in both catalogs, so the
 * two files cannot drift apart.
 */
import type { MessageKey, Translator } from './i18n/translate';
import { capitalize, lowerCase } from './i18n/format';

/** Coarse sport family used by the training/running filters. */
export type SportGroup = 'run' | 'ride' | 'swim' | 'walk' | 'strength' | 'other';

export interface SportMeta {
  /** Garmin `activityType.typeKey`. */
  readonly key: string;
  readonly group: SportGroup;
}

/**
 * Every sport key we know about. Indoor variants stay DISTINCT from their outdoor counterparts —
 * collapsing them is what made two "Pływanie" chips appear side by side.
 */
export const SPORT_LABELS: readonly SportMeta[] = [
  /* ---- ride ---- */
  { key: 'cycling', group: 'ride' },
  { key: 'road_biking', group: 'ride' },
  { key: 'mountain_biking', group: 'ride' },
  { key: 'gravel_cycling', group: 'ride' },
  { key: 'cyclocross', group: 'ride' },
  { key: 'downhill_biking', group: 'ride' },
  { key: 'virtual_ride', group: 'ride' },
  { key: 'indoor_cycling', group: 'ride' },
  { key: 'track_cycling', group: 'ride' },
  { key: 'bmx', group: 'ride' },
  { key: 'recumbent_cycling', group: 'ride' },
  { key: 'handcycling', group: 'ride' },
  { key: 'indoor_handcycling', group: 'ride' },
  { key: 'e_bike_fitness', group: 'ride' },
  { key: 'e_bike_mountain', group: 'ride' },
  { key: 'ebikeride', group: 'ride' },

  /* ---- run ---- */
  { key: 'running', group: 'run' },
  { key: 'trail_running', group: 'run' },
  { key: 'street_running', group: 'run' },
  { key: 'track_running', group: 'run' },
  { key: 'treadmill_running', group: 'run' },
  { key: 'indoor_running', group: 'run' },
  { key: 'virtual_run', group: 'run' },
  { key: 'obstacle_run', group: 'run' },
  { key: 'ultra_run', group: 'run' },

  /* ---- swim ---- */
  { key: 'swimming', group: 'swim' },
  { key: 'lap_swimming', group: 'swim' },
  { key: 'open_water_swimming', group: 'swim' },

  /* ---- walk ---- */
  { key: 'walking', group: 'walk' },
  { key: 'casual_walking', group: 'walk' },
  { key: 'speed_walking', group: 'walk' },
  { key: 'indoor_walking', group: 'walk' },
  { key: 'hiking', group: 'walk' },
  { key: 'rucking', group: 'walk' },
  { key: 'mountaineering', group: 'walk' },

  /* ---- strength / gym ---- */
  { key: 'strength_training', group: 'strength' },
  { key: 'functional_strength', group: 'strength' },
  { key: 'indoor_cardio', group: 'strength' },
  { key: 'cardio_training', group: 'strength' },
  { key: 'hiit', group: 'strength' },
  { key: 'pilates', group: 'strength' },
  { key: 'elliptical', group: 'strength' },
  { key: 'stair_climbing', group: 'strength' },
  { key: 'indoor_rowing', group: 'strength' },

  /* ---- other ---- */
  { key: 'yoga', group: 'other' },
  { key: 'breathwork', group: 'other' },
  { key: 'meditation', group: 'other' },
  { key: 'stretching', group: 'other' },
  { key: 'rowing', group: 'other' },
  { key: 'kayaking', group: 'other' },
  { key: 'canoeing', group: 'other' },
  { key: 'stand_up_paddleboarding', group: 'other' },
  { key: 'whitewater_rafting', group: 'other' },
  { key: 'sailing', group: 'other' },
  { key: 'surfing', group: 'other' },
  { key: 'windsurfing', group: 'other' },
  { key: 'kitesurfing', group: 'other' },
  { key: 'inline_skating', group: 'other' },
  { key: 'skateboarding', group: 'other' },
  { key: 'ice_skating', group: 'other' },
  { key: 'skate_skiing', group: 'other' },
  { key: 'cross_country_skiing', group: 'other' },
  { key: 'cross_country_skiing_ws', group: 'other' },
  { key: 'backcountry_skiing', group: 'other' },
  { key: 'resort_skiing', group: 'other' },
  { key: 'resort_skiing_snowboarding_ws', group: 'other' },
  { key: 'snowboarding', group: 'other' },
  { key: 'snowshoeing', group: 'other' },
  { key: 'snowmobiling', group: 'other' },
  { key: 'rock_climbing', group: 'other' },
  { key: 'indoor_climbing', group: 'other' },
  { key: 'bouldering', group: 'other' },
  { key: 'tennis', group: 'other' },
  { key: 'table_tennis', group: 'other' },
  { key: 'padel', group: 'other' },
  { key: 'squash', group: 'other' },
  { key: 'badminton', group: 'other' },
  { key: 'soccer', group: 'other' },
  { key: 'basketball', group: 'other' },
  { key: 'volleyball', group: 'other' },
  { key: 'golf', group: 'other' },
  { key: 'boxing', group: 'other' },
  { key: 'horseback_riding', group: 'other' },
  { key: 'fishing', group: 'other' },
  { key: 'hunting', group: 'other' },
  { key: 'triathlon', group: 'other' },
  { key: 'multi_sport', group: 'other' },
  { key: 'transition', group: 'other' },
  { key: 'winter_sports', group: 'other' },
  { key: 'other', group: 'other' }
];

const BY_KEY: ReadonlyMap<string, SportMeta> = new Map(SPORT_LABELS.map((s) => [s.key, s]));

/**
 * Message key naming a whole sport family. Used by the training section's tabs and by the
 * "load per sport" split, so a family is never spelled differently in two places (spec 025).
 */
export function sportGroupLabelKey(group: SportGroup): MessageKey {
  return `sportGroup.${group}`;
}

const KEYS_BY_GROUP: ReadonlyMap<SportGroup, readonly string[]> = (() => {
  const m = new Map<SportGroup, string[]>();
  for (const s of SPORT_LABELS) {
    const bucket = m.get(s.group);
    if (bucket) bucket.push(s.key);
    else m.set(s.group, [s.key]);
  }
  return m;
})();

/**
 * Fallback for a key we don't know yet: `indoor_cardio` → `Indoor cardio`. Never returns a raw
 * snake_case key, so an unmapped Garmin sport still reads like a label. Untranslatable by nature —
 * it is Garmin's own identifier tidied up — but it is still cased in the reader's locale.
 */
export function humanizeSportKey(t: Translator, key: string): string {
  const words = lowerCase(t.locale, key.replace(/[_-]+/g, ' ').trim());
  if (words.length === 0) return t('sport.other');
  return capitalize(t.locale, words);
}

/** Display label for a Garmin sport key (graceful fallback for unknown keys). */
export function sportLabel(t: Translator, key: string): string {
  const meta = BY_KEY.get(key);
  return meta ? t(`sport.${meta.key}` as MessageKey) : humanizeSportKey(t, key);
}

/** Full metadata for a known key, `undefined` otherwise. */
export function sportMeta(key: string): SportMeta | undefined {
  return BY_KEY.get(key);
}

/** Sport family for filters (unknown keys are `other`). */
export function sportGroup(key: string): SportGroup {
  return BY_KEY.get(key)?.group ?? 'other';
}

/** Display name for a sport family. */
export function sportGroupLabel(t: Translator, group: SportGroup): string {
  return t(sportGroupLabelKey(group));
}

/**
 * Every sport family, in the order the taxonomy declares them. Declared explicitly now that the
 * families' NAMES live in the message catalog (spec 076) — the list is structure, and structure must
 * not be derived from a table of words in one language.
 */
export const SPORT_GROUPS: readonly SportGroup[] = ['ride', 'run', 'walk', 'swim', 'strength', 'other'];

/**
 * Narrow an untrusted string to a family (spec 060). Needed anywhere a family arrives from outside
 * the process — a request body, an MCP argument, a database column written by an older version —
 * since `sportGroup()` maps a *sport key* and would silently answer `other` for a bad family.
 */
export function isSportGroup(value: unknown): value is SportGroup {
  return typeof value === 'string' && (SPORT_GROUPS as readonly string[]).includes(value);
}

/**
 * One lane token per sport family (spec 037). Lives here rather than in a view because a family must
 * read the same colour on every chart in the app — the training overview and the volume page would
 * otherwise drift apart the first time either is edited.
 */
export const SPORT_GROUP_LANES: Readonly<Record<SportGroup, string>> = {
  ride: 'var(--lane-cyan)',
  run: 'var(--lane-orange)',
  walk: 'var(--lane-green)',
  swim: 'var(--lane-sky)',
  strength: 'var(--lane-violet)',
  other: 'var(--lane-amber)'
};

/** Lane token for a sport family. */
export function sportGroupLane(group: SportGroup): string {
  return SPORT_GROUP_LANES[group];
}

/**
 * Every KNOWN sport key in a family — the IN-list a store query filters on, so the database does
 * the family filter instead of the page loading all history and filtering in memory (spec 025).
 *
 * Caveat by construction: an unmapped Garmin key groups as `other` (see `sportGroup`) but cannot be
 * enumerated here, so filtering the store for `other` would silently miss it. Callers must filter
 * `other` in memory; `ride` / `run` / `walk` are exhaustive and safe.
 */
export function sportKeysInGroup(group: SportGroup): readonly string[] {
  return KEYS_BY_GROUP.get(group) ?? [];
}
