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

describe('sport-labels', () => {
  it('has unique keys', () => {
    const keys = SPORT_LABELS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('labels the sports the old per-component maps covered', () => {
    expect(sportLabel('cycling')).toBe('Rower');
    expect(sportLabel('virtual_ride')).toBe('Rower wirtualny');
    expect(sportLabel('road_biking')).toBe('Rower szosowy');
    expect(sportLabel('mountain_biking')).toBe('Rower górski');
    expect(sportLabel('gravel_cycling')).toBe('Gravel');
    expect(sportLabel('running')).toBe('Bieg');
    expect(sportLabel('trail_running')).toBe('Bieg terenowy');
    expect(sportLabel('treadmill_running')).toBe('Bieżnia');
    expect(sportLabel('walking')).toBe('Marsz');
    expect(sportLabel('hiking')).toBe('Wędrówka');
    expect(sportLabel('swimming')).toBe('Pływanie');
    expect(sportLabel('strength_training')).toBe('Siłownia');
  });

  it('translates the keys the user reported as untranslated', () => {
    expect(sportLabel('indoor_cardio')).toBe('Trening cardio');
    expect(sportLabel('indoor_cycling')).toBe('Rower stacjonarny');
    expect(sportLabel('indoor_rowing')).toBe('Wioślarstwo (ergometr)');
    expect(sportLabel('inline_skating')).toBe('Rolki');
  });

  it('keeps indoor/outdoor variants distinct so chips never duplicate', () => {
    const swims = ['swimming', 'lap_swimming', 'open_water_swimming'].map(sportLabel);
    expect(new Set(swims).size).toBe(3);
    expect(sportLabel('lap_swimming')).toBe('Pływanie (basen)');
    expect(sportLabel('open_water_swimming')).toBe('Pływanie (wody otwarte)');
    expect(sportLabel('running')).not.toBe(sportLabel('treadmill_running'));
    expect(sportLabel('cycling')).not.toBe(sportLabel('indoor_cycling'));
  });

  it('falls back to a humanised label instead of a raw snake_case key', () => {
    expect(sportLabel('some_new_garmin_sport')).toBe('Some new garmin sport');
    expect(humanizeSportKey('inline-skating')).toBe('Inline skating');
    expect(humanizeSportKey('')).toBe('Inne');
    expect(sportLabel('unknown')).not.toContain('_');
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
    expect(sportGroupLabel('ride')).toBe('Rower');
    expect(sportGroupLabel('run')).toBe('Bieg');
    expect(sportGroupLabel('walk')).toBe('Marsz');
    expect(sportGroupLabel('other')).toBe('Inne');
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
    expect(sportMeta('cycling')).toEqual({ key: 'cycling', label: 'Rower', group: 'ride' });
    expect(sportMeta('nope')).toBeUndefined();
  });
});
