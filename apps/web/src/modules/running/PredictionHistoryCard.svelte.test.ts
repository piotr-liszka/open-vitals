import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/svelte';
import PredictionHistoryCard from './PredictionHistoryCard.svelte';
import RunningView from './RunningView.svelte';
import { pl } from '$lib/i18n/messages/pl';
import type { PredictionHistory, PredictionHistoryDistance, RunningData } from './running.types';
import { resolveRange } from '$lib/range';
import { runnerProfile } from '$lib/server/analytics/runner-profile';

afterEach(cleanup);

const DAYS = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05'];

function distance(over: Partial<PredictionHistoryDistance> = {}): PredictionHistoryDistance {
  const values = over.values ?? [2600, 2600, 2600, 2400, 2400];
  return {
    key: '10k',
    label: '10 km',
    metres: 10_000,
    netChangeS: 200,
    ...over,
    values
  };
}

function history(over: Partial<PredictionHistory> = {}): PredictionHistory {
  return { days: DAYS, distances: [distance()], ...over };
}

function chips(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('.chips button')];
}

describe('PredictionHistoryCard', () => {
  it('titles itself from the catalog rather than a hardcoded string', () => {
    const { container } = render(PredictionHistoryCard, { props: { history: history() } });
    expect(container.textContent).toContain(pl['predHistory.title']);
    expect(container.textContent).toContain(pl['predHistory.note']);
  });

  it('offers one chip per distance and no "all" chip — four race times on one axis is unreadable', () => {
    const { container } = render(PredictionHistoryCard, {
      props: {
        history: history({
          distances: [distance({ key: '5k', label: '5 km' }), distance({ key: '10k', label: '10 km' })]
        })
      }
    });
    expect(chips(container).map((c) => c.textContent?.trim())).toEqual(['5 km', '10 km']);
  });

  it('defaults to the distance with the most history, not the first in the payload', () => {
    const { container } = render(PredictionHistoryCard, {
      props: {
        history: history({
          distances: [
            distance({ key: 'marathon', label: 'Maraton', values: [null, null, null, null, 12_000] }),
            distance({ key: '10k', label: '10 km' })
          ]
        })
      }
    });
    const active = chips(container).find((c) => c.getAttribute('aria-pressed') === 'true');
    expect(active?.textContent?.trim()).toBe('10 km');
  });

  it('switches the series when a chip is clicked', async () => {
    const { container } = render(PredictionHistoryCard, {
      props: {
        history: history({
          distances: [
            distance({ key: '10k', label: '10 km', netChangeS: 200 }),
            distance({ key: '5k', label: '5 km', values: [1300, 1300, 1300, 1300, 1300], netChangeS: 0 })
          ]
        })
      }
    });
    expect(container.textContent).toContain(pl['predHistory.netFaster'].replace('{value}', '3:20'));

    const fiveK = chips(container).find((c) => c.textContent?.trim() === '5 km')!;
    await fireEvent.click(fiveK);
    expect(fiveK.getAttribute('aria-pressed')).toBe('true');
    // A record that has not moved SAYS so, rather than leaving a flat line unexplained.
    expect(container.textContent).toContain(pl['predHistory.netFlat']);
  });

  it('states a regression in words and points the badge the other way', () => {
    const { container } = render(PredictionHistoryCard, {
      props: { history: history({ distances: [distance({ netChangeS: -65 })] }) }
    });
    expect(container.textContent).toContain(pl['predHistory.netSlower'].replace('{value}', '1:05'));
    expect(container.querySelector('.delta')?.classList.contains('worse')).toBe(true);
    expect(container.querySelector('svg')?.getAttribute('data-icon')).toBe('arrow-up');
  });

  it('formats past an hour as h:mm:ss', () => {
    const { container } = render(PredictionHistoryCard, {
      props: { history: history({ distances: [distance({ netChangeS: 3725 })] }) }
    });
    expect(container.textContent).toContain('1:02:05');
  });

  it('renders no badge, only the sentence, when there is nothing to compare', () => {
    const { container } = render(PredictionHistoryCard, {
      props: {
        history: history({
          distances: [distance({ values: [null, null, null, null, 2400], netChangeS: null })]
        })
      }
    });
    expect(container.querySelector('.delta')).toBeNull();
    expect(container.textContent).toContain(pl['predHistory.netUnknown']);
  });
});

/** The section itself, on the page — absent rather than empty when there is nothing to draw. */
describe('RunningView — the history section', () => {
  function data(over: Partial<RunningData> = {}): RunningData {
    return {
      range: resolveRange('30', '2026-08-09'),
      totals: { runs: 1, totalKm: 10, longestKm: 10, avgPaceSecPerKm: 270, totalTimeS: 2700 },
      weekly: [],
      efficiency: [],
      speedCurve: [],
      criticalSpeed: null,
      predictions: [],
      predictionHistory: null,
      hrZones: [],
      maxHr: null,
      // The real derivation over no runs — a hand-built stub would only test the stub.
      profile: runnerProfile([], { today: '2026-08-09' }),
      hasData: true,
      hasWindowData: true,
      ...over
    };
  }

  it('is absent when the payload has no history', () => {
    const { container } = render(RunningView, { props: { data: data() } });
    expect(container.textContent).not.toContain(pl['predHistory.title']);
  });

  it('renders directly under the predictions when there is one', () => {
    const { container } = render(RunningView, { props: { data: data({ predictionHistory: history() }) } });
    expect(container.textContent).toContain(pl['predHistory.title']);
  });
});
