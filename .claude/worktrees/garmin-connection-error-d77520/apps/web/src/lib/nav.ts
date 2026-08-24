/**
 * Single source of truth for primary navigation (spec 015+). Adding a subpage = adding one entry
 * here; `NavLinks` renders them and `AppShell` mounts it in the sidebar for every page (spec 063 —
 * pages used to each pass an identical snippet). Every item is always shown — the tier filter this
 * list used to carry died with the tiers themselves (spec 071).
 *
 * Spec 048 took this from nine flat items to seven in three labelled groups. The flat list had grown
 * past the point where a reader could see its shape, and it had drifted out of any reading order:
 * three activity pages sat between the start page's body metrics and the two pages that analysed
 * them. Grouping states the model — what you did, how your body is, and the plumbing — and the
 * consolidations below removed the items that were duplicating each other.
 */
import type { IconName } from '$lib/ui/icons';

export interface NavItem {
  href: string;
  label: string;
  /**
   * Glyph from the shared set (spec 063). REQUIRED, and that is the point: the sidebar uses "has an
   * icon" as the visual predicate for "is a destination", so a text-only entry would read as a group
   * heading. It is also the entire content of the icon-only collapsed state.
   */
  icon: IconName;
  /**
   * Heading this item sits under. Items sharing a group MUST be adjacent — `NavLinks` renders one
   * heading per run, so a split group would render its heading twice. Omitted = no heading.
   */
  group?: string;
}

export const NAV_GROUP_TRAINING = 'Trening';
export const NAV_GROUP_HEALTH = 'Zdrowie';
export const NAV_GROUP_SYSTEM = 'System';

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Start', icon: 'home' },

  // What you did. `/training` is a multi-sport section with per-sport subpages behind a SubNav
  // (spec 025); `/activities` is the same shape since spec 048, with the list and the heat map as
  // tabs — the map was a top-level item for a while, but it only ever showed the activities the list
  // already held, filtered by sport and year.
  { href: '/training', label: 'Trening', icon: 'flame', group: NAV_GROUP_TRAINING },
  { href: '/activities', label: 'Aktywności', icon: 'list', group: NAV_GROUP_TRAINING },

  // How your body is. `Analityka` used to sit beside this: same metrics, same charts, same range
  // once spec 047 unified the window — so its summary statistics moved onto these chart cards and
  // the page became a redirect (spec 048).
  { href: '/insights', label: 'Wnioski', icon: 'sparkle', group: NAV_GROUP_HEALTH },

  // The plumbing. The single `Panel` entry that used to close this group is gone (spec 064): every
  // dashboard is now its own entry in the `Panele` group, injected below `Start` by `navGroups`.
  { href: '/data', label: 'Dane', icon: 'database', group: NAV_GROUP_SYSTEM },
  { href: '/settings', label: 'Ustawienia', icon: 'settings', group: NAV_GROUP_SYSTEM }
];

/** One heading and the items under it. */
export interface NavGroup {
  /** Undefined for the leading ungrouped run (just `Start` today). */
  group?: string | undefined;
  items: NavItem[];
}

/**
 * The whole nav, collapsed into runs of adjacent items sharing a group.
 *
 * `dashboards` (spec 064) is the one user-generated run: the caller builds it with
 * `dashboardNavItems` and it is spliced in directly after the leading ungrouped `Start`. It arrives
 * as items rather than as raw dashboards so this module needs to know nothing about them — the group
 * is placed here, and what it contains is the dashboards module's business.
 */
export function navGroups(dashboards: readonly NavItem[] = []): NavGroup[] {
  const [start, ...rest] = NAV_ITEMS;
  const all = [start!, ...dashboards, ...rest];

  const groups: NavGroup[] = [];
  for (const item of all) {
    const last = groups[groups.length - 1];
    if (last && last.group === item.group) last.items.push(item);
    else groups.push({ group: item.group, items: [item] });
  }
  return groups;
}
