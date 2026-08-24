/**
 * The activities section's sub-navigation (spec 048). `Mapa ciepła` used to be a top-level nav item
 * beside `Aktywności`, but it is a LENS on the same activity set — the same rides and runs, filtered
 * by sport and year and drawn on a map instead of listed. Spec 025 already established the
 * section + `SubNav` shape for exactly this, so the map became a tab.
 *
 * Pure: no I/O, no config. Unlike `training-nav`, both tabs always exist — the list and the map read
 * the same activities, so if one has something to show the other does too.
 */
export interface ActivitiesTab {
  readonly href: string;
  readonly label: string;
}

export const ACTIVITIES_TABS: readonly ActivitiesTab[] = [
  { href: '/activities', label: 'Lista' },
  { href: '/activities/map', label: 'Mapa' }
];

/** Section page title for a pathname, used by the shell topbar. Mirrors `trainingTitle()`. */
export function activitiesTitle(pathname: string): string {
  const tab = ACTIVITIES_TABS.find((t) => t.href === pathname);
  return tab && tab.href !== '/activities' ? `Aktywności · ${tab.label}` : 'Aktywności';
}
