import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import TimelineView from './TimelineView.svelte';
import {
  TIMELINE_EXPANDED_KEY,
  TIMELINE_ORIENTATION_KEY,
  type TimelineData,
  type TimelineEvent
} from './timeline.types';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

function activity(over: Partial<TimelineEvent> & { id: string; day: string }): TimelineEvent {
  return {
    kind: 'activity',
    time: '09:00',
    title: 'Road Ride',
    detail: 'Rower',
    stats: [{ label: 'Dystans', value: '42,0 km' }],
    icon: 'ride',
    accent: 'cyan',
    importance: 70,
    primary: true,
    href: '/activities/a1',
    activityId: 'a1',
    sport: 'cycling',
    group: 'ride',
    distanceM: 42_000,
    durationS: 5400,
    ...over
  } as TimelineEvent;
}

function health(over: Partial<TimelineEvent> & { id: string; day: string }): TimelineEvent {
  return {
    kind: 'health',
    time: null,
    title: 'Spadek HRV',
    detail: 'HRV poniżej Twojej zwykłej bazy',
    stats: [{ label: 'HRV', value: '31,0' }],
    icon: 'pulse',
    accent: 'green',
    importance: 92,
    primary: true,
    href: '/insights',
    metric: 'hrv',
    signal: 'hrv_drop',
    severity: 'strong',
    direction: 'down',
    value: 31,
    z: -3.2,
    favourable: false,
    ...over
  } as TimelineEvent;
}

function data(events: TimelineEvent[], over: Partial<TimelineData> = {}): TimelineData {
  const primaryCount = events.filter((e) => e.primary).length;
  return {
    today: '2026-08-07',
    past: { from: '2026-07-25', to: '2026-08-07', events, primaryCount, totalCount: events.length },
    planned: { from: '2026-08-08', to: '2026-08-14', status: 'not_synced', events: [] },
    ...over
  };
}

