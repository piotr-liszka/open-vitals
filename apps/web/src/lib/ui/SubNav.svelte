<script lang="ts">
  /**
   * SubNav — in-section navigation (spec 025). Tabs that are REAL links, so every subpage is
   * bookmarkable, server-rendered and works without JS; `SegmentedControl` is its client-state
   * sibling for filters that never change the URL.
   *
   * Presentational: the caller passes the items and the current pathname (from `$page`), so this
   * component never touches routing state itself.
   */

  import { formatNumber, getI18n } from '$lib/i18n';

  export interface SubNavItem {
    href: string;
    label: string;
    /** Optional count shown after the label, e.g. how many activities the sport has. */
    count?: number;
  }

  interface Props {
    items: SubNavItem[];
    /** Current pathname; the item whose href matches exactly is marked `aria-current="page"`. */
    current: string;
    /** Names the group for assistive tech, e.g. "Sekcja treningu". */
    ariaLabel: string;
  }

  let { items, current, ariaLabel }: Props = $props();

  const i18n = getI18n();

  /**
   * Compare PATHS, not whole hrefs: since spec 047 a caller may hang the active range on a tab's
   * href (`/training/run?range=365`), and an exact string match would then mark no tab as current.
   */
  const pathOf = (href: string): string => href.split('?', 1)[0] ?? href;

  /**
   * The track scrolls horizontally rather than wrapping (mobile-friendly), which means the active
   * tab can land off-screen with nothing on screen showing which sport is selected — the exact state
   * a reader lands in when following a link straight to `/training/run` on a phone. Scroll it into
   * view whenever the active tab changes, not just on first mount.
   */
  let trackEl: HTMLElement | undefined = $state();
  $effect(() => {
    // Re-run whenever `current` changes; read it so the effect actually depends on it.
    void current;
    const link = trackEl?.querySelector('a[aria-current="page"]');
    // Absent in jsdom (default test environment), same as the `matchMedia` guard in AppShell.
    if (typeof link?.scrollIntoView === 'function')
      link.scrollIntoView({ block: 'nearest', inline: 'center' });
  });
</script>

<nav class="subnav" aria-label={ariaLabel}>
  <ul class="track" bind:this={trackEl}>
    {#each items as item (item.href)}
      {@const active = pathOf(item.href) === pathOf(current)}
      <li>
        <a class="tab" class:active href={item.href} aria-current={active ? 'page' : undefined}>
          <span class="label">{item.label}</span>
          {#if item.count !== undefined}<span class="count">{formatNumber(i18n.locale, item.count)}</span
            >{/if}
        </a>
      </li>
    {/each}
  </ul>
</nav>

<style>
  .subnav {
    /* Scrolls rather than wraps on narrow screens, so the tab row stays one readable line. */
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .subnav::-webkit-scrollbar {
    display: none;
  }

  /* Same track/thumb vocabulary as SegmentedControl — one selection idiom across the app. */
  .track {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    margin: 0;
    padding: var(--space-1);
    list-style: none;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .tab {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--space-10);
    padding: 0 var(--space-4);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-wide);
    line-height: var(--leading-tight);
    text-decoration: none;
    white-space: nowrap;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .tab:hover:not(.active) {
    background: var(--color-surface-hover);
    color: var(--color-text-on-surface);
  }

  .tab:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .tab.active {
    background: var(--color-surface);
    border-color: var(--color-border-strong);
    color: var(--color-accent);
    box-shadow: var(--shadow-sm);
  }

  .count {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    font-feature-settings: var(--numeric);
    color: var(--color-text-subtle);
  }

  .tab.active .count {
    color: var(--color-accent);
    opacity: 0.75;
  }
</style>
