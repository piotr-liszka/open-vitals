import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import RacePredictionsCard from './RacePredictionsCard.svelte';
import type { RacePrediction } from './running.types';

afterEach(cleanup);

function prediction(over: Partial<RacePrediction> = {}): RacePrediction {
  return {
    key: '10k',
    label: '10 km',
    metres: 10_000,
    riegelS: 2530,
    criticalSpeedS: 2450,
    paceSecPerKm: 253,
    fromLabel: '5 km',
    fromDay: '2026-06-01',
    fromBasis: 'measured',
    extrapolation: 2,
    confident: true,
    ...over
  };
}

function rows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('.row')];
}

describe('RacePredictionsCard', () => {
  it('leads each row with the projected time and puts the pace under it', () => {
    const { container } = render(RacePredictionsCard, { props: { predictions: [prediction()] } });
    const [row] = rows(container);
    expect(row?.querySelector('.dist')?.textContent?.trim()).toBe('10 km');
    expect(row?.querySelector('.time')?.textContent?.trim()).toBe('42:10');
    expect(row?.querySelector('.pace')?.textContent).toContain('4:13');
    expect(row?.querySelector('.pace')?.textContent).toContain('/km');
  });

  it('renders one row per prediction, in the order given', () => {
    const { container } = render(RacePredictionsCard, {
      props: {
        predictions: [prediction({ key: '5k', label: '5 km' }), prediction({ key: '10k', label: '10 km' })]
      }
    });
    expect(rows(container).map((r) => r.querySelector('.dist')?.textContent?.trim())).toEqual([
      '5 km',
      '10 km'
    ]);
  });

  it('shows an improvement as a green, downward badge with the size of the gain', () => {
    const { container } = render(RacePredictionsCard, {
      props: {
        predictions: [prediction({ trend: { deltaS: 100, previousS: 2630, sinceDay: '2026-05-17' } })]
      }
    });
    const badge = container.querySelector('.delta');
    expect(badge?.classList.contains('better')).toBe(true);
    // Scoped to the badge: the card's own InfoPopover trigger is an <svg> too, and comes first in
    // document order.
    expect(badge?.querySelector('svg')?.getAttribute('data-icon')).toBe('arrow-down');
    expect(badge?.querySelector('.value')?.textContent).toBe('1:40');
    expect(badge?.querySelector('.sr-only')?.textContent).toContain('szybciej o 1:40');
  });

  it('shows a regression as a danger, upward badge with an unsigned magnitude', () => {
    const { container } = render(RacePredictionsCard, {
      props: {
        predictions: [prediction({ trend: { deltaS: -35, previousS: 2495, sinceDay: '2026-05-17' } })]
      }
    });
    const badge = container.querySelector('.delta');
    expect(badge?.classList.contains('worse')).toBe(true);
    expect(badge?.querySelector('svg')?.getAttribute('data-icon')).toBe('arrow-up');
    expect(badge?.querySelector('.value')?.textContent).toBe('0:35');
    expect(badge?.querySelector('.sr-only')?.textContent).toContain('wolniej o 0:35');
  });

  it('marks an unchanged prediction quietly rather than pretending it moved', () => {
    const { container } = render(RacePredictionsCard, {
      props: {
        predictions: [prediction({ trend: { deltaS: 0, previousS: 2530, sinceDay: '2026-05-17' } })]
      }
    });
    const badge = container.querySelector('.delta');
    expect(badge?.classList.contains('same')).toBe(true);
    // Scoped to the badge, not the whole card: the card's own InfoPopover trigger is an <svg> too,
    // and that one is expected. This asserts DeltaBadge draws no arrow when there's nothing to point.
    expect(badge?.querySelector('svg')).toBeNull();
  });

  it('shows no badge at all when there is nothing to compare against', () => {
    const { container } = render(RacePredictionsCard, { props: { predictions: [prediction()] } });
    expect(container.querySelector('.delta')).toBeNull();
  });

  it('keeps every column the old table carried in the row’s secondary lines', () => {
    const { container } = render(RacePredictionsCard, { props: { predictions: [prediction()] } });
    const [row] = rows(container);
    expect(row?.querySelector('.cs')?.textContent).toContain('40:50'); // critical-speed estimate
    const src = row?.querySelector('.src')?.textContent ?? '';
    expect(src).toContain('5 km'); // which best it came from
    expect(src).toContain('cze'); // its local day, via $lib/date
    expect(src).toContain('zmierzony odcinek'); // measured, not projected
    expect(src).toContain('×2'); // the extrapolation factor
  });

  it('names the projection fallback for what it is', () => {
    const { container } = render(RacePredictionsCard, {
      props: { predictions: [prediction({ fromBasis: 'projected' })] }
    });
    expect(container.querySelector('.src')?.textContent).toContain('projekcja z całego biegu');
  });

  it('dims a far extrapolation instead of hiding it, and says so', () => {
    const { container } = render(RacePredictionsCard, {
      props: { predictions: [prediction({ confident: false, extrapolation: 3.5 })] }
    });
    const [row] = rows(container);
    expect(row?.classList.contains('soft')).toBe(true);
    expect(row?.querySelector('.warn')?.textContent).toContain('daleka ekstrapolacja');
  });

  it('says so when only the critical-speed model could speak', () => {
    const { container } = render(RacePredictionsCard, {
      props: {
        predictions: [
          prediction({
            riegelS: null,
            paceSecPerKm: null,
            fromLabel: null,
            fromDay: null,
            fromBasis: null,
            extrapolation: null,
            confident: false
          })
        ]
      }
    });
    expect(container.querySelector('.time')?.textContent?.trim()).toBe('—');
    expect(container.querySelector('.src')?.textContent).toContain('Tylko model tempa krytycznego');
  });
});
