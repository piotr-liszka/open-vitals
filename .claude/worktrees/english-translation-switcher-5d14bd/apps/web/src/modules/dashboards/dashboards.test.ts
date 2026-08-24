import { createTranslator } from '$lib/i18n';
import { describe, it, expect } from 'vitest';
import {
  mondayOf,
  recentWeeks,
  weeklyVolume,
  activeWeekStreak,
  typeBreakdown,
  loadWidgetData
} from './dashboard-data';
import { createMemoryStore } from '$lib/server/store/memory';
import { fixedClock } from '$lib/server/clock';
import { sanitizeConfig, defaultConfig, getConfig, saveConfig } from './dashboards.api';
import { dashboardNavItems, NAV_GROUP_DASHBOARDS, NEW_DASHBOARD_HREF } from './dashboard-nav';
import { moveItem } from './reorder';
import { navGroups } from '$lib/nav';
import { createMemorySettingsRepo } from '$lib/server/repo/memory';
import { resolveRange } from '$lib/range';
import { WIDGETS, WIDGET_TYPES } from './widget-registry';
import type { ActivitySummary } from '$lib/server/store/types';

const t = createTranslator('pl');

function act(day: string, over: Partial<ActivitySummary> = {}): ActivitySummary {
  return {
    userId: 'u',
    activityId: `a-${day}-${Math.random()}`,
    sport: 'cycling',
    name: null,
    startTime: `${day}T09:00:00Z`,
    startTimeLocal: `${day} 09:00:00`,
    distanceM: 20000,
    durationS: 3600,
    movingS: 3600,
    elevationGainM: 100,
    avgHr: 140,
    maxHr: 170,
    avgPower: 200,
    maxPower: 500,
    normPower: 210,
    calories: 500,
    trainingLoad: 50,
    hasGps: false,
    raw: {},
    ...over
  };
}

describe('dashboard-data maths', () => {
  it('mondayOf snaps to the ISO week Monday', () => {
    expect(mondayOf('2026-08-09')).toBe('2026-08-03'); // Sunday → that week's Monday
    expect(mondayOf('2026-08-03')).toBe('2026-08-03'); // Monday → itself
  });

  it("recentWeeks returns N Mondays ending with today's week", () => {
    const w = recentWeeks('2026-08-09', 3);
    expect(w).toEqual(['2026-07-20', '2026-07-27', '2026-08-03']);
  });

  it('weeklyVolume sums moving hours per week', () => {
    const acts = [
      act('2026-08-04', { movingS: 3600 }),
      act('2026-08-05', { movingS: 1800 }),
      act('2026-07-28', { movingS: 7200 })
    ];
    const vol = weeklyVolume(acts, '2026-08-09', 3);
    expect(vol.find((v) => v.week === '2026-08-03')).toEqual({
      week: '2026-08-03',
      hours: 1.5,
      activities: 2
    });
    expect(vol.find((v) => v.week === '2026-07-27')).toEqual({ week: '2026-07-27', hours: 2, activities: 1 });
  });

  it('activeWeekStreak counts consecutive weeks with activity (current week may be empty)', () => {
    // Activities in the last 2 full weeks but not the current week → streak 2.
    const acts = [act('2026-07-28'), act('2026-08-05')];
    expect(activeWeekStreak(acts, '2026-08-13')).toBe(2);
    // A gap breaks it.
    expect(activeWeekStreak([act('2026-07-28'), act('2026-08-12')], '2026-08-13')).toBe(1);
  });

  it('skips an activity whose local timestamp is malformed instead of throwing', () => {
    const acts = [act('2026-08-04'), act('2026-08-05', { startTimeLocal: 'not-a-date' })];
    const vol = weeklyVolume(acts, '2026-08-09', 2);
    expect(vol.find((v) => v.week === '2026-08-03')!.activities).toBe(1);
    expect(activeWeekStreak(acts, '2026-08-09')).toBe(1);
  });

  it('typeBreakdown counts sports most-frequent first', () => {
    const acts = [
      act('2026-08-01', { sport: 'cycling' }),
      act('2026-08-02', { sport: 'running' }),
      act('2026-08-03', { sport: 'cycling' })
    ];
    expect(typeBreakdown(acts)).toEqual([
      { sport: 'cycling', count: 2 },
      { sport: 'running', count: 1 }
    ]);
  });
});

