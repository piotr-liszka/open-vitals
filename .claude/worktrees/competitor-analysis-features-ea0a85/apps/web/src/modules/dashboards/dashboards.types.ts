/**
 * Configurable dashboards (spec 016). A user can have MANY dashboards, each holding MANY widgets in
 * an order they control (add / remove / move). The whole layout is a small JSON doc persisted in the
 * per-user `settings` bag under `dashboards` — no schema migration, trivially versionable.
 *
 * Since spec 064 each dashboard is a real destination with its own URL and its own sidebar entry, so
 * the config no longer carries an `activeId`: the active dashboard IS the URL. That field was state
 * that could disagree with what the reader was looking at, and deleting it removes the disagreement
 * rather than keeping the two in sync. Configs written before then still load — `sanitizeConfig`
 * simply ignores the key.
 */

/**
 * Every widget kind the registry can render, in the order the "add widget" picker offers them.
 * Adding one = one entry here + one in the registry + a component.
 *
 * The VALUES live here rather than in `widget-registry.ts` because the server needs them: the
 * sanitizer has to reject an unknown type, and it cannot import the registry without dragging six
 * Svelte components into the server bundle. They used to be typed out twice for that reason — one
 * list to define the union, one to validate against it — which is two places to forget a widget.
 */
export const WIDGET_TYPES = [
  'streak',
  'coverage',
  'weekly-volume',
  'activity-types',
  'recent-activities',
  'metric-trend'
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

/** Widget column span on the 12-col grid (responsive collapses on small screens). */
export type WidgetSpan = 4 | 6 | 8 | 12;

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  span: WidgetSpan;
  /** Widget-specific options (e.g. which metric a metric-trend shows). */
  options?: Record<string, unknown>;
}

export interface DashboardDef {
  /** Stable, URL-safe, unique within the user's config — it IS the route segment. */
  id: string;
  /** The name shown as the page title AND as the sidebar entry (spec 064). */
  name: string;
  widgets: WidgetInstance[];
}

export interface DashboardConfig {
  /** Never empty: `sanitizeConfig` falls back to the default rather than return zero dashboards. */
  dashboards: DashboardDef[];
}

/** The slice of a dashboard the sidebar needs. Deliberately not the widgets — the nav never draws them. */
export interface DashboardNavEntry {
  id: string;
  name: string;
}

/** Longest a dashboard name may be; longer names are truncated by `sanitizeConfig`. */
export const MAX_DASHBOARD_NAME = 60;
