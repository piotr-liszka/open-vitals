/**
 * Sidebar collapse state (spec 063) — pure, so the cycle order is a fact about a function rather
 * than a fact about a click handler, and so `app.html` can apply the stored value before first paint
 * without importing a component.
 *
 * Three states, in the order the toggle walks them: the sidebar gives back width in two steps before
 * it disappears, because "icons only" is the state most people actually want on a laptop and putting
 * it behind `hidden` would mean nobody finds it.
 */
import { readEnumPref, writePref, type PrefStorage } from './pref';

export type SidebarState = 'expanded' | 'icons' | 'hidden';

/** Cycle order. `expanded` is first because it is the default and the recovery point. */
export const SIDEBAR_STATES: readonly SidebarState[] = ['expanded', 'icons', 'hidden'];

export const DEFAULT_SIDEBAR_STATE: SidebarState = 'expanded';

/**
 * Device-local, per spec 032: this is an opinion about pixels, not user data. The key is duplicated
 * as a string literal in `app.html`'s pre-paint script — that script cannot import, and a layout
 * change applied after hydration reflows the whole page in front of the reader.
 */
export const SIDEBAR_PREF_KEY = 'gb-sidebar';

/** The state one press of the toggle moves to. */
export function nextSidebarState(current: SidebarState): SidebarState {
  const i = SIDEBAR_STATES.indexOf(current);
  return SIDEBAR_STATES[(i + 1) % SIDEBAR_STATES.length]!;
}

/**
 * What the toggle should announce. Named for the DESTINATION, not the current state: a control whose
 * label describes where you already are tells a screen-reader user nothing about what pressing it does.
 */
const NEXT_LABELS: Readonly<Record<SidebarState, string>> = {
  expanded: 'Rozwiń menu',
  icons: 'Zwiń menu do ikon',
  hidden: 'Ukryj menu'
};

export function toggleLabel(current: SidebarState): string {
  return NEXT_LABELS[nextSidebarState(current)];
}

/** Whether nav labels are rendered as visible text in this state. */
export function showsLabels(state: SidebarState): boolean {
  return state === 'expanded';
}

export function readSidebarState(storage?: PrefStorage | null): SidebarState {
  return readEnumPref(SIDEBAR_PREF_KEY, SIDEBAR_STATES, DEFAULT_SIDEBAR_STATE, storage);
}

export function writeSidebarState(state: SidebarState, storage?: PrefStorage | null): void {
  writePref(SIDEBAR_PREF_KEY, state, storage);
}
