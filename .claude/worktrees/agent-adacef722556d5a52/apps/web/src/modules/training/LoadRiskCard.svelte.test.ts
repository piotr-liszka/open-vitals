import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import LoadRiskCard from './LoadRiskCard.svelte';
import type { LoadRisk, SportFitness } from './training.types';

afterEach(cleanup);

function risk(over: Partial<LoadRisk> = {}): LoadRisk {
  return {
    acwr: 1.05,
    rampRatePerWeek: 3.2,
    band: 'building',
    advice: 'Budujesz formę w rozsądnym tempie.',
    historyDays: 120,
    ...over
  };
}

function sport(over: Partial<SportFitness> = {}): SportFitness {
  return {
    group: 'run',
    label: 'Bieg',
    color: 'var(--lane-orange)',
    ctl: 62.4,
    atl: 70,
    tsb: -7.6,
    band: 'neutral',
    risk: risk(),
    ...over
  };
}

describe('LoadRiskCard', () => {
  it('explains the absence instead of showing a reassuring 1,0 under the history floor', () => {
    const { container, getByText } = render(LoadRiskCard, {
      props: {
        risk: risk({
          acwr: null,
          rampRatePerWeek: null,
          historyDays: 12,
          advice: 'Za mało historii, aby ocenić tempo narastania obciążenia.'
        }),
        perSport: []
      }
    });
    expect(getByText(/Za mało historii/)).toBeTruthy();
    expect(getByText(/12 dni ciągłej historii/)).toBeTruthy();
    // No numbers at all, and no band badge to imply a verdict.
    expect(container.querySelector('.numbers')).toBeNull();
  });

  it('shows both numbers, because either alone misses a real case', () => {
    const { container, getByText } = render(LoadRiskCard, {
      props: { risk: risk(), perSport: [] }
    });
    expect(getByText('Ostatni tydzień vs baza')).toBeTruthy();
    expect(getByText('Przyrost formy')).toBeTruthy();
    expect(container.textContent).toContain('1,05');
    expect(container.textContent).toContain('+3,2');
  });

  it('signs the ramp rate so a fall is unmistakable', () => {
    const { container } = render(LoadRiskCard, {
      props: { risk: risk({ rampRatePerWeek: -4.5 }), perSport: [] }
    });
    expect(container.textContent).toContain('-4,5');
  });

  it('names the band and carries its advice', () => {
    const { getByText } = render(LoadRiskCard, {
      props: {
        risk: risk({ band: 'spike', advice: 'Skok obciążenia — zrób lżejszy tydzień.' }),
        perSport: []
      }
    });
    expect(getByText('Skok obciążenia')).toBeTruthy();
    expect(getByText(/zrób lżejszy tydzień/)).toBeTruthy();
  });

  it('says the ratio is a prompt, not a verdict', () => {
    const { getByText } = render(LoadRiskCard, { props: { risk: risk(), perSport: [] } });
    expect(getByText(/obserwacja populacyjna, nie prawo/)).toBeTruthy();
  });

  it('omits the ramp rate when it could not be measured', () => {
    const { container } = render(LoadRiskCard, {
      props: { risk: risk({ rampRatePerWeek: null }), perSport: [] }
    });
    expect(container.textContent).not.toContain('Przyrost formy');
    expect(container.textContent).toContain('Ostatni tydzień vs baza');
  });

  it('breaks fitness down per sport once there is more than one', () => {
    const { container, getByText } = render(LoadRiskCard, {
      props: {
        risk: risk(),
        perSport: [sport(), sport({ group: 'ride', label: 'Rower', ctl: 40, tsb: 5 })]
      }
    });
    expect(getByText('Forma w poszczególnych sportach')).toBeTruthy();
    expect(container.querySelectorAll('.sport')).toHaveLength(2);
    expect(container.textContent).toContain('Bieg');
    expect(container.textContent).toContain('Rower');
  });

  it('does not break down a single-sport athlete‘s fitness — it would just repeat the total', () => {
    const { container } = render(LoadRiskCard, {
      props: { risk: risk(), perSport: [sport()] }
    });
    expect(container.querySelector('.per-sport')).toBeNull();
  });

  it('flags only the families that need attention, not every one', () => {
    const { container } = render(LoadRiskCard, {
      props: {
        risk: risk(),
        perSport: [
          sport({ risk: risk({ band: 'spike' }) }),
          sport({ group: 'ride', label: 'Rower', risk: risk({ band: 'steady' }) })
        ]
      }
    });
    const rows = [...container.querySelectorAll('.sport')];
    expect(rows[0]?.textContent).toContain('Skok obciążenia');
    expect(rows[1]?.textContent).not.toContain('Skok obciążenia');
    expect(rows[1]?.textContent).not.toContain('Stabilnie');
  });
});
