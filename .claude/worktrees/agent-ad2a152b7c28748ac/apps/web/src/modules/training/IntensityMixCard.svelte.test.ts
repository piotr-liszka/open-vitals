import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import IntensityMixCard from './IntensityMixCard.svelte';
import type { IntensityMix, IntensityWeek } from './training.types';

afterEach(cleanup);

function mix(over: Partial<IntensityMix> = {}): IntensityMix {
  return {
    bands: [
      { band: 'easy', sessions: 8, seconds: 28_800, pct: 80, load: 320 },
      { band: 'moderate', sessions: 1, seconds: 3600, pct: 10, load: 60 },
      { band: 'hard', sessions: 1, seconds: 3600, pct: 10, load: 90 }
    ],
    easyPct: 80,
    unclassifiedSessions: 0,
    classifiedSessions: 10,
    verdict: 'on-model',
    advice: 'Rozkład intensywności jest zgodny z modelem spolaryzowanym.',
    maxHr: 190,
    ...over
  };
}

function week(over: Partial<IntensityWeek> = {}): IntensityWeek {
  return {
    week: '2026-04-27',
    moderateMinutes: 60,
    vigorousMinutes: 30,
    weightedMinutes: 120,
    metTarget: false,
    ...over
  };
}

const WEEKS: IntensityWeek[] = [week(), week({ week: '2026-05-04', weightedMinutes: 180, metTarget: true })];

describe('IntensityMixCard', () => {
  it('explains the absence instead of charting zeros without a max heart rate', () => {
    const { container, getByText } = render(IntensityMixCard, {
      props: {
        weeks: WEEKS,
        mix: mix({
          easyPct: null,
          maxHr: null,
          verdict: 'unknown',
          advice: 'Bez maksymalnego tętna nie da się zaklasyfikować intensywności.'
        })
      }
    });
    expect(getByText(/Bez maksymalnego tętna/)).toBeTruthy();
    expect(container.querySelector('.bands')).toBeNull();
    expect(getByText('Brak danych')).toBeTruthy();
  });

  it('headlines the easy share, which is the number the advice turns on', () => {
    const { container, getByText } = render(IntensityMixCard, { props: { mix: mix(), weeks: WEEKS } });
    expect(container.querySelector('.big')?.textContent).toContain('80');
    expect(getByText('czasu treningowego spokojnie')).toBeTruthy();
  });

  it('names the verdict and carries its advice', () => {
    const { getByText } = render(IntensityMixCard, {
      props: {
        weeks: WEEKS,
        mix: mix({ verdict: 'too-hard', easyPct: 55, advice: 'Zwolnij na spokojnych jednostkach.' })
      }
    });
    expect(getByText('Za mało spokojnie')).toBeTruthy();
    expect(getByText('Zwolnij na spokojnych jednostkach.')).toBeTruthy();
  });

  it('shows all three bands with time, session count and load', () => {
    const { container } = render(IntensityMixCard, { props: { mix: mix(), weeks: WEEKS } });
    const bands = [...container.querySelectorAll('.band')];
    expect(bands).toHaveLength(3);
    expect(bands[0]?.textContent).toContain('Spokojnie');
    expect(bands[0]?.textContent).toContain('8 h 0 min');
    expect(bands[0]?.textContent).toContain('obciążenie 320');
  });

  it('inflects a single session correctly', () => {
    const { container } = render(IntensityMixCard, {
      props: {
        weeks: WEEKS,
        mix: mix({
          bands: [
            { band: 'easy', sessions: 1, seconds: 3600, pct: 100, load: 0 },
            { band: 'moderate', sessions: 0, seconds: 0, pct: 0, load: 0 },
            { band: 'hard', sessions: 0, seconds: 0, pct: 0, load: 0 }
          ]
        })
      }
    });
    const text = container.querySelector('.band')?.textContent?.replace(/\s+/g, ' ');
    expect(text).toContain('1 jednostka');
    expect(text).not.toContain('jednostek');
  });

  it('says the shares are of classified time and reports what was skipped', () => {
    const { getByText } = render(IntensityMixCard, {
      props: { mix: mix({ unclassifiedSessions: 3 }), weeks: WEEKS }
    });
    expect(getByText(/nie jest wliczana jako spokojna/)).toBeTruthy();
    expect(getByText(/Pominięto 3 jednostek bez tętna/)).toBeTruthy();
  });

  it('warns that a band comes from the AVERAGE, so intervals land in the middle', () => {
    const { getByText } = render(IntensityMixCard, { props: { mix: mix(), weeks: WEEKS } });
    expect(getByText(/trening interwałowy wypada w środku/)).toBeTruthy();
  });

  it('names the thresholds and the max HR they were applied against', () => {
    const { getByText } = render(IntensityMixCard, { props: { mix: mix(), weeks: WEEKS } });
    expect(getByText(/maksymalnego 190 bpm/)).toBeTruthy();
  });

  describe('intensity minutes (spec 045)', () => {
    it('charts the weekly minutes against the WHO target and counts the weeks that met it', () => {
      const { container, getByText } = render(IntensityMixCard, {
        props: { mix: mix(), weeks: WEEKS }
      });
      expect(getByText('Minuty intensywności')).toBeTruthy();
      expect(getByText(/Cel osiągnięty w 1 z 2 tygodni/)).toBeTruthy();
      expect(container.querySelector('.minutes svg')).not.toBeNull();
    });

    it('says so plainly when no week reached the target', () => {
      const { getByText } = render(IntensityMixCard, {
        props: { mix: mix(), weeks: [week({ metTarget: false })] }
      });
      expect(getByText(/Żaden tydzień w tym okresie nie osiągnął celu/)).toBeTruthy();
    });

    it('explains that easy time earns no minutes — the difference from the volume chart', () => {
      const { getByText } = render(IntensityMixCard, { props: { mix: mix(), weeks: WEEKS } });
      expect(getByText(/spacer jest zdrowy, ale nie jest aktywnością/)).toBeTruthy();
    });

    it('hides the section when no week scored a qualifying minute', () => {
      const { container } = render(IntensityMixCard, {
        props: {
          mix: mix(),
          weeks: [week({ moderateMinutes: 0, vigorousMinutes: 0, weightedMinutes: 0 })]
        }
      });
      expect(container.querySelector('.minutes')).toBeNull();
    });
  });
});
