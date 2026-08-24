import { describe, it, expect } from 'vitest';
import type { PrefStorage } from './pref';
import {
  DEFAULT_SIDEBAR_STATE,
  SIDEBAR_PREF_KEY,
  SIDEBAR_STATES,
  nextSidebarState,
  readSidebarState,
  showsLabels,
  toggleLabel,
  writeSidebarState,
  type SidebarState
} from './sidebar-state';

/** In-memory `Storage` slice, so these stay pure node tests. */
function fakeStorage(seed: Record<string, string> = {}): PrefStorage & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    }
  };
}

describe('sidebar collapse state (spec 063)', () => {
  it('cycles expanded → icons → hidden → expanded', () => {
    expect(nextSidebarState('expanded')).toBe('icons');
    expect(nextSidebarState('icons')).toBe('hidden');
    expect(nextSidebarState('hidden')).toBe('expanded');
  });

  it('returns to the start after one full lap, so the toggle can never strand a reader', () => {
    let s: SidebarState = DEFAULT_SIDEBAR_STATE;
    const seen: SidebarState[] = [s];
    for (let i = 0; i < SIDEBAR_STATES.length - 1; i++) {
      s = nextSidebarState(s);
      seen.push(s);
    }
    expect(new Set(seen).size).toBe(SIDEBAR_STATES.length);
    expect(nextSidebarState(s)).toBe(DEFAULT_SIDEBAR_STATE);
  });

  it('defaults to the fully expanded sidebar', () => {
    expect(DEFAULT_SIDEBAR_STATE).toBe('expanded');
    expect(showsLabels('expanded')).toBe(true);
    expect(showsLabels('icons')).toBe(false);
    expect(showsLabels('hidden')).toBe(false);
  });

  /**
   * The label has to name where the button GOES. A control labelled with the state you are already in
   * tells a screen-reader user nothing about what pressing it does.
   */
  it('labels the toggle with its destination, not its current state', () => {
    expect(toggleLabel('expanded')).toBe('Zwiń menu do ikon');
    expect(toggleLabel('icons')).toBe('Ukryj menu');
    expect(toggleLabel('hidden')).toBe('Rozwiń menu');
  });

  it('round-trips through storage under the key the pre-paint script reads', () => {
    const store = fakeStorage();
    writeSidebarState('icons', store);
    expect(store.data[SIDEBAR_PREF_KEY]).toBe('icons');
    expect(readSidebarState(store)).toBe('icons');
  });

  it('falls back to the default for junk, a stale value or no storage at all', () => {
    expect(readSidebarState(fakeStorage({ [SIDEBAR_PREF_KEY]: 'collapsed' }))).toBe('expanded');
    expect(readSidebarState(fakeStorage())).toBe('expanded');
    expect(readSidebarState(null)).toBe('expanded');
  });
});
