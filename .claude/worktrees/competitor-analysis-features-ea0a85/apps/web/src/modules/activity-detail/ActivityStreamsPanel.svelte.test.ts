import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import ActivityStreamsPanel from './ActivityStreamsPanel.svelte';
import type { ActivityStreams } from './activity-detail.types';

afterEach(cleanup);

const n = 60;
const ramp = (f: (i: number) => number): number[] => Array.from({ length: n }, (_, i) => f(i));

const runStreams: ActivityStreams = {
  time: ramp((i) => i),
  heartRate: ramp((i) => 140 + (i % 10)),
  speed: ramp(() => 3.3),
  elevation: ramp((i) => 100 + i)
};

const titles = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('.chart-title')].map((el) => el.textContent?.trim() ?? '');

/**
 * jsdom has no layout, so every chart wrapper measures 0px and falls back to the 640-wide default
 * coordinate system. Pinning each wrapper's rect to that same width makes a client x map 1:1 onto
 * chart x — and, because all the charts share it, makes their crosshairs directly comparable.
 */
const W = 640;
function pinWidths(container: HTMLElement): void {
  for (const wrap of container.querySelectorAll('.chart')) {
    (wrap as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, width: W, top: 0, height: 150 }) as DOMRect;
  }
}

/** jsdom lacks PointerEvent; the handlers only read `clientX`, which MouseEvent carries. */
function pointer(el: Element, type: string, clientX: number): void {
  el.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true }));
}

const cursors = (container: HTMLElement): Element[] => [...container.querySelectorAll('line.cursor')];

