import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import ActivityFlags from './ActivityFlags.svelte';
import type { ActivityHighlight, SuspectValue } from './activity-highlights';

afterEach(cleanup);

const record: ActivityHighlight = {
  key: 'distance',
  label: 'Dystans',
  value: '30,00',
  unit: 'km',
  kind: 'record',
  text: 'Rekord — najlepszy wynik w historii',
  rank: 1,
  outOf: 42
};

const notable: ActivityHighlight = {
  key: 'pace',
  label: 'Średnie tempo',
  value: '4:31',
  unit: 'min/km',
  kind: 'notable',
  text: 'Najlepszy od 8 miesięcy',
  rank: 2,
  outOf: 42
};

const warn: SuspectValue = {
  key: 'maxSpeedCeiling',
  label: 'Maks. prędkość',
  value: '43,2 km/h',
  text: 'Powyżej 32 km/h dla tego sportu — praktycznie zawsze skok GPS.',
  severity: 'warn'
};

const info: SuspectValue = {
  key: 'hrSpike',
  label: 'Maks. tętno',
  value: '200 bpm',
  text: 'O 80 bpm powyżej średniej.',
  severity: 'info'
};

describe('ActivityFlags', () => {
  it('renders nothing at all when there is nothing to say', () => {
    const { container } = render(ActivityFlags, { props: { highlights: [], suspects: [] } });
    expect(container.textContent?.trim()).toBe('');
  });

  it('shows a record with its value, sentence and standing', () => {
    const { container, getByText } = render(ActivityFlags, {
      props: { highlights: [record], suspects: [] }
    });
    expect(getByText('Rekord — najlepszy wynik w historii')).toBeTruthy();
    expect(getByText('1 z 42 porównywalnych sesji')).toBeTruthy();
    expect(container.querySelector('.value')?.textContent).toContain('30,00');
    expect(container.querySelector('.unit')?.textContent).toBe('km');
  });

  it('marks a record apart from a lesser mention', () => {
    const { container } = render(ActivityFlags, {
      props: { highlights: [record, notable], suspects: [] }
    });
    const rows = [...container.querySelectorAll('.list:not(.suspects) .row')];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.classList.contains('record')).toBe(true);
    expect(rows[1]?.classList.contains('record')).toBe(false);
  });

  it('explains a suspect value instead of only printing it', () => {
    const { getByText } = render(ActivityFlags, { props: { highlights: [], suspects: [warn] } });
    expect(getByText(/praktycznie zawsze skok GPS/)).toBeTruthy();
    expect(getByText('Podejrzana wartość')).toBeTruthy();
  });

  it('separates a hard warning from a note', () => {
    const { container } = render(ActivityFlags, {
      props: { highlights: [], suspects: [warn, info] }
    });
    const rows = [...container.querySelectorAll('.suspects .row')];
    expect(rows[0]?.classList.contains('warn')).toBe(true);
    expect(rows[1]?.classList.contains('warn')).toBe(false);
  });

  it('shows both lists at once, each with its own label', () => {
    const { container } = render(ActivityFlags, {
      props: { highlights: [record], suspects: [warn] }
    });
    expect(container.querySelector('[aria-label="Wyróżnione wyniki"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Wartości wyglądające na błąd"]')).not.toBeNull();
  });

  it('renders a highlight with no unit without an empty unit span', () => {
    // `unit` is genuinely ABSENT, not `undefined` — under exactOptionalPropertyTypes those differ,
    // and the API omits the key rather than sending a null.
    const { unit: _unit, ...unitless } = record;
    const { container } = render(ActivityFlags, {
      props: { highlights: [{ ...unitless, key: 'load' }], suspects: [] }
    });
    expect(container.querySelector('.unit')).toBeNull();
  });
});
