<script lang="ts">
  /**
   * Renders the primary nav (from `$lib/nav`) into the AppShell sidebar. Self-detects the active
   * route via `$app/stores`, so pages just drop `<NavLinks {advanced} />` into the `nav` snippet.
   *
   * Grouped since spec 048: each run of items sharing a `group` becomes a labelled section. The
   * heading is a real `<h2>` that labels its own `<ul>`, so a screen-reader user hears "Trening,
   * list, 2 items" instead of seven undifferentiated links — the grouping has to be in the semantics,
   * not just the pixels, or it only helps sighted readers.
   *
   * Spec 063 fixed the sighted half of that, which had the opposite problem: the headings were text
   * in the same rhythm and at the same inset as the links, so they read as targets that did nothing.
   * Two changes, and they only work together:
   *
   *  · every item carries an ICON, so "has a glyph" becomes the visual predicate for "is a link" —
   *    decodable at a glance and without reading the words;
   *  · headings become CHROME — hairline rule above, no hover response, not focusable, `user-select:
   *    none` — so they leave the link vocabulary entirely.
   *
   * The icon-only collapsed state is driven ENTIRELY by `html[data-sidebar]` in the stylesheet below,
   * not by a prop. That attribute is written before first paint (`app.html`, like the theme), so the
   * collapsed sidebar is correct on the very first frame; a prop would only arrive at hydration and
   * would need the root attribute anyway for the width. One mechanism, no chance of the two disagreeing.
   * Labels are clipped rather than removed — the a11y tree must not change when a sighted reader
   * narrows a column — and `title` carries them as a tooltip, which is the only cue a mouse user has
   * for an unfamiliar glyph.
   */
  import { page } from '$app/stores';
  import { navGroups } from '$lib/nav';
  import { withRange } from '$lib/range';
  import Icon from './Icon.svelte';

  interface Props {
    /** Show Advanced-tier items (data-processing consent). */
    advanced?: boolean;
  }
  let { advanced = false }: Props = $props();

  /**
   * The user's own dashboards (spec 064), supplied by the root layout load so this component can read
   * them from page data instead of every page passing them down. Absent for signed-out and Base-tier
   * readers, who have no `Panele` group.
   *
   * Typed via `App.PageData`, not asserted with a cast here: the layout load is the only place that
   * knows this shape, so it is the only place allowed to claim it.
   */
  const dashboards = $derived($page.data.dashboardNav ?? []);

  const groups = $derived(navGroups(advanced, dashboards));

  function isActive(href: string, path: string): boolean {
    return href === '/' ? path === '/' : path === href || path.startsWith(href + '/');
  }

  /** Stable id tying a heading to the list it labels. */
  const headingId = (group: string): string => `nav-group-${group.toLowerCase().replace(/\s+/g, '-')}`;
</script>

{#each groups as g (g.group ?? '')}
  <div class="group">
    {#if g.group}
      <h2 class="group-title" id={headingId(g.group)}>{g.group}</h2>
    {/if}
    <ul class="items" aria-labelledby={g.group ? headingId(g.group) : undefined}>
      {#each g.items as item (item.href)}
        <li>
          <!-- The active range rides along to range-aware destinations (spec 047), so switching pages
               keeps the window the reader chose instead of snapping to the default and correcting
               itself. -->
          <a
            class="nav-item"
            class:active={isActive(item.href, $page.url.pathname)}
            href={withRange(item.href, $page.url)}
            title={item.label}
            aria-current={isActive(item.href, $page.url.pathname) ? 'page' : undefined}
          >
            <Icon name={item.icon} size={20} />
            <span class="label">{item.label}</span>
          </a>
        </li>
      {/each}
    </ul>
  </div>
{/each}

<style>
  /* `.nav` already puts `--space-1` between its children; this is the extra separation that makes a
     group read as a group. The rule is the second half of the "these are not links" signal — it is a
     divider, an object links never are. */
  .group + .group {
    margin-top: var(--space-5);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .group-title {
    margin: 0 0 var(--space-2);
    padding: 0 var(--space-3);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-subtle);
    /* Chrome, not a target: no hover, no pointer, and a drag-select that stops at it. */
    user-select: none;
  }

  .items {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /*
    `--space-3` horizontal padding is load-bearing: added to `.nav`'s own `--space-3`, it puts the
    20px glyph exactly `--nav-inset` from the sidebar edge — the line `SidebarToggle` shares and the
    line that must not move when the sidebar collapses to icons.
  */
  .nav-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    text-decoration: none;
    white-space: nowrap;
    transition:
      background var(--transition-fast),
      color var(--transition-fast);
  }
  .nav-item:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .nav-item.active {
    background: var(--color-accent-soft);
    color: var(--color-accent);
  }
  /* A rail, so "current page" survives without colour — the soft background alone is a hue
     difference, which is the one cue a colour-blind reader may not get. */
  .nav-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    translate: 0 -50%;
    width: 3px;
    height: 60%;
    border-radius: 0 var(--radius-full) var(--radius-full) 0;
    background: var(--color-accent);
  }
  .nav-item:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  /*
    --- Icon-only state (spec 063) ---
    Text leaves the page but NOT the accessibility tree: `display: none` here would silently make
    every nav link nameless, and the whole point of collapsing is that navigation still works.

    Guarded to the wide layout because below 768px the sidebar is a drawer (spec 034) — a drawer you
    have deliberately opened must show its labels regardless of the desktop collapse preference.
  */
  @media (min-width: 769px) {
    :global(html[data-sidebar='icons']) .label,
    :global(html[data-sidebar='icons']) .group-title {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }
  }
</style>