describe('ActivityStreamsPanel', () => {
  it('draws one chart per recorded stream and nothing for the rest', () => {
    const { container } = render(ActivityStreamsPanel, {
      props: { streams: runStreams, sport: 'run' }
    });
    expect(titles(container)).toEqual(['Tętno', 'Tempo', 'Wysokość', 'Koszt sercowy']);
    // No running-dynamics pod on this watch → no empty frames for it.
    expect(titles(container)).not.toContain('Czas kontaktu z podłożem');
  });

  it('groups the charts under their section headings', () => {
    const { container } = render(ActivityStreamsPanel, {
      props: { streams: runStreams, sport: 'run' }
    });
    const groups = [...container.querySelectorAll('.group-title')].map((el) => el.textContent);
    expect(groups).toEqual(['Wysiłek', 'Teren i warunki', 'Fizjologia']);
  });

  it('offers the distance axis only when a speed stream exists', () => {
    const { container } = render(ActivityStreamsPanel, {
      props: { streams: runStreams, sport: 'run' }
    });
    expect(container.querySelector('[aria-label="Oś pozioma wykresów"]')).not.toBeNull();

    cleanup();
    const noSpeed = render(ActivityStreamsPanel, {
      props: { streams: { time: ramp((i) => i), heartRate: ramp(() => 150) }, sport: 'run' }
    });
    expect(noSpeed.container.querySelector('[aria-label="Oś pozioma wykresów"]')).toBeNull();
  });

  it('invites the reader to hover before anything is pinned', () => {
    const { container } = render(ActivityStreamsPanel, {
      props: { streams: runStreams, sport: 'run' }
    });
    expect(container.querySelector('.hint')?.textContent).toContain('Najedź na dowolny wykres');
    expect(container.querySelector('.values')).toBeNull();
  });

  describe('one crosshair across the stack (spec 035)', () => {
    it('marks the hovered moment in every chart, not just the one under the pointer', async () => {
      const { container } = render(ActivityStreamsPanel, {
        props: { streams: runStreams, sport: 'run' }
      });
      pinWidths(container);
      expect(cursors(container)).toHaveLength(0);

      // Hover the FIRST chart only; all three must respond.
      const firstHit = container.querySelectorAll('rect.hit')[0]!;
      pointer(firstHit, 'pointermove', W - 1);
      await Promise.resolve();

      expect(container.querySelectorAll('.chart-row')).toHaveLength(4);
      expect(cursors(container)).toHaveLength(4);
    });

    it('lines those rules up on one x, so the stack reads as a single crosshair', async () => {
      const { container } = render(ActivityStreamsPanel, {
        props: { streams: runStreams, sport: 'run' }
      });
      pinWidths(container);
      pointer(container.querySelectorAll('rect.hit')[1]!, 'pointermove', 300);
      await Promise.resolve();

      const xs = cursors(container).map((el) => el.getAttribute('x1'));
      expect(xs).toHaveLength(4);
      expect(new Set(xs).size).toBe(1);
    });

    it('reads every metric at the hovered moment into the strip', async () => {
      const { container } = render(ActivityStreamsPanel, {
        props: { streams: runStreams, sport: 'run' }
      });
      pinWidths(container);
      expect(container.querySelector('.values')).toBeNull();

      pointer(container.querySelectorAll('rect.hit')[0]!, 'pointermove', W - 1);
      await Promise.resolve();

      const labels = [...container.querySelectorAll('.v-label')].map((el) => el.textContent?.trim());
      expect(labels).toEqual(['Tętno', 'Tempo', 'Wysokość', 'Koszt sercowy']);
      expect(container.querySelector('.hint')).toBeNull();
      expect(container.querySelector('.at-time')?.textContent).not.toBe('');
    });

    it('clears the whole stack when the pointer leaves and nothing is pinned', async () => {
      const { container } = render(ActivityStreamsPanel, {
        props: { streams: runStreams, sport: 'run' }
      });
      pinWidths(container);
      const hit = container.querySelectorAll('rect.hit')[0]!;

      pointer(hit, 'pointermove', 300);
      await Promise.resolve();
      expect(cursors(container)).toHaveLength(4);

      pointer(hit, 'pointerleave', 300);
      await Promise.resolve();
      expect(cursors(container)).toHaveLength(0);
      expect(container.querySelector('.hint')).not.toBeNull();
    });

    it('keeps a pinned moment on the stack after the pointer leaves', async () => {
      const { container } = render(ActivityStreamsPanel, {
        props: { streams: runStreams, sport: 'run' }
      });
      pinWidths(container);
      const hit = container.querySelectorAll('rect.hit')[0]!;

      pointer(hit, 'pointermove', 300);
      pointer(hit, 'pointerup', 300);
      await Promise.resolve();
      pointer(hit, 'pointerleave', 300);
      await Promise.resolve();

      const rules = cursors(container);
      expect(rules).toHaveLength(4);
      // Pinned reads as a solid rule in every chart, not a dashed one.
      expect(rules.every((el) => el.classList.contains('pinned'))).toBe(true);
      expect(container.querySelector('.values')).not.toBeNull();
    });

    it('reads out in a floating bar, never in the header — the stack must not move (spec 052)', async () => {
      const { container } = render(ActivityStreamsPanel, {
        props: { streams: runStreams, sport: 'run' }
      });
      pinWidths(container);
      expect(container.querySelector('.readout-float')).toBeNull();

      pointer(container.querySelectorAll('rect.hit')[0]!, 'pointermove', W - 1);
      await Promise.resolve();

      const float = container.querySelector('.readout-float');
      expect(float).not.toBeNull();
      // Everything that grows lives in the floating bar…
      expect(float?.querySelector('.at-time')).not.toBeNull();
      expect(float?.querySelector('.values')).not.toBeNull();
      // …and nothing that grows is left in the header's slot.
      const slot = container.querySelector('.readout');
      expect(slot).not.toBeNull();
      expect(slot?.contains(float ?? null)).toBe(false);
      expect(slot?.querySelector('.values')).toBeNull();
      expect(slot?.querySelector('.at-time')).toBeNull();
      // The slot stays a mounted live region so the moment is still announced.
      expect(slot?.getAttribute('aria-live')).toBe('polite');
      expect(slot?.querySelector('.sr-only')?.textContent).toContain('Tętno');
    });

    it('takes the floating bar down again once neither hover nor pin is active', async () => {
      const { container } = render(ActivityStreamsPanel, {
        props: { streams: runStreams, sport: 'run' }
      });
      pinWidths(container);
      const hit = container.querySelectorAll('rect.hit')[0]!;

      pointer(hit, 'pointermove', 300);
      await Promise.resolve();
      expect(container.querySelector('.readout-float')).not.toBeNull();

      pointer(hit, 'pointerleave', 300);
      await Promise.resolve();
      expect(container.querySelector('.readout-float')).toBeNull();

      // A pin outlives the pointer, and so does the bar.
      pointer(hit, 'pointermove', 300);
      pointer(hit, 'pointerup', 300);
      await Promise.resolve();
      pointer(hit, 'pointerleave', 300);
      await Promise.resolve();
      expect(container.querySelector('.readout-float')).not.toBeNull();
    });

    it('leaves the per-chart floating tooltips off — the strip is the read-out', async () => {
      const { container } = render(ActivityStreamsPanel, {
        props: { streams: runStreams, sport: 'run' }
      });
      pinWidths(container);
      pointer(container.querySelectorAll('rect.hit')[0]!, 'pointermove', 300);
      await Promise.resolve();

      expect(container.querySelector('.tip')).toBeNull();
      expect(container.querySelector('.values')).not.toBeNull();
    });
  });

  it('renders nothing for an activity with no streams at all', () => {
    const { container } = render(ActivityStreamsPanel, { props: { streams: {}, sport: 'run' } });
    expect(container.querySelectorAll('.chart-row')).toHaveLength(0);
  });
});
