<script lang="ts">
  /**
   * The global range switch (spec 047) — one control, rendered by `AppShell`, honoured by every
   * range-aware page.
   *
   * This is the app's one *connected* `lib/ui` component, and deliberately so: making it
   * presentational would mean every one of the fifteen pages that mounts `AppShell` threading the
   * same value and handler through, which is exactly the duplication that let two range switches
   * drift apart in the first place. It owns two things and nothing else:
   *
   *  - **The URL.** `?range=` is the truth: SSR reads it, a reload keeps it, a link carries it.
   *    `invalidateAll` re-runs the page loaders, so the server resolves the new window.
   *  - **The device memory.** The last choice goes to `localStorage` (via `pref.ts`, which is
   *    failure-tolerant) and is re-applied when a range-aware page is opened without the param — so
   *    clicking "Trening" in the sidebar does not silently snap back to 7 days.
   */
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import SegmentedControl from './SegmentedControl.svelte';
  import { readEnumPref, writePref } from './pref';
  import {
    DEFAULT_RANGE,
    RANGE_KEYS,
    RANGE_OPTIONS,
    RANGE_PARAM,
    RANGE_PREF_KEY,
    parseRange,
    type RangeKey
  } from '$lib/range';

  interface Props {
    size?: 'sm' | 'md';
  }

  let { size = 'sm' }: Props = $props();

  const options = RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label, short: o.short }));

  /** What the URL says right now — the value the server actually rendered. */
  const active = $derived(parseRange(page.url.searchParams.get(RANGE_PARAM)));

  function navigate(key: RangeKey, replaceState: boolean): void {
    const target = new URL(page.url);
    target.searchParams.set(RANGE_PARAM, key);
    // `keepFocus` so the keyboard user stays on the segment they just activated; `noScroll` so a
    // range change never yanks the reader back to the top of a long page.
    void goto(target, { replaceState, noScroll: true, keepFocus: true, invalidateAll: true });
  }

  function pick(value: string): void {
    const key = parseRange(value);
    writePref(RANGE_PREF_KEY, key);
    navigate(key, true);
  }

  /**
   * Re-apply the remembered range when arriving without an explicit one. Runs on the client only
   * (there is no `localStorage` during SSR), and rewrites history rather than pushing, so the back
   * button still leaves the page instead of bouncing between two versions of it.
   *
   * Guarded on the param being absent: once `?range=` is in the URL it wins, so a shared link always
   * shows what the sender saw, whatever this device happens to remember.
   */
  $effect(() => {
    if (page.url.searchParams.has(RANGE_PARAM)) return;
    const remembered = readEnumPref<RangeKey>(RANGE_PREF_KEY, RANGE_KEYS, DEFAULT_RANGE);
    if (remembered === DEFAULT_RANGE) return; // nothing to restore; leave the URL clean
    navigate(remembered, true);
  });
</script>

<div class="range-switch">
  <SegmentedControl {options} value={active} ariaLabel="Zakres danych" {size} onChange={pick} />
</div>

<style>
  .range-switch {
    display: inline-flex;
    /* The topbar truncates the page title before this shrinks (spec 034): a half-collapsed range
       switch is worse than an abbreviated heading. */
    flex-shrink: 0;
  }
</style>