describe('loadWidgetData "today" resolution (spec 018)', () => {
  it('buckets against the local day, not the UTC day', async () => {
    const store = createMemoryStore();
    // 22:30Z on 6 Aug 2026 = 00:30 local on 7 Aug in Warsaw.
    const clock = fixedClock(new Date('2026-08-06T22:30:00.000Z'));

    const local = await loadWidgetData(store, 'u', clock, 'Europe/Warsaw');
    const utc = await loadWidgetData(store, 'u', clock, 'UTC');

    // The volume window ends with the week containing the *local* today. Its LENGTH now comes from
    // the global range (spec 047) — the default 7-day range spans two ISO weeks here.
    expect(local.weeklyVolume.at(-1)!.week).toBe('2026-08-03');
    expect(utc.weeklyVolume.at(-1)!.week).toBe('2026-08-03');
    // Same week here, but the metric window differs by a day.
    expect(local.metricSeries.steps!.at(-1)!.date).toBe('2026-08-07');
    expect(utc.metricSeries.steps!.at(-1)!.date).toBe('2026-08-06');
    expect(local.metricSeries.steps).toHaveLength(7);
  });

  it('defaults to the app timezone when none is passed', async () => {
    const store = createMemoryStore();
    const data = await loadWidgetData(store, 'u', fixedClock(new Date('2026-08-06T22:30:00.000Z')));
    expect(data.metricSeries.steps!.at(-1)!.date).toBe('2026-08-07');
  });
});

describe('dashboard config', () => {
  it('sanitizes unknown widget types and bad spans', () => {
    const clean = sanitizeConfig(t, {
      dashboards: [
        { id: 'x', name: 'My board', widgets: [{ id: 'a', type: 'streak', span: 99 }, { type: 'bogus' }] }
      ]
    });
    expect(clean.dashboards[0]!.widgets).toHaveLength(1); // bogus dropped
    expect(clean.dashboards[0]!.widgets[0]!.span).toBe(6); // clamped
  });

  it('falls back to the default when empty/garbage', () => {
    expect(sanitizeConfig(t, null)).toEqual(defaultConfig(t));
    expect(sanitizeConfig(t, { dashboards: [] })).toEqual(defaultConfig(t));
  });

  it('round-trips through the settings repo', async () => {
    const settings = createMemorySettingsRepo();
    expect(await getConfig(t, settings, 'u')).toEqual(defaultConfig(t));
    const cfg = {
      dashboards: [{ id: 'main', name: 'Home', widgets: [{ id: 'w', type: 'coverage', span: 12 }] }]
    };
    const saved = await saveConfig(t, settings, 'u', cfg);
    expect(saved.dashboards[0]!.widgets[0]!.span).toBe(12);
    expect(await getConfig(t, settings, 'u')).toEqual(saved);
  });

  /**
   * Spec 064 turned the id into a route segment, which put three new demands on it that the old model
   * never had: it has to survive being in a URL, it has to be unique, and it must not shadow a real
   * page under `/dashboard/`.
   */
  describe('ids are route segments now (spec 064)', () => {
    it('drops the legacy activeId instead of choking on an old stored config', () => {
      const clean = sanitizeConfig(t, {
        activeId: 'main',
        dashboards: [{ id: 'main', name: 'Home', widgets: [] }]
      });
      expect(clean).not.toHaveProperty('activeId');
      expect(clean.dashboards).toHaveLength(1);
    });

    it('reduces an id to something safe to put in a path', () => {
      const clean = sanitizeConfig(t, {
        dashboards: [{ id: 'My Panel/../etc', name: 'X', widgets: [] }]
      });
      expect(clean.dashboards[0]!.id).toBe('my-panel-etc');
    });

    it('de-duplicates ids rather than dropping a dashboard', () => {
      const clean = sanitizeConfig(t, {
        dashboards: [
          { id: 'plan', name: 'A', widgets: [] },
          { id: 'plan', name: 'B', widgets: [] },
          { id: 'plan!', name: 'C', widgets: [] }
        ]
      });
      // Losing a panel is a worse outcome than renaming its URL, so nothing is discarded.
      expect(clean.dashboards.map((d) => d.id)).toEqual(['plan', 'plan-2', 'plan-3']);
      expect(clean.dashboards.map((d) => d.name)).toEqual(['A', 'B', 'C']);
    });

    it('refuses `new`, which is the create page', () => {
      const clean = sanitizeConfig(t, { dashboards: [{ id: 'new', name: 'X', widgets: [] }] });
      // Shadowing it would make the create page unreachable AND this panel unreachable.
      expect(clean.dashboards[0]!.id).not.toBe('new');
    });

    it('never returns zero dashboards, so the nav and /dashboard always have a target', () => {
      for (const junk of [null, {}, { dashboards: [] }, { dashboards: [null, 7, 'x'] }]) {
        expect(sanitizeConfig(t, junk).dashboards.length).toBeGreaterThan(0);
      }
    });
  });

  describe('nav placement (spec 064)', () => {
    it('lists one entry per dashboard, then the create entry last', () => {
      const items = dashboardNavItems([
        { id: 'main', name: 'Przegląd' },
        { id: 'plan', name: 'Plan startowy' }
      ]);
      expect(items.map((i) => i.label)).toEqual(['Przegląd', 'Plan startowy', 'Nowy panel']);
      expect(items.map((i) => i.href)).toEqual(['/dashboard/main', '/dashboard/plan', NEW_DASHBOARD_HREF]);
    });

    it('puts every entry in the Panele group', () => {
      for (const item of dashboardNavItems([{ id: 'a', name: 'A' }])) {
        expect(item.group).toBe(NAV_GROUP_DASHBOARDS);
      }
    });

    it('still offers the create entry when the user has no dashboards at all', () => {
      expect(dashboardNavItems([]).map((i) => i.href)).toEqual([NEW_DASHBOARD_HREF]);
    });

    it('sits directly below Start and above Trening in the sidebar', () => {
      const groups = navGroups(dashboardNavItems([{ id: 'main', name: 'Przegląd' }]));
      expect(groups.map((g) => g.group)).toEqual([
        undefined,
        NAV_GROUP_DASHBOARDS,
        'Trening',
        'Zdrowie',
        'System'
      ]);
      expect(groups[0]!.items.map((i) => i.label)).toEqual(['Start']);
    });
  });

  /**
   * The drag layer only decides `from` and `to`; everything else about a move is this function, which
   * is why the mouse drag and the keyboard arrows provably agree.
   */
  describe('reordering (spec 064)', () => {
    it('moves an item to a later slot', () => {
      expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    });

    it('moves an item to an earlier slot', () => {
      expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    });

    it('returns the SAME reference for a no-op, so a pointless save can be skipped', () => {
      const items = ['a', 'b', 'c'];
      expect(moveItem(items, 1, 1)).toBe(items);
      expect(moveItem(items, -1, 1)).toBe(items);
      expect(moveItem(items, 0, 9)).toBe(items);
    });

    it('never loses or duplicates an item', () => {
      const items = ['a', 'b', 'c', 'd', 'e'];
      for (let from = 0; from < items.length; from++) {
        for (let to = 0; to < items.length; to++) {
          expect([...moveItem(items, from, to)].sort()).toEqual([...items].sort());
        }
      }
    });
  });
});

