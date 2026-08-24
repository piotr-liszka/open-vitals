import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import ActivityMatchedRoute from './ActivityMatchedRoute.svelte';
import type { MatchedRoute, MatchedRouteEntry } from './activity-detail.types';

afterEach(cleanup);

function entry(over: Partial<MatchedRouteEntry> = {}): MatchedRouteEntry {
  return {
    activityId: 'x',
    day: '2026-04-01',
    name: null,
    distanceM: 10_000,
    durationS: 3000,
    avgHr: 150,
    paceSecPerKm: 300,
    similarity: 0.94,
    rank: 1,
    isCurrent: false,
    ...over
  };
}

function route(over: Partial<MatchedRoute> = {}): MatchedRoute {
  const entries = [
    entry({ activityId: 'fast', rank: 1, paceSecPerKm: 285 }),
    entry({ activityId: 'a', rank: 2, paceSecPerKm: 300, isCurrent: true, day: '2026-05-01' })
  ];
  return {
    entries,
    currentRank: 2,
    previousCount: 1,
    bestPaceSecPerKm: 285,
    comparedCount: 40,
    ...over
  };
}

describe('ActivityMatchedRoute', () => {
  /*
   * Spec 065 turned this from a whole card into the content of a tab, and a tab you can select and be
   * shown nothing is a bug — so the two "no match" cases now each say WHY, and they say different
   * things: no track was recorded at all, versus a track that matched nothing.
   */
  it('explains a missing GPS track, and points at the other tab', () => {
    const { container } = render(ActivityMatchedRoute, { props: { route: null } });
    expect(container.textContent).toContain('nie ma zapisanej trasy GPS');
    expect(container.textContent).toContain('Podobny wysiłek');
    expect(container.querySelector('table')).toBeNull();
  });

  it('explains a track that matched nothing, without blaming a missing recording', () => {
    const { container } = render(ActivityMatchedRoute, {
      props: { route: route({ previousCount: 0, entries: [entry({ isCurrent: true })] }) }
    });
    expect(container.textContent).toContain('Nie znaleziono wcześniejszych przejść');
    expect(container.textContent).not.toContain('nie ma zapisanej trasy GPS');
    expect(container.querySelector('table')).toBeNull();
  });

  it('draws no card chrome of its own — it lives inside the comparison card now', () => {
    const { container } = render(ActivityMatchedRoute, { props: { route: route() } });
    expect(container.querySelector('.card')).toBeNull();
  });

  it('says how many earlier outings were found, inflected', () => {
    const one = render(ActivityMatchedRoute, { props: { route: route({ previousCount: 1 }) } });
    expect(one.container.textContent).toContain('1 wcześniejsze przejście');

    cleanup();
    const many = render(ActivityMatchedRoute, { props: { route: route({ previousCount: 13 }) } });
    expect(many.container.textContent).toContain('13 wcześniejszych przejść');
  });

  it('states the placing and the gap to the route‘s best', () => {
    const { getByText } = render(ActivityMatchedRoute, { props: { route: route() } });
    expect(getByText('2. najszybszy raz')).toBeTruthy();
    // 300 − 285 = 15 s/km.
    expect(getByText(/brakuje 0:15 na kilometrze/)).toBeTruthy();
  });

  it('celebrates a route best', () => {
    const { getByText } = render(ActivityMatchedRoute, {
      props: { route: route({ currentRank: 1 }) }
    });
    expect(getByText('Najszybszy raz')).toBeTruthy();
  });

  it('omits the verdict when this outing has no comparable pace', () => {
    const { container } = render(ActivityMatchedRoute, {
      props: { route: route({ currentRank: null }) }
    });
    expect(container.querySelector('.verdict')).toBeNull();
    // The table is still worth showing.
    expect(container.querySelector('table')).not.toBeNull();
  });

  it('marks the row the reader is on and links only the others', () => {
    const { container } = render(ActivityMatchedRoute, { props: { route: route() } });
    const rows = [...container.querySelectorAll('tbody tr')];
    expect(rows[0]?.classList.contains('current')).toBe(false);
    expect(rows[1]?.classList.contains('current')).toBe(true);
    expect(rows[1]?.textContent).toContain('ta aktywność');
    expect(rows[0]?.querySelector('a')?.getAttribute('href')).toBe('/activities/fast');
    expect(rows[1]?.querySelector('a')).toBeNull();
  });

  it('shows the overlap per row and explains the matching method behind a disclosure', async () => {
    const { container, getByRole } = render(ActivityMatchedRoute, { props: { route: route() } });
    expect(container.textContent).toContain('94%');
    const trigger = getByRole('button', { name: 'Jak dopasowujemy trasy?' });
    await trigger.click();
    const panel = getByRole('group', { name: 'Jak dopasowujemy trasy?' });
    expect(panel.textContent).toMatch(/nie dowód/);
    expect(panel.textContent).toMatch(/Porównano 40 zapisanych tras/);
  });

  it('says direction does not matter, since the engine ignores it', async () => {
    const { getByRole } = render(ActivityMatchedRoute, { props: { route: route() } });
    const trigger = getByRole('button', { name: 'Jak dopasowujemy trasy?' });
    await trigger.click();
    const panel = getByRole('group', { name: 'Jak dopasowujemy trasy?' });
    expect(panel.textContent).toMatch(/na odwrót też się dopasuje/);
  });

  it('renders a dash rather than a zero for an outing with no pace or heart rate', () => {
    const { container } = render(ActivityMatchedRoute, {
      props: {
        route: route({
          entries: [
            entry({ activityId: 'a', isCurrent: true, paceSecPerKm: 300 }),
            entry({ activityId: 'odd', rank: 2, paceSecPerKm: null, avgHr: null })
          ],
          currentRank: 1
        })
      }
    });
    const cells = [...container.querySelectorAll('tbody tr')[1]!.querySelectorAll('td')];
    expect(cells[1]?.textContent?.trim()).toBe('—');
  });
});
