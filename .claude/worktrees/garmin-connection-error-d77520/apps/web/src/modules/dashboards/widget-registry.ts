/**
 * Widget registry (spec 016) — the extension point. Add a widget by adding its type to
 * `WidgetType`, a component under `widgets/`, and one entry here. The grid renders purely from this
 * map, so no other file needs to change.
 */
import type { Component } from 'svelte';
import { WIDGET_TYPES, type WidgetSpan, type WidgetType } from './dashboards.types';
import type { WidgetData } from './dashboard-data';
import StreakWidget from './widgets/StreakWidget.svelte';
import CoverageWidget from './widgets/CoverageWidget.svelte';
import WeeklyVolumeWidget from './widgets/WeeklyVolumeWidget.svelte';
import ActivityTypesWidget from './widgets/ActivityTypesWidget.svelte';
import RecentActivitiesWidget from './widgets/RecentActivitiesWidget.svelte';
import MetricTrendWidget from './widgets/MetricTrendWidget.svelte';

/** All built-in widgets share this prop contract (options ignored by widgets that don't use it). */
export type WidgetComponent = Component<{ data: WidgetData; options?: Record<string, unknown> }>;

export interface WidgetDef {
  label: string;
  description: string;
  defaultSpan: WidgetSpan;
  component: WidgetComponent;
  /**
   * Whether this widget's content is windowed by the global range (spec 047). The grid reads this to
   * decide which cards carry a range indicator — so adding a range-aware widget is one flag here, and
   * a widget a user drops onto their panel inherits the behaviour without touching the grid.
   *
   * `false` is a claim, not a default: it says "this number is all-time and the switch will not move
   * it" (coverage, the active-week streak).
   */
  ranged: boolean;
  /**
   * The page that shows this widget's subject properly, when one exists (spec 048). Every built-in
   * widget except `streak` is a smaller view of a page that has the room to do the job well, and the
   * audit that demoted this Panel found readers had no way to know that. The grid renders it as a
   * quiet link in the card footer rather than hiding the overlap.
   */
  seeAlso?: { href: string; label: string };
}

export const WIDGETS: Record<WidgetType, WidgetDef> = {
  streak: {
    label: 'Seria',
    description: 'Tygodnie z aktywnością pod rząd',
    defaultSpan: 4,
    component: StreakWidget,
    // A streak is "how long, ever" — a window would truncate it into a different, smaller claim.
    ranged: false
  },
  coverage: {
    label: 'Zebrane dane',
    description: 'Ile danych masz lokalnie',
    defaultSpan: 8,
    component: CoverageWidget,
    // Reports the whole local store, which is exactly what a range must not narrow.
    ranged: false,
    seeAlso: { href: '/data', label: 'Pełny obraz w Dane' }
  },
  'weekly-volume': {
    label: 'Objętość treningu',
    description: 'Godziny treningu na tydzień (miesiąc w długich zakresach)',
    defaultSpan: 6,
    component: WeeklyVolumeWidget,
    ranged: true,
    seeAlso: { href: '/training', label: 'Pełny obraz w Trening' }
  },
  'activity-types': {
    label: 'Typy aktywności',
    description: 'Podział wg sportu w wybranym zakresie',
    defaultSpan: 6,
    component: ActivityTypesWidget,
    ranged: true,
    seeAlso: { href: '/training', label: 'Pełny obraz w Trening' }
  },
  'recent-activities': {
    label: 'Ostatnie aktywności',
    description: 'Najnowsze treningi z wybranego zakresu',
    defaultSpan: 6,
    component: RecentActivitiesWidget,
    ranged: true,
    seeAlso: { href: '/activities', label: 'Pełny obraz w Aktywności' }
  },
  'metric-trend': {
    label: 'Trend metryki',
    description: 'Wykres metryki w wybranym zakresie',
    defaultSpan: 6,
    component: MetricTrendWidget,
    ranged: true,
    seeAlso: { href: '/insights', label: 'Pełny obraz w Wnioski' }
  }
};

/**
 * Re-exported so the grid keeps importing "what can I add" from the registry, which is where a
 * reader looks for it. The order is the picker's order and it is `dashboards.types`' to decide —
 * `Record<WidgetType, WidgetDef>` above is what guarantees every one of them is actually renderable.
 */
export { WIDGET_TYPES };
