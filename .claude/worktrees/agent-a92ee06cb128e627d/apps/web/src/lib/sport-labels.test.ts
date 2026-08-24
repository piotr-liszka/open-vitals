import { describe, it, expect } from 'vitest';
import {
  SPORT_LABELS,
  humanizeSportKey,
  sportGroup,
  sportGroupLabel,
  sportKeysInGroup,
  sportLabel,
  sportMeta
} from './sport-labels';
import { createTranslator } from '$lib/i18n';
import { en, pl } from '$lib/i18n/messages';

/** Every label now comes from the catalog, so the tests assert through a translator. */
const t = createTranslator('pl');

describe('sport-labels', () => {
  it('has unique keys', () => {
    const keys = SPORT_LABELS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('labels the sports the old per-component maps covered', () => {
    expect(sportLabel(t, 'cycling')).toBe('Rower');
    expect(sportLabel(t, 'virtual_ride')).toBe('Rower wirtualny');
    expect(sportLabel(t, 'road_biking')).toBe('Rower szosowy');
    expect(sportLabel(t, 'mountain_biking')).toBe('Rower górski');
    expect(sportLabel(t, 'gravel_cycling')).toBe('Gravel');
    expect(sportLabel(t, 'running')).toBe('Bieg');
    expect(sportLabel(t, 'trail_running')).toBe('Bieg terenowy');
    expect(sportLabel(t, 'treadmill_running')).toBe('Bieżnia');
    expect(sportLabel(t, 'walking')).toBe('Marsz');
    expect(sportLabel(t, 'hiking')).toBe('Wędrówka');
    expect(sportLabel(t, 'swimming')).toBe('Pływanie');
    expect(sportLabel(t, 'strength_training')).toBe('Siłownia');
  });

  it('translates the keys the user reported as untranslated', () => {
    expect(sportLabel(t, 'indoor_cardio')).toBe('Trening cardio');
    expect(sportLabel(t, 'indoor_cycling')).toBe('Rower stacjonarny');
    expect(sportLabel(t, 'indoor_rowing')).toBe('Wioślarstwo (ergometr)');
    expect(sportLabel(t, 'inline_skating')).toBe('Rolki');
  });

  it('keeps indoor/outdoor variants distinct so chips never duplicate', () => {
    const swims = ['swimming', 'lap_swimming', 'open_water_swimming'].map((key) => sportLabel(t, key));
    expect(new Set(swims).size).toBe(3);
    expect(sportLabel(t, 'lap_swimming')).toBe('Pływanie (basen)');
    expect(sportLabel(t, 'open_water_swimming')).toBe('Pływanie (wody otwarte)');
    expect(sportLabel(t, 'running')).not.toBe(sportLabel(t, 'treadmill_running'));
    expect(sportLabel(t, 'cycling')).not.toBe(sportLabel(t, 'indoor_cycling'));
  });

  it('falls back to a humanised label instead of a raw snake_case key', () => {
    expect(sportLabel(t, 'some_new_garmin_sport')).toBe('Some new garmin sport');
    expect(humanizeSportKey(t, 'inline-skating')).toBe('Inline skating');
    expect(humanizeSportKey(t, '')).toBe('Inne');
    expect(sportLabel(t, 'unknown')).not.toContain('_');
  });

  it('groups sports into families', () => {
    expect(sportGroup('cycling')).toBe('ride');
    expect(sportGroup('virtual_ride')).toBe('ride');
    expect(sportGroup('indoor_cycling')).toBe('ride');
    expect(sportGroup('running')).toBe('run');
    expect(sportGroup('treadmill_running')).toBe('run');
    expect(sportGroup('lap_swimming')).toBe('swim');
    expect(sportGroup('hiking')).toBe('walk');
    expect(sportGroup('strength_training')).toBe('strength');
    expect(sportGroup('inline_skating')).toBe('other');
    expect(sportGroup('totally_unknown')).toBe('other');
  });

  it('keeps the cycling/running families the training + running pages relied on', () => {
    const cycling = [
      'cycling',
      'virtual_ride',
      'road_biking',
      'mountain_biking',
      'gravel_cycling',
      'cyclocross',
      'indoor_cycling',
      'track_cycling',
      'e_bike_fitness',
      'ebikeride'
    ];
    const running = [
      'running',
      'trail_running',
      'treadmill_running',
      'virtual_run',
      'track_running',
      'indoor_running',
      'street_running'
    ];
    for (const k of cycling) expect(sportGroup(k)).toBe('ride');
    for (const k of running) expect(sportGroup(k)).toBe('run');
  });

  it('names each family in Polish (spec 024)', () => {
    expect(sportGroupLabel(t, 'ride')).toBe('Rower');
    expect(sportGroupLabel(t, 'run')).toBe('Bieg');
    expect(sportGroupLabel(t, 'walk')).toBe('Marsz');
    expect(sportGroupLabel(t, 'other')).toBe('Inne');
  });

  it('enumerates a family into the key list a store query filters on (spec 024)', () => {
    const rides = sportKeysInGroup('ride');
    expect(rides).toContain('cycling');
    expect(rides).toContain('virtual_ride');
    expect(rides).not.toContain('running');

    // The enumeration and `sportGroup` must never disagree — the store filter and the in-memory
    // grouping are derived from the same table, so a page cannot show a sport it filtered out.
    for (const group of ['ride', 'run', 'walk', 'swim', 'strength', 'other'] as const) {
      for (const key of sportKeysInGroup(group)) expect(sportGroup(key)).toBe(group);
      const expected = SPORT_LABELS.filter((s) => s.group === group).map((s) => s.key);
      expect([...sportKeysInGroup(group)].sort()).toEqual(expected.sort());
    }
  });

  it('exposes full metadata for known keys only', () => {
    // The label is no longer metadata — it lives in the catalog, keyed by this `key` (spec 076).
    expect(sportMeta('cycling')).toEqual({ key: 'cycling', group: 'ride' });
    expect(sportMeta('nope')).toBeUndefined();
  });
});

describe('catalog coverage', () => {
  it('has a message for every known sport key, in both languages', () => {
    // The module's doc comment promises this; without the check, adding a sport here and forgetting
    // the catalog would silently render the raw `sport.<key>` string at a reader.
    const missing = SPORT_LABELS.filter((sport) => {
      const key = `sport.${sport.key}`;
      return !(key in pl) || !(key in en);
    }).map((sport) => sport.key);
    expect(missing).toEqual([]);
  });

  it('has a message for every sport family', () => {
    const groups = [...new Set(SPORT_LABELS.map((s) => s.group))];
    const missing = groups.filter((g) => !(`sportGroup.${g}` in pl) || !(`sportGroup.${g}` in en));
    expect(missing).toEqual([]);
  });
});
