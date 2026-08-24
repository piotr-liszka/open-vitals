import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import TimelineStrip from './TimelineStrip.svelte';

afterEach(cleanup);

const segment = (key: string, start: number, end: number) => ({
  key,
  start,
  end,
  color: 'var(--lane-orange)',
  label: key
});

const blocks = (container: HTMLElement): HTMLElement[] => [
  ...container.querySelectorAll<HTMLElement>('.timeline-segment')
];

describe('TimelineStrip', () => {
  it('places each segment at its fraction of the strip', () => {
    const { container } = render(TimelineStrip, {
      props: {
        segments: [segment('a', 0, 0.25), segment('b', 0.25, 1)],
        ariaLabel: 'Struktura'
      }
    });
    const [a, b] = blocks(container);
    expect(a?.style.left).toBe('0%');
    expect(a?.style.width).toBe('25%');
    expect(b?.style.left).toBe('25%');
    expect(b?.style.width).toBe('75%');
  });

  it('clamps a segment that runs past the end rather than dropping it', () => {
    const { container } = render(TimelineStrip, {
      props: { segments: [segment('over', 0.8, 2)], ariaLabel: 'Struktura' }
    });
    const [over] = blocks(container);
    expect(over?.style.left).toBe('80%');
    expect(over?.style.width).toBe('20%');
  });

  it('survives a non-finite position instead of writing NaN into the style', () => {
    const { container } = render(TimelineStrip, {
      props: { segments: [segment('nan', Number.NaN, Number.NaN)], ariaLabel: 'Struktura' }
    });
    expect(blocks(container)[0]?.style.left).toBe('0%');
    expect(blocks(container)[0]?.style.width).toBe('0%');
  });

  it('draws markers as zero-width rules, labelled for assistive tech only', () => {
    const { container } = render(TimelineStrip, {
      props: {
        segments: [segment('a', 0, 1)],
        markers: [{ key: 'm', at: 0.5, color: 'var(--lane-cyan)', label: 'Do przycisku lap' }],
        ariaLabel: 'Struktura'
      }
    });
    const marker = container.querySelector<HTMLElement>('.timeline-marker');
    expect(marker?.style.left).toBe('50%');
    expect(marker?.querySelector('.sr-only')?.textContent).toBe('Do przycisku lap');
  });

  it('carries the insets so it can line up with a chart plot', () => {
    const { container } = render(TimelineStrip, {
      props: { segments: [segment('a', 0, 1)], insetLeft: 42, insetRight: 6, ariaLabel: 'Struktura' }
    });
    const strip = container.querySelector<HTMLElement>('.strip');
    expect(strip?.style.getPropertyValue('--inset-left')).toBe('42px');
    expect(strip?.style.getPropertyValue('--inset-right')).toBe('6px');
  });

  it('names the whole track for assistive tech', () => {
    const { container } = render(TimelineStrip, {
      props: { segments: [segment('a', 0, 1)], ariaLabel: 'Struktura planu' }
    });
    expect(container.querySelector('.track')?.getAttribute('aria-label')).toBe('Struktura planu');
  });
});
