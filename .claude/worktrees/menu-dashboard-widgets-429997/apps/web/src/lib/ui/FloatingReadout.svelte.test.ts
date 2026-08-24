import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import FloatingReadout, { type FloatingReadoutItem } from './FloatingReadout.svelte';

afterEach(cleanup);

const items: FloatingReadoutItem[] = [
  { key: 'hr', label: 'Tętno', value: '148', unit: 'bpm', color: 'var(--lane-red)' },
  { key: 'pace', label: 'Tempo', value: '5:03', unit: '/km', color: 'var(--lane-cyan)' }
];

describe('FloatingReadout (spec 052)', () => {
  it('renders nothing while closed, so a closed bar cannot cover the page', () => {
    const { container } = render(FloatingReadout, {
      props: { open: false, lead: '12:34', items }
    });
    expect(container.querySelector('.readout-float')).toBeNull();
  });

  it('prints the lead, the optional secondary and one entry per item when open', () => {
    const { container } = render(FloatingReadout, {
      props: { open: true, lead: '12:34', secondary: '3,21 km', items }
    });
    const bar = container.querySelector('.readout-float');
    expect(bar).not.toBeNull();
    expect(bar?.querySelector('.at-time')?.textContent).toBe('12:34');
    expect(bar?.querySelector('.at-dist')?.textContent).toBe('3,21 km');
    expect([...container.querySelectorAll('.v-label')].map((el) => el.textContent?.trim())).toEqual([
      'Tętno',
      'Tempo'
    ]);
    expect([...container.querySelectorAll('.v-value')].map((el) => el.textContent?.trim())).toEqual([
      '148bpm',
      '5:03/km'
    ]);
  });

  it('omits the distance chip when no secondary is given', () => {
    const { container } = render(FloatingReadout, { props: { open: true, lead: '00:42', items } });
    expect(container.querySelector('.at-time')?.textContent).toBe('00:42');
    expect(container.querySelector('.at-dist')).toBeNull();
    expect(container.querySelector('.at-sep')).toBeNull();
  });

  it('drops the value list entirely when there is nothing to list', () => {
    const { container } = render(FloatingReadout, { props: { open: true, lead: '00:42', items: [] } });
    expect(container.querySelector('.readout-float')).not.toBeNull();
    expect(container.querySelector('.values')).toBeNull();
  });

  it('is hidden from assistive tech — the owner keeps the persistent live region', () => {
    const { container } = render(FloatingReadout, { props: { open: true, lead: '12:34', items } });
    expect(container.querySelector('.readout-float')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('carries no interactive element that could swallow the hover feeding it', () => {
    const { container } = render(FloatingReadout, { props: { open: true, lead: '12:34', items } });
    const bar = container.querySelector('.readout-float');
    expect(bar?.querySelectorAll('button, a, input, [tabindex]')).toHaveLength(0);
  });
});
