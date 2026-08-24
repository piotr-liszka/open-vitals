import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import ActivityEfficiency from './ActivityEfficiency.svelte';
import type { EfficiencyBlock, Pacing } from './activity-detail.types';

afterEach(cleanup);

function block(over: Partial<EfficiencyBlock> = {}): EfficiencyBlock {
  return {
    decoupling: {
      pct: 2.1,
      basis: 'pace',
      firstRatio: 1.4,
      secondRatio: 1.37,
      samples: 900,
      coupled: true
    },
    ef: 1.33,
    powerEf: null,
    cardiacCost: 750,
    ...over
  };
}

describe('ActivityEfficiency', () => {
  it('renders nothing when the session carried nothing HR-relative', () => {
    const { container } = render(ActivityEfficiency, {
      props: {
        pacing: null,
        efficiency: { decoupling: null, ef: null, powerEf: null, cardiacCost: null }
      }
    });
    expect(container.textContent?.trim()).toBe('');
  });

  it('calls a small drift coupled and says what that means', () => {
    const { getByText } = render(ActivityEfficiency, { props: { pacing: null, efficiency: block() } });
    expect(getByText('Spięty')).toBeTruthy();
    expect(getByText(/dobrze rozłożony wysiłek tlenowy/)).toBeTruthy();
  });

  it('names the likely causes when the session drifted', () => {
    const { getByText } = render(ActivityEfficiency, {
      props: {
        pacing: null,
        efficiency: block({ decoupling: { ...block().decoupling!, pct: 11.4, coupled: false } })
      }
    });
    expect(getByText('Rozjechany')).toBeTruthy();
    expect(getByText(/zbyt szybki start/)).toBeTruthy();
  });

  it('reads a negative drift as a conservative start, not as a problem', () => {
    const { getByText } = render(ActivityEfficiency, {
      props: {
        pacing: null,
        efficiency: block({ decoupling: { ...block().decoupling!, pct: -8, coupled: false } })
      }
    });
    expect(getByText('Przyspieszony')).toBeTruthy();
    expect(getByText(/spokojny start/)).toBeTruthy();
  });

  it('signs the percentage so the direction is unmistakable', () => {
    const drift = render(ActivityEfficiency, {
      props: {
        pacing: null,
        efficiency: block({ decoupling: { ...block().decoupling!, pct: 11.4, coupled: false } })
      }
    });
    expect(drift.container.querySelector('.value')?.textContent).toContain('+11,4');

    cleanup();
    const gain = render(ActivityEfficiency, {
      props: {
        pacing: null,
        efficiency: block({ decoupling: { ...block().decoupling!, pct: -8, coupled: false } })
      }
    });
    expect(gain.container.querySelector('.value')?.textContent).toContain('-8,0');
  });

  it('says the number is meaningless for intervals rather than leaving it to be misread', () => {
    const { getByText } = render(ActivityEfficiency, { props: { pacing: null, efficiency: block() } });
    expect(getByText(/dla treningu interwałowego ta liczba nie ma sensu/)).toBeTruthy();
  });

  it('labels a power-based reading as mocy, not tempa', () => {
    const { getByText } = render(ActivityEfficiency, {
      props: { pacing: null, efficiency: block({ decoupling: { ...block().decoupling!, basis: 'power' } }) }
    });
    expect(getByText('Rozejście tętna i mocy')).toBeTruthy();
  });

  it('shows the efficiency factor and the cardiac cost with their units', () => {
    const { container, getByText } = render(ActivityEfficiency, {
      props: { pacing: null, efficiency: block() }
    });
    expect(getByText('Współczynnik wydolności')).toBeTruthy();
    expect(getByText('Koszt sercowy')).toBeTruthy();
    expect(container.textContent).toContain('ud./km');
  });

  it('shows the power variant only when a meter was fitted', () => {
    const without = render(ActivityEfficiency, { props: { pacing: null, efficiency: block() } });
    expect(without.container.textContent).not.toContain('Wydolność na mocy');

    cleanup();
    const withMeter = render(ActivityEfficiency, {
      props: { pacing: null, efficiency: block({ powerEf: 1.4 }) }
    });
    expect(withMeter.container.textContent).toContain('Wydolność na mocy');
  });

  it('renders the numbers it has when decoupling could not be measured', () => {
    const { container, getByText } = render(ActivityEfficiency, {
      props: { pacing: null, efficiency: block({ decoupling: null }) }
    });
    expect(getByText('Współczynnik wydolności')).toBeTruthy();
    expect(container.querySelector('.wide')).toBeNull();
  });

  describe('pace shape (spec 045)', () => {
    const pace = (over: Partial<Pacing> = {}): Pacing => ({
      splitPct: 1.2,
      firstHalfPaceSecPerKm: 300,
      secondHalfPaceSecPerKm: 304,
      variabilityPct: 2.5,
      shape: 'even',
      chunks: 10,
      ...over
    });

    it('renders on its own, even with no HR-relative numbers at all', () => {
      const { getByText } = render(ActivityEfficiency, {
        props: {
          pacing: pace(),
          efficiency: { decoupling: null, ef: null, powerEf: null, cardiacCost: null }
        }
      });
      expect(getByText('Rozkład tempa')).toBeTruthy();
      expect(getByText('Równo')).toBeTruthy();
    });

    it('names a fade and its usual cause', () => {
      const { getByText } = render(ActivityEfficiency, {
        props: { pacing: pace({ shape: 'faded', splitPct: 14 }), efficiency: block() }
      });
      expect(getByText('Odpadnięcie')).toBeTruthy();
      expect(getByText(/zbyt szybki start/)).toBeTruthy();
    });

    it('celebrates a negative split', () => {
      const { getByText } = render(ActivityEfficiency, {
        props: { pacing: pace({ shape: 'negative-split', splitPct: -6 }), efficiency: block() }
      });
      expect(getByText('Negative split')).toBeTruthy();
    });

    it('says the split balance means nothing for a varied session', () => {
      const { getByText } = render(ActivityEfficiency, {
        props: { pacing: pace({ shape: 'variable', variabilityPct: 30 }), efficiency: block() }
      });
      expect(getByText('Zmienne tempo')).toBeTruthy();
      expect(getByText(/bilans połówek nic tu nie znaczy/)).toBeTruthy();
    });

    it('says the halves were split by distance, and shows both paces', () => {
      const { container, getByText } = render(ActivityEfficiency, {
        props: { pacing: pace(), efficiency: block() }
      });
      expect(getByText(/po DYSTANSIE, nie po czasie/)).toBeTruthy();
      expect(container.textContent).toContain('5:00');
      expect(container.textContent).toContain('5:04');
    });

    it('is absent when the session was too short to judge', () => {
      const { container } = render(ActivityEfficiency, {
        props: { pacing: null, efficiency: block() }
      });
      expect(container.textContent).not.toContain('Rozkład tempa');
    });
  });
});
