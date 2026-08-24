/**
 * Where dashboards sit in the primary nav (spec 064). Pure: entries in, nav items out — no store, no
 * routing, no config. Lives in the module rather than in `$lib/nav` because the placement is a fact
 * about dashboards, and `$lib/nav` should not have to know that one of its groups is user-generated.
 *
 * Client-safe (no `$lib/server` import), because `NavLinks` runs in the browser.
 */
import type { NavItem } from '$lib/nav';
import type { DashboardNavEntry } from './dashboards.types';

/** Heading the dashboards live under. */
export const NAV_GROUP_DASHBOARDS = 'Panele';

/** Where the create page lives. A page and not a nav action — see the spec's note on preloading. */
export const NEW_DASHBOARD_HREF = '/dashboard/new';

export const dashboardHref = (id: string): string => `/dashboard/${id}`;

/**
 * The `Panele` group: one entry per dashboard, then the create entry.
 *
 * The create entry is a `NavItem` like any other rather than a special button, so the sidebar keeps
 * one kind of child and `NavLinks` needs no branch for it. Its `plus` glyph is what tells a reader it
 * is not a destination they already own.
 */
export function dashboardNavItems(entries: readonly DashboardNavEntry[]): NavItem[] {
  const items: NavItem[] = entries.map((d) => ({
    href: dashboardHref(d.id),
    label: d.name,
    icon: 'grid',
    group: NAV_GROUP_DASHBOARDS
  }));
  items.push({
    href: NEW_DASHBOARD_HREF,
    label: 'Nowy panel',
    icon: 'plus',
    group: NAV_GROUP_DASHBOARDS
  });
  return items;
}