/** Rendered copy wraps across source lines; compare on collapsed whitespace, not on the markup. */
function text(container: HTMLElement): string {
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('TimelineView', () => {
  it('renders a chronological stream grouped by day, newest first', () => {
    const { container } = render(TimelineView, {
      props: {
        data: data([
          activity({ id: 'a', day: '2026-08-07' }),
          health({ id: 'h', day: '2026-08-06' }),
          activity({ id: 'b', day: '2026-08-04', title: 'Tempo Run', icon: 'run' })
        ])
      }
    });

    const labels = Array.from(container.querySelectorAll('.day-label')).map((n) => n.textContent?.trim());
    expect(labels).toEqual(['dziś', 'wczoraj', 'wt., 4 sie']);
    expect(text(container)).toContain('Spadek HRV');
    expect(text(container)).toContain('Tempo Run');
  });

  it('shows only the primary events until the reader expands the stream', async () => {
    const events = [
      health({ id: 'h', day: '2026-08-06' }),
      activity({ id: 'walk', day: '2026-08-05', title: 'Easy Walk', primary: false, importance: 33 })
    ];
    const { container, getByRole } = render(TimelineView, { props: { data: data(events) } });

    expect(text(container)).not.toContain('Easy Walk');
    expect(text(container)).toContain('ukryto 1 mniej istotnych');

    const more = getByRole('button', { name: 'Pokaż wszystkie zdarzenia (2)' });
    expect(more.getAttribute('aria-expanded')).toBe('false');

    await fireEvent.click(more);
    expect(text(container)).toContain('Easy Walk');
    expect(getByRole('button', { name: 'Pokaż tylko najważniejsze' }).getAttribute('aria-expanded')).toBe(
      'true'
    );
  });

  it('remembers the expanded stream per device', async () => {
    const events = [
      health({ id: 'h', day: '2026-08-06' }),
      activity({ id: 'walk', day: '2026-08-05', title: 'Easy Walk', primary: false, importance: 33 })
    ];

    const first = render(TimelineView, { props: { data: data(events) } });
    await fireEvent.click(first.getByRole('button', { name: 'Pokaż wszystkie zdarzenia (2)' }));
    expect(localStorage.getItem(TIMELINE_EXPANDED_KEY)).toBe('1');
    cleanup();

    // A fresh mount (a reload) opens on the remembered choice.
    const second = render(TimelineView, { props: { data: data(events) } });
    expect(text(second.container)).toContain('Easy Walk');
    expect(text(second.container)).not.toContain('ukryto 1 mniej istotnych');

    await fireEvent.click(second.getByRole('button', { name: 'Pokaż tylko najważniejsze' }));
    expect(localStorage.getItem(TIMELINE_EXPANDED_KEY)).toBe('0');
    cleanup();

    const third = render(TimelineView, { props: { data: data(events) } });
    expect(text(third.container)).not.toContain('Easy Walk');
  });

  it('offers no expander when nothing is hidden', () => {
    const { container } = render(TimelineView, {
      props: { data: data([activity({ id: 'a', day: '2026-08-07' })]) }
    });
    expect(container.querySelector('[aria-expanded]')).toBeNull();
  });

  it('links an event to its detail page and renders its pre-formatted readouts', () => {
    const { getByRole, container } = render(TimelineView, {
      props: { data: data([activity({ id: 'a', day: '2026-08-07' })]) }
    });
    expect(getByRole('link', { name: 'Road Ride' }).getAttribute('href')).toBe('/activities/a1');
    expect(text(container)).toContain('42,0 km');
  });

  it('says plainly that planned workouts are not synced yet, and invents nothing', () => {
    const { container } = render(TimelineView, { props: { data: data([]) } });
    expect(text(container)).toContain('Zaplanowane treningi nie są jeszcze synchronizowane');
    expect(text(container)).toContain('zamiast zgadywać, co masz w planie');
    expect(container.querySelectorAll('.plan').length).toBe(0);
  });

  it('distinguishes "nothing scheduled" from "not synced" once a source exists', () => {
    const { container } = render(TimelineView, {
      props: {
        data: data([], { planned: { from: '2026-08-08', to: '2026-08-14', status: 'empty', events: [] } })
      }
    });
    expect(text(container)).toContain('Brak zaplanowanych treningów');
    expect(text(container)).not.toContain('nie są jeszcze synchronizowane');
  });

  it('renders real plans the moment the contract is filled — no UI change needed', () => {
    const { container } = render(TimelineView, {
      props: {
        data: data([], {
          planned: {
            from: '2026-08-08',
            to: '2026-08-14',
            status: 'ok',
            events: [
              {
                id: 'p1',
                day: '2026-08-09',
                time: '07:30',
                kind: 'workout',
                title: 'Interwały 5×3 min',
                sport: 'running',
                description: 'Rozgrzewka 15 min, potem 5×3 min w progu',
                estimatedDurationS: 3600,
                estimatedDistanceM: 12_000,
                targetLoad: 95,
                source: 'garmin'
              }
            ]
          }
        })
      }
    });
    expect(text(container)).toContain('Interwały 5×3 min');
    expect(text(container)).toContain('Rozgrzewka 15 min');
    expect(text(container)).not.toContain('nie są jeszcze synchronizowane');
  });

  it('badges an authored session with whether it has reached Garmin (spec 050)', () => {
    const authoredPlan = (push: 'pending' | 'pushed' | 'failed' | 'unsupported') => ({
      from: '2026-08-08',
      to: '2026-08-14',
      status: 'ok' as const,
      events: [
        {
          id: `authored:w1-${push}`,
          day: '2026-08-09' as const,
          time: '18:00',
          kind: 'workout' as const,
          title: '4x8 FTP',
          sport: 'cycling',
          description: null,
          estimatedDurationS: 2880,
          estimatedDistanceM: null,
          targetLoad: null,
          source: 'garmin' as const,
          authored: true,
          push
        }
      ]
    });

    for (const [push, label] of [
      ['pending', 'do wysłania'],
      ['pushed', 'w Garminie'],
      ['failed', 'błąd wysyłki'],
      ['unsupported', 'niewspierane']
    ] as const) {
      cleanup();
      const { container } = render(TimelineView, {
        props: { data: data([], { planned: authoredPlan(push) }) }
      });
      expect(text(container), push).toContain(label);
    }
  });

  it('never badges a plan that came FROM Garmin — it is on the watch by definition', () => {
    const { container } = render(TimelineView, {
      props: {
        data: data([], {
          planned: {
            from: '2026-08-08',
            to: '2026-08-14',
            status: 'ok',
            events: [
              {
                id: 'g1',
                day: '2026-08-09',
                time: null,
                kind: 'workout',
                title: 'Plan z Garmina',
                sport: 'running',
                description: null,
                estimatedDurationS: null,
                estimatedDistanceM: null,
                targetLoad: null,
                source: 'garmin'
              }
            ]
          }
        })
      }
    });
    expect(text(container)).toContain('Plan z Garmina');
    expect(text(container)).not.toContain('do wysłania');
    expect(container.querySelectorAll('.plan-state').length).toBe(0);
  });

  it('teaches the empty backwards half instead of showing a blank rail', () => {
    const { container } = render(TimelineView, { props: { data: data([]) } });
    expect(text(container)).toContain('Brak zdarzeń w ostatnich 14 dniach');
  });

  it('has an honest not-connected state', () => {
    const off = render(TimelineView, { props: { data: null, connected: false } });
    expect(text(off.container)).toContain('Połącz konto Garmin');
  });
});

describe('TimelineView — pion / poziom (spec 032)', () => {
  const threeDays = (): TimelineData =>
    data([
      activity({ id: 'a', day: '2026-08-07' }),
      health({ id: 'h', day: '2026-08-06' }),
      activity({ id: 'b', day: '2026-08-04', title: 'Tempo Run', icon: 'run' })
    ]);

  const labels = (container: HTMLElement, sel: string): (string | undefined)[] =>
    Array.from(container.querySelectorAll(sel)).map((n) => n.textContent?.trim());

  it('offers a labelled layout switcher and starts vertical', () => {
    const { container, getByRole } = render(TimelineView, { props: { data: threeDays() } });

    getByRole('radiogroup', { name: 'Układ osi czasu' });
    getByRole('radio', { name: 'Pion' });
    getByRole('radio', { name: 'Poziom' });
    expect(container.querySelector('[data-orientation]')?.getAttribute('data-orientation')).toBe('vertical');
  });

  it('switches to a horizontal, keyboard-reachable scroll axis', async () => {
    const { container, getByRole } = render(TimelineView, { props: { data: threeDays() } });

    await fireEvent.click(getByRole('radio', { name: 'Poziom' }));

    expect(container.querySelector('[data-orientation]')?.getAttribute('data-orientation')).toBe(
      'horizontal'
    );
    const axis = getByRole('group', { name: /Oś czasu/ });
    expect(axis.getAttribute('tabindex')).toBe('0');
    expect(container.querySelectorAll('.col').length).toBeGreaterThan(0);
  });

  it('runs the horizontal axis chronologically (oldest first), unlike the vertical rail', async () => {
    const { container, getByRole } = render(TimelineView, { props: { data: threeDays() } });

    expect(labels(container, '.day-label')).toEqual(['dziś', 'wczoraj', 'wt., 4 sie']);

    await fireEvent.click(getByRole('radio', { name: 'Poziom' }));

    expect(labels(container, '.col-label')).toEqual(['wt., 4 sie', 'wczoraj', 'dziś', 'Co dalej']);
  });

  it('remembers the choice in localStorage', async () => {
    const { getByRole } = render(TimelineView, { props: { data: threeDays() } });

    await fireEvent.click(getByRole('radio', { name: 'Poziom' }));
    expect(localStorage.getItem(TIMELINE_ORIENTATION_KEY)).toBe('horizontal');

    await fireEvent.click(getByRole('radio', { name: 'Pion' }));
    expect(localStorage.getItem(TIMELINE_ORIENTATION_KEY)).toBe('vertical');
  });

  it('restores a stored horizontal layout on mount', () => {
    localStorage.setItem(TIMELINE_ORIENTATION_KEY, 'horizontal');
    const { container } = render(TimelineView, { props: { data: threeDays() } });
    expect(container.querySelector('[data-orientation]')?.getAttribute('data-orientation')).toBe(
      'horizontal'
    );
  });

  it('falls back to vertical for a garbage stored value', () => {
    localStorage.setItem(TIMELINE_ORIENTATION_KEY, 'diagonal');
    const { container } = render(TimelineView, { props: { data: threeDays() } });
    expect(container.querySelector('[data-orientation]')?.getAttribute('data-orientation')).toBe('vertical');
  });

  it('keeps the importance ranking and its expander in the horizontal layout', async () => {
    localStorage.setItem(TIMELINE_ORIENTATION_KEY, 'horizontal');
    const { container, getByRole } = render(TimelineView, {
      props: {
        data: data([
          health({ id: 'h', day: '2026-08-06' }),
          activity({ id: 'walk', day: '2026-08-05', title: 'Easy Walk', primary: false, importance: 33 })
        ])
      }
    });

    expect(text(container)).not.toContain('Easy Walk');
    await fireEvent.click(getByRole('button', { name: 'Pokaż wszystkie zdarzenia (2)' }));
    expect(text(container)).toContain('Easy Walk');
  });

  it('stays truthful about planned workouts on the right-hand half of the axis', () => {
    localStorage.setItem(TIMELINE_ORIENTATION_KEY, 'horizontal');
    const notSynced = render(TimelineView, { props: { data: threeDays() } });
    expect(text(notSynced.container)).toContain('Zaplanowane treningi nie są jeszcze synchronizowane');
    expect(notSynced.container.querySelectorAll('.plan').length).toBe(0);
    cleanup();

    const scheduled = render(TimelineView, {
      props: {
        data: data([activity({ id: 'a', day: '2026-08-07' })], {
          planned: {
            from: '2026-08-08',
            to: '2026-08-14',
            status: 'ok',
            events: [
              {
                id: 'p1',
                day: '2026-08-09',
                time: '07:30',
                kind: 'workout',
                title: 'Interwały 5×3 min',
                sport: 'running',
                description: null,
                estimatedDurationS: 3600,
                estimatedDistanceM: 12_000,
                targetLoad: 95,
                source: 'garmin'
              }
            ]
          }
        })
      }
    });
    expect(text(scheduled.container)).toContain('Interwały 5×3 min');
    expect(text(scheduled.container)).not.toContain('nie są jeszcze synchronizowane');
  });

  it('offers no layout switcher when there is nothing to lay out', () => {
    const off = render(TimelineView, { props: { data: null, connected: false } });
    expect(off.container.querySelector('[role="radiogroup"]')).toBeNull();
    cleanup();

    const noData = render(TimelineView, { props: { data: null } });
    expect(noData.container.querySelector('[role="radiogroup"]')).toBeNull();
  });
});
