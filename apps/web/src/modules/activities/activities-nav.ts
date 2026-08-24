/**
 * The activities section's sub-navigation (spec 048). `Mapa ciepła` used to be a top-level nav item
 * beside `Aktywności`, but it is a LENS on the same activity set — the same rides and runs, filtered
 * by sport and year and drawn on a map instead of listed. Spec 025 already established the
 * section + `SubNav` shape for exactly this, so the map became a tab.
 *
 * Pure: no I/O, no config. Unlike `training-nav`, both tabs always exist — the list and the map read
 * the same activities, so if one has something to show the other does too.
 */
import type { Translator } from '$lib/i18n';

export interface ActivitiesTab {
  readonly href: string;
  readonly label: string;
}

export function activitiesTabs(t: Translator): readonly ActivitiesTab[] {
  return [
    { href: '/activities', label: t('activities.tab.list') },
    { href: '/activities/map', label: t('activities.tab.map') }
  ];
}

/** Section page title for a pathname, used by the shell topbar. Mirrors `trainingTitle()`. */
export function activitiesTitle(t: Translator, pathname: string): string {
  const tab = activitiesTabs(t).find((tb) => tb.href === pathname);
  return tab && tab.href !== '/activities'
    ? t('activities.titleWithTab', { tab: tab.label })
    : t('nav.activities');
}
