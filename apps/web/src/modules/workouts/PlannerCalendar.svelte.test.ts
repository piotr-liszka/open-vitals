/**
 * The month grid's completion marker (spec 081).
 *
 * The grid gets ONE new thing to say — "this planned session was done" — and the tests below are as
 * much about what it must NOT say: no ratio, no day shift, no inferred-versus-known. Those live in
 * the day panel, because a marker that means several things means none of them.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import PlannerCalendar from './PlannerCalendar.svelte';
import type { DayKey } from '$lib/date';

afterEach(cleanup);

const MONTH = '2026-08';
const DAY: DayKey = '2026-08-18';

function draw(
  over: {
    authored?: number;
    done?: number;
    planned?: number;
  } = {}
) {
  return render(PlannerCalendar, {
    props: {
      month: MONTH,
      today: DAY,
      selected: null,
      authoredByDay: new Map<DayKey, number>([[DAY, over.authored ?? 1]]),
      plannedByDay: new Map<DayKey, number>(over.planned ? [[DAY, over.planned]] : []),
      doneByDay: new Map<DayKey, number>(over.done === undefined ? [] : [[DAY, over.done]]),
      onselect: () => undefined,
      onmonth: () => undefined
    }
  });
}

/**
 * The dots on one day cell, as their meaningful class names — the grid's whole vocabulary.
 * Svelte's scoping class is stripped: it is a build artefact, not something the test asserts on.
 */
const dotsOn = (container: HTMLElement, day: DayKey): string[] => {
  const number = String(Number(day.slice(8, 10)));
  const cell = [...container.querySelectorAll('button.day')].find(
    (b) => b.querySelector('.n')?.textContent === number
  );
  return [...(cell?.querySelectorAll('.dot') ?? [])].map((d) =>
    [...d.classList].filter((c) => !c.startsWith('svelte-')).join(' ')
  );
};

describe('PlannerCalendar — completion marker (spec 081)', () => {
  it('draws a planned session that was done in the success family', () => {
    const { container } = draw({ authored: 1, done: 1 });
    // The legend carries one of each, so only the cell is inspected here.
    expect(dotsOn(container, DAY)).toEqual(['dot mine done']);
  });

  it('leaves a session that was not done as a plain planned dot', () => {
    const { container } = draw({ authored: 1 });
    expect(dotsOn(container, DAY)).toEqual(['dot mine']);
  });

  it('draws a day that is half done as both', () => {
    const { container } = draw({ authored: 2, done: 1 });
    expect(dotsOn(container, DAY)).toEqual(['dot mine done', 'dot mine']);
  });

  it('never lets the done count exceed the sessions actually planned', () => {
    // Defensive: a stale map must not add dots to a day that no longer holds those sessions.
    const { container } = draw({ authored: 1, done: 5 });
    expect(dotsOn(container, DAY)).toEqual(['dot mine done']);
  });

  it('says how many were done in the accessible name, where a colour cannot reach', () => {
    const { container } = draw({ authored: 2, done: 1 });
    expect(container.textContent).toContain('2 zaplanowanych treningów');
    expect(container.textContent).toContain('1 wykonanych');
  });

  it('keeps Garmin’s own calendar entries visually apart from a completed session', () => {
    const { container } = draw({ authored: 1, done: 1, planned: 1 });
    expect(dotsOn(container, DAY)).toEqual(['dot mine done', 'dot theirs']);
  });

  it('works with no completion map at all — the planner renders before it knows', () => {
    const { container } = render(PlannerCalendar, {
      props: {
        month: MONTH,
        today: DAY,
        selected: null,
        authoredByDay: new Map<DayKey, number>([[DAY, 1]]),
        plannedByDay: new Map<DayKey, number>(),
        onselect: () => undefined,
        onmonth: () => undefined
      }
    });
    expect(dotsOn(container, DAY)).toEqual(['dot mine']);
  });
});