describe('loadWidgetData and the global range (spec 047)', () => {
  const clock = fixedClock(new Date('2026-08-07T10:00:00.000Z'));
  const TODAY = '2026-08-07';

  async function seeded() {
    const store = createMemoryStore();
    await store.putActivities('u', [
      // Inside a 7-day window.
      act('2026-08-05', { sport: 'running' }),
      // Inside 30 days, outside 7.
      act('2026-07-20', { sport: 'cycling' }),
      // Well outside both.
      act('2025-11-02', { sport: 'walking' })
    ]);
    return store;
  }

  it('windows the sport split, the recent list and the volume buckets', async () => {
    const store = await seeded();

    const week = await loadWidgetData(store, 'u', clock, 'Europe/Warsaw', resolveRange('7', TODAY));
    expect(week.typeBreakdown.map((t) => t.sport)).toEqual(['running']);
    expect(week.recentActivities).toHaveLength(1);

    const month = await loadWidgetData(store, 'u', clock, 'Europe/Warsaw', resolveRange('30', TODAY));
    expect(month.typeBreakdown.map((t) => t.sport).sort()).toEqual(['cycling', 'running']);
    expect(month.recentActivities).toHaveLength(2);
    // Newest first, so the range never reorders the list.
    expect(month.recentActivities[0]!.startTimeLocal.startsWith('2026-08-05')).toBe(true);
  });

  it('leaves coverage and the active-week streak all-time', async () => {
    const store = await seeded();
    const week = await loadWidgetData(store, 'u', clock, 'Europe/Warsaw', resolveRange('7', TODAY));
    const all = await loadWidgetData(
      store,
      'u',
      clock,
      'Europe/Warsaw',
      resolveRange('all', TODAY, '2025-01-01')
    );

    // Both see every activity: "how much data do I hold" and "how long is my streak" are not
    // questions a window can narrow.
    expect(week.coverage.activities.count).toBe(3);
    expect(all.coverage.activities.count).toBe(3);
    expect(week.streakWeeks).toBe(all.streakWeeks);
  });

  it('buckets the volume bars and the metric sparklines for a long range', async () => {
    const store = await seeded();
    const all = await loadWidgetData(
      store,
      'u',
      clock,
      'Europe/Warsaw',
      resolveRange('all', TODAY, '2025-01-01')
    );

    // Monthly bars, not ~85 weekly ones.
    expect(all.weeklyVolume.every((b) => b.week.endsWith('-01'))).toBe(true);
    expect(all.weeklyVolume.length).toBeLessThan(24);
    expect(all.metricSeries.steps!.every((p) => p.date.endsWith('-01'))).toBe(true);
  });

  it('every widget declares whether it follows the range', () => {
    // The registry is what the grid reads to decide which cards carry an indicator, so an added
    // widget must make the claim explicitly rather than defaulting into one.
    for (const type of WIDGET_TYPES) {
      expect(typeof WIDGETS[type].ranged, `${type} must declare \`ranged\``).toBe('boolean');
    }
    expect(WIDGETS.coverage.ranged).toBe(false);
    expect(WIDGETS.streak.ranged).toBe(false);
    expect(WIDGETS['weekly-volume'].ranged).toBe(true);
    expect(WIDGETS['metric-trend'].ranged).toBe(true);
  });
});
