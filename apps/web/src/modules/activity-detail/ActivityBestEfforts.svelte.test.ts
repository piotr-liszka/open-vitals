import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import ActivityBestEfforts from './ActivityBestEfforts.svelte';
import type { BestEffort } from './activity-detail.types';

afterEach(cleanup);

function effort(over: Partial<BestEffort> = {}): BestEffort {
  return {
    key: '1k',
    label: '1 km',
    metres: 1000,
    durationS: 250,
    actualM: 1000,
    paceSecPerKm: 250,
    startS: 1200,
    samples: 251,
    ...over
  };
}

describe('ActivityBestEfforts', () => {
  it('renders nothing when the session contained no reportable effort', () => {
    const { container } = render(ActivityBestEfforts, { props: { efforts: [] } });
    expect(container.textContent?.trim()).toBe('');
  });

  it('lists one row per distance with its time and pace', () => {
    const { container } = render(ActivityBestEfforts, {
      props: {
        efforts: [effort({ key: '400m', label: '400 m', metres: 400, durationS: 90, actualM: 400 }), effort()]
      }
    });
    const rows = [...container.querySelectorAll('tbody tr')];
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('400 m');
    expect(rows[1]?.textContent).toContain('1 km');
    expect(rows[1]?.textContent).toContain('4:10'); // 250 s
  });

  it('shows where in the activity the effort started', () => {
    const { container } = render(ActivityBestEfforts, { props: { efforts: [effort()] } });
    expect(container.textContent).toContain('20:00'); // 1200 s in
  });

  it('shows the distance actually measured, and explains the measurement window behind a disclosure', async () => {
    const { container, getByRole } = render(ActivityBestEfforts, {
      props: { efforts: [effort({ actualM: 1050 })] }
    });
    expect(container.querySelectorAll('tbody td')[3]?.textContent).toContain('1050');
    const trigger = getByRole('button', { name: 'Jak liczymy te odcinki?' });
    await trigger.click();
    const panel = getByRole('group', { name: 'Jak liczymy te odcinki?' });
    expect(panel.textContent).toMatch(/tempo liczymy z tej wartości/);
  });

  it('warns about a coarse sample interval only when the windows actually overshoot', async () => {
    const tight = render(ActivityBestEfforts, { props: { efforts: [effort({ actualM: 1000 })] } });
    await tight.getByRole('button', { name: 'Jak liczymy te odcinki?' }).click();
    expect(tight.container.textContent).not.toContain('próbkował rzadko');

    cleanup();
    const coarse = render(ActivityBestEfforts, { props: { efforts: [effort({ actualM: 1100 })] } });
    await coarse.getByRole('button', { name: 'Jak liczymy te odcinki?' }).click();
    expect(coarse.container.textContent).toContain('próbkował rzadko');
  });

  it('names the columns for assistive tech via row and column headers', () => {
    const { container } = render(ActivityBestEfforts, { props: { efforts: [effort()] } });
    const cols = [...container.querySelectorAll('thead th')].map((el) => el.getAttribute('scope'));
    expect(cols.every((s) => s === 'col')).toBe(true);
    expect(container.querySelector('tbody th')?.getAttribute('scope')).toBe('row');
  });
});
