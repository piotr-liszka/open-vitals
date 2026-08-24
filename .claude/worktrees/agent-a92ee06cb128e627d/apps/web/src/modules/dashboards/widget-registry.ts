/**
 * Widget registry (spec 016) — the extension point. Add a widget by adding its type to
 * `WidgetType`, a component under `widgets/`, and one entry here. The grid renders purely from this
 * map, so no other file needs to change.
 */
import type { Component } from 'svelte';
import { WIDGET_TYPES, type WidgetSpan, type WidgetType } from './dashboards.types';
import type { WidgetData } from './dashboard-data';
import type { MessageKey } from '$lib/i18n';
import StreakWidget from './widgets/StreakWidget.svelte';
import CoverageWidget from './widgets/CoverageWidget.svelte';
import WeeklyVolumeWidget from './widgets/WeeklyVolumeWidget.svelte';
import ActivityTypesWidget from './widgets/ActivityTypesWidget.svelte';
import RecentActivitiesWidget from './widgets/RecentActivitiesWidget.svelte';
import MetricTrendWidget from './widgets/MetricTrendWidget.svelte';

/** All built-in widgets share this prop contract (options ignored by widgets that don't use it). */
export type WidgetComponent = Component<{ data: WidgetData; options?: Record<string, unknown> }>;

export interface WidgetDef {
  /**
   * Message keys, not words (spec 076): this registry is a module-level constant evaluated once at
   * import time, so it is shared by every request and cannot hold text in any one reader's language.
   */
  labelKey: MessageKey;
  descriptionKey: MessageKey;
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
  seeAlso?: { href: string; pageKey: MessageKey };
}

export const WIDGETS: Record<WidgetType, WidgetDef> = {
  streak: {
    labelKey: 'widget.streak.label',
    descriptionKey: 'widget.streak.description',
    defaultSpan: 4,
    component: StreakWidget,
    // A streak is "how long, ever" — a window would truncate it into a different, smaller claim.
    ranged: false
  },
  coverage: {
    labelKey: 'widget.coverage.label',
    descriptionKey: 'widget.coverage.description',
    defaultSpan: 8,
    component: CoverageWidget,
    // Reports the whole local store, which is exactly what a range must not narrow.
    ranged: false,
    seeAlso: { href: '/data', pageKey: 'nav.data' }
  },
  'weekly-volume': {
    labelKey: 'widget.weeklyVolume.label',
    descriptionKey: 'widget.weeklyVolume.description',
    defaultSpan: 6,
    component: WeeklyVolumeWidget,
    ranged: true,
    seeAlso: { href: '/training', pageKey: 'nav.training' }
  },
  'activity-types': {
    labelKey: 'widget.activityTypes.label',
    descriptionKey: 'widget.activityTypes.description',
    defaultSpan: 6,
    component: ActivityTypesWidget,
    ranged: true,
    seeAlso: { href: '/training', pageKey: 'nav.training' }
  },
  'recent-activities': {
    labelKey: 'widget.recentActivities.label',
    descriptionKey: 'widget.recentActivities.description',
    defaultSpan: 6,
    component: RecentActivitiesWidget,
    ranged: true,
    seeAlso: { href: '/activities', pageKey: 'nav.activities' }
  },
  'metric-trend': {
    labelKey: 'widget.metricTrend.label',
    descriptionKey: 'widget.metricTrend.description',
    defaultSpan: 6,
    component: MetricTrendWidget,
    ranged: true,
    seeAlso: { href: '/insights', pageKey: 'nav.insights' }
  }
};

/**
 * Re-exported so the grid keeps importing "what can I add" from the registry, which is where a
 * reader looks for it. The order is the picker's order and it is `dashboards.types`' to decide —
 * `Record<WidgetType, WidgetDef>` above is what guarantees every one of them is actually renderable.
 */
export { WIDGET_TYPES };
