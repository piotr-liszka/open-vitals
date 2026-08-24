import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import RunnerProfileCard from './RunnerProfileCard.svelte';
import type { RunnerAxis, RunnerProfile } from './running.types';

afterEach(cleanup);

const AXES: RunnerAxis[] = [
  {
    key: 'speed',
    label: 'Szybkość',
    hint: 'h',
    score: 0.81,
    readout: '3:30 /km',
    basis: 'najlepsze 1 km',
    day: '2026-05-02'
  },
  {
    key: 'tempo',
    label: 'Tempo',
    hint: 'h',
    score: 0.57,
    readout: '5:00 /km',
    basis: 'najlepsze 5 km',
    day: '2026-06-11'
  },
  {
    key: 'endurance',
    label: 'Wytrzymałość',
    hint: 'h',
    score: null,
    readout: null,
    basis: 'brak biegu od 10 km w górę',
    day: null
  },
  {
    key: 'volume',
    label: 'Objętość',
    hint: 'h',
    score: 0.4,
    readout: '32,0 km/tyg.',
    basis: 'ostatnie 12 tyg.',
    day: null
  },
  {
    key: 'consistency',
    label: 'Regularność',
    hint: 'h',
    score: 0.72,
    readout: '2,5 biegu/tyg.',
    basis: '11 z 12 tyg. z biegiem',
    day: null
  }
];

function profile(over: Partial<RunnerProfile> = {}): RunnerProfile {
  return {
    axes: AXES,
    archetype: {
      key: 'speedster',
      label: 'Szybkościowiec',
      summary: 'Krótkie odcinki wychodzą Ci lepiej niż długie.'
    },
    strength: 'speed',
    weakness: 'volume',
    window: { weeks: 12, km: 384, runs: 30, activeWeeks: 11, avgKmPerWeek: 32, runsPerWeek: 2.5 },
    definedCount: 4,
    hasProfile: true,
    ...over
  };
}

function text(container: HTMLElement): string {
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('RunnerProfileCard', () => {
  it('names the archetype and explains it', () => {
    const { container } = render(RunnerProfileCard, { props: { profile: profile() } });
    expect(text(container)).toContain('Szybkościowiec');
    expect(text(container)).toContain('Krótkie odcinki wychodzą Ci lepiej');
  });

  it('draws the radar over the defined axes only', () => {
    const { container, getByRole } = render(RunnerProfileCard, { props: { profile: profile() } });
    getByRole('img', { name: 'Profil biegacza — pięć osi' });
    expect(container.querySelectorAll('.spoke').length).toBe(5);
    // Four defined axes ⇒ four polygon vertices; the missing one is dashed instead.
    expect(container.querySelector('polygon.shape')).toBeTruthy();
    expect(container.querySelectorAll('.spoke.missing').length).toBe(1);
  });

  it('lists every axis with its readout, basis and 0–100 score', () => {
    const { container } = render(RunnerProfileCard, { props: { profile: profile() } });
    const rows = Array.from(container.querySelectorAll('.axis')).map((n) =>
      (n.textContent ?? '').replace(/\s+/g, ' ').trim()
    );
    expect(rows).toHaveLength(5);
    expect(rows[0]).toContain('Szybkość');
    expect(rows[0]).toContain('najlepsze 1 km');
    expect(rows[0]).toContain('3:30 /km');
    expect(rows[0]).toContain('81/100');
    expect(rows[4]).toContain('2,5 biegu/tyg.');
  });

  it('says "brak danych" for an axis it could not compute — never a zero', () => {
    const { container } = render(RunnerProfileCard, { props: { profile: profile() } });
    const missing = container.querySelector('.axis.missing');
    expect(missing?.textContent).toContain('brak danych');
    expect(missing?.textContent).toContain('brak biegu od 10 km w górę');
    expect(missing?.textContent).not.toContain('0/100');
  });

  it('flags the strongest and weakest axis by name', () => {
    const { container } = render(RunnerProfileCard, { props: { profile: profile() } });
    expect(text(container)).toContain('Mocna strona: Szybkość');
    expect(text(container)).toContain('Do poprawy: Objętość');
  });

  it('states the reference scale and both time bases', () => {
    const { container } = render(RunnerProfileCard, { props: { profile: profile() } });
    const body = text(container);
    expect(body).toContain('Skala odniesienia');
    expect(body).toContain('rekordów życiowych');
    expect(body).toContain('z ostatnich 12 tygodni');
    expect(body).toContain('nie zero');
  });

  it('admits it cannot name a type yet, without hiding the axes it does have', () => {
    const { container } = render(RunnerProfileCard, {
      props: {
        profile: profile({
          axes: AXES.map((a) => (a.key === 'speed' ? a : { ...a, score: null, readout: null })),
          archetype: {
            key: 'unknown',
            label: 'Za mało danych',
            summary: 'Mamy za mało zsynchronizowanych biegów.'
          },
          strength: null,
          weakness: null,
          definedCount: 1,
          window: { weeks: 0, km: 0, runs: 0, activeWeeks: 0, avgKmPerWeek: null, runsPerWeek: null }
        })
      }
    });

    expect(text(container)).toContain('Za mało danych');
    expect(text(container)).not.toContain('Mocna strona');
    expect(container.querySelector('polygon.shape')).toBeNull();
    expect(container.querySelectorAll('.axis').length).toBe(5);
    expect(text(container)).toContain('gdy uzbiera się kilka tygodni historii');
  });
});
