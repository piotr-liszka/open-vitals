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
 *
 * Labels come from the message catalog (spec 088): the list is now built by a function taking a
 * `Translator` rather than being a frozen array of Polish strings. The `nav.*` keys had existed
 * since spec 076 with nothing reading them, which is exactly how a "translated" app ships an
 * untranslatable sidebar.
 */
import type { IconName } from '$lib/ui/icons';
import type { MessageKey, Translator } from '$lib/i18n';

export interface NavItem {
  href: string;
  /** Rendered label, already translated — dashboards (spec 064) supply a user-chosen name here. */
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
  /**
   * Extra paths this entry is the sidebar home of, for a section whose pages do not all sit under
   * one prefix (spec 088). `Plan treningowy` is `/training/plan` and owns `/training/goals`, which
   * longest-match would otherwise hand to `/training` — lighting up `Analiza` while the tab bar on
   * screen is the plan's. Each entry is matched exactly as `href` is: the path itself and anything
   * under it.
   */
  owns?: readonly string[];
}

export const NAV_GROUP_TRAINING: MessageKey = 'nav.group.training';
export const NAV_GROUP_HEALTH: MessageKey = 'nav.group.health';
export const NAV_GROUP_SYSTEM: MessageKey = 'nav.group.system';

/** The fixed part of the nav, in reading order. `isAdmin` (spec 094) appends the "Admin" entry to the
 *  system group — the only nav item gated on anything besides being signed in. */
export function navItems(t: Translator, isAdmin = false): NavItem[] {
  const training = t(NAV_GROUP_TRAINING);
  const health = t(NAV_GROUP_HEALTH);
  const system = t(NAV_GROUP_SYSTEM);

  return [
    { href: '/', label: t('nav.start'), icon: 'home' },

    // What you did, and what you are going to do. The training section used to be ONE entry with a
    // seven-tab bar (spec 088): five tabs analysing what already happened plus two where the athlete
    // decides what happens next, presented as peers. They are not peers, so they are two entries,
    // each owning its own tab set — and both keep their existing URLs, so no bookmark broke.
    // `/activities` is the same section shape since spec 048, with the list and the heat map as tabs.
    { href: '/training', label: t('nav.analysis'), icon: 'activity', group: training },
    {
      href: '/training/plan',
      label: t('nav.plan'),
      icon: 'calendar',
      group: training,
      // `Cele` is the plan section's second tab but lives outside its prefix, so this entry has to
      // claim it — otherwise the sidebar says `Analiza` while the tab bar on screen says `Plan`.
      owns: ['/training/goals']
    },
    { href: '/activities', label: t('nav.activities'), icon: 'list', group: training },

    // How your body is. `Analityka` used to sit beside this: same metrics, same charts, same range
    // once spec 047 unified the window — so its summary statistics moved onto these chart cards and
    // the page became a redirect (spec 048).
    { href: '/insights', label: t('nav.insights'), icon: 'sparkle', group: health },

    // The plumbing.
    { href: '/data', label: t('nav.data'), icon: 'database', group: system },
    { href: '/settings', label: t('nav.settings'), icon: 'settings', group: system },
    ...(isAdmin
      ? [{ href: '/admin/users', label: t('admin.users.navLabel'), icon: 'users' as const, group: system }]
      : [])
  ];
}

/** One heading and the items under it. */
export interface NavGroup {
  /** Undefined for the leading ungrouped run (just `Start` today). */
  group?: string | undefined;
  items: NavItem[];
}

/** The whole nav, collapsed into runs of adjacent items sharing a group. */
export function navGroups(t: Translator, isAdmin = false): NavGroup[] {
  const all = navItems(t, isAdmin);

  const groups: NavGroup[] = [];
  for (const item of all) {
    const last = groups[groups.length - 1];
    if (last && last.group === item.group) last.items.push(item);
    else groups.push({ group: item.group, items: [item] });
  }
  return groups;
}

/** Does this pathname sit at or under this destination? */
function matchesHref(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

/**
 * The ONE item to mark current for a pathname: the LONGEST matching href (spec 088).
 *
 * Prefix matching alone lit up every ancestor, which was invisible while no two entries nested —
 * and then `Analiza` (`/training`) and `Plan treningowy` (`/training/plan`) became siblings in the
 * sidebar and `/training/plan` lit both. Longest-match is the general rule and needs no per-item
 * configuration: the deeper entry wins wherever it applies, and its parent keeps every path the
 * child does not claim.
 *
 * `owns` is the exception the rule needs. A section's pages are not always under one prefix —
 * `/training/goals` belongs to `Plan treningowy` and lives nowhere near `/training/plan` — and pure
 * longest-match would light `Analiza` on a page showing the plan's own tab bar. An owned path is
 * scored by ITS length, not the entry's, so a claim only beats an entry that is genuinely shallower.
 *
 * @returns the winning href, or `undefined` when the pathname belongs to no nav destination.
 */
export function activeNavHref(items: readonly NavItem[], pathname: string): string | undefined {
  let best: string | undefined;
  let bestLength = -1;
  for (const item of items) {
    for (const claim of [item.href, ...(item.owns ?? [])]) {
      if (!matchesHref(claim, pathname)) continue;
      if (claim.length > bestLength) {
        best = item.href;
        bestLength = claim.length;
      }
    }
  }
  return best;
}
