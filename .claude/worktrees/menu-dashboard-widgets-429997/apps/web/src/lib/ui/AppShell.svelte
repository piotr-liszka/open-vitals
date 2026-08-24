<script lang="ts">
  import type { Snippet } from 'svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import TierBadge from './TierBadge.svelte';
  import RangeSwitch from './RangeSwitch.svelte';
  import NavLinks from './NavLinks.svelte';
  import LogoutButton from './LogoutButton.svelte';
  import SidebarToggle from './SidebarToggle.svelte';
  import {
    DEFAULT_SIDEBAR_STATE,
    readSidebarState,
    writeSidebarState,
    type SidebarState
  } from './sidebar-state';
  import { formatInstant, resolveBrowserTimeZone } from '$lib/date';
  import { routeSupportsRange } from '$lib/range';
  import { page } from '$app/state';

  interface Props {
    /** Title shown in the topbar. */
    title?: string;
    /** Show Advanced-tier nav items (data-processing consent). Ignored when `nav` is supplied. */
    advanced?: boolean;
    /**
     * Sidebar contents. An ESCAPE HATCH, not the normal path: ten of the eleven callers were passing
     * the identical `<NavLinks advanced={…} />`, so the shell now renders the primary nav itself from
     * `advanced`, and only the styleguide — which showcases the shell with fake links — overrides it
     * (spec 063).
     */
    nav?: Snippet;
    /**
     * Topbar right-side actions. An ESCAPE HATCH on the same terms as `nav`: all ten real pages were
     * passing the identical "Wyloguj" button — and their own copy of the four-line handler behind it —
     * so the shell now renders `LogoutButton` itself and only the styleguide, which demonstrates the
     * slot with sample controls, overrides it. `ThemeToggle` is always appended after whichever wins.
     */
    actions?: Snippet;
    /** Optional brand/logo area at the top of the sidebar. */
    brand?: Snippet;
    /** Optional product tier — renders a tier indicator under the brand and tints the chrome. */
    tier?: 'base' | 'advanced';
    /**
     * Optional sidebar footer, rendered directly ABOVE the build stamp. Where data freshness lives
     * (spec 027) — the version stamp alone was being read as "my data is from then".
     */
    footer?: Snippet;
    /**
     * Global range switch (spec 047). `'auto'` shows it on every range-aware route, so a page opts
     * in by existing rather than by wiring. `'off'` suppresses it where the page displays no
     * windowed data at all — the Base-tier start screen, which processes nothing.
     */
    range?: 'auto' | 'off';
    /** Main content. */
    children?: Snippet;
  }

  let {
    title,
    advanced = false,
    nav,
    actions,
    brand,
    tier,
    footer,
    range = 'auto',
    children
  }: Props = $props();

  // One switch for the whole app, decided from the route — see `routeSupportsRange`. Rendering it
  // here is what makes it global: no page passes it, and no page can forget it.
  const showRange = $derived(range === 'auto' && routeSupportsRange(page.url.pathname));

  /**
   * Sidebar collapse (spec 063). The LAYOUT of all three states is pure CSS keyed on
   * `html[data-sidebar]`, written before first paint by the bootstrap in `app.html` — so this state
   * exists only to label the toggle and to persist the choice, never to size anything. It starts at
   * the default so SSR and the first client render agree, then reads the real value on mount exactly
   * the way `ThemeToggle` does.
   */
  let sidebar = $state<SidebarState>(DEFAULT_SIDEBAR_STATE);
  $effect(() => {
    sidebar = readSidebarState();
  });

  function setSidebar(next: SidebarState): void {
    sidebar = next;
    document.documentElement.dataset.sidebar = next;
    writeSidebarState(next);
  }

  // Sidebar drawer state on narrow screens (ignored on wide, where it's fixed/open).
  let mobileOpen = $state(false);
  /**
   * Whether the shell is in drawer mode. The layout itself is CSS-only, but an off-canvas drawer
   * must also leave the tab order and the a11y tree while hidden (spec 034) — `inert` is an
   * attribute, so the breakpoint has to be known to the component too. Starts `false` so SSR and
   * the first client render agree; the effect below syncs it on mount.
   */
  let narrow = $state(false);
  /** Kept in sync with the `max-width: 768px` query in this component's styles. */
  const MOBILE_QUERY = '(max-width: 768px)';

  let navEl: HTMLElement | undefined = $state();

  // Build stamp (injected by Vite at build time) — a deploy marker so it's obvious whether a rebuild
  // actually shipped new code. The bundle keeps the instant in UTC; we render it in LOCAL time
  // (spec 018). The first render uses the fixed app timezone so SSR and hydration produce identical
  // text; once mounted we re-render in the browser's own zone (matters only when travelling).
  let zone = $state<string | undefined>(undefined);
  $effect(() => {
    zone = resolveBrowserTimeZone();
  });

  const buildStamp = $derived(formatInstant(__BUILD_TIME__, 'dateTime', zone));
  const buildTitle = $derived(
    `Zbudowano: ${formatInstant(__BUILD_TIME__, 'dateTime', zone)}${__BUILD_SHA__ ? ` · commit ${__BUILD_SHA__}` : ''}`
  );

  function closeMobile(): void {
    mobileOpen = false;
  }

  // Track the drawer breakpoint, and never leave the drawer "open" behind a widened viewport.
  $effect(() => {
    // Absent only in environments without a real viewport (jsdom by default): the CSS still lays the
    // drawer out correctly there, only `inert` is skipped.
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(MOBILE_QUERY);
    const sync = (): void => {
      narrow = mq.matches;
      if (!narrow) mobileOpen = false;
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  });

  /**
   * Tapping a destination closes the drawer. A SvelteKit client-side navigation swaps the page under
   * the drawer and would otherwise leave it standing over the view it just loaded. Delegated via a
   * real listener rather than an `onclick` on `<nav>` so no click handler sits on a non-interactive
   * element; links and buttons both fire `click` for keyboard activation too.
   */
  $effect(() => {
    const el = navEl;
    if (!el) return;
    const onClick = (event: Event): void => {
      const target = event.target;
      if (target instanceof Element && target.closest('a[href], button')) closeMobile();
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  });

  // Hold the page still while the drawer is over it — scrolling the content under the finger reads
  // as the drawer itself failing to scroll.
  $effect(() => {
    if (!(narrow && mobileOpen)) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  });

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && mobileOpen) closeMobile();
  }
</script>

<svelte:window onkeydown={onKeydown} onpopstate={closeMobile} />

<div class="shell" class:mobile-open={mobileOpen} class:tier-base={tier === 'base'}>
  <aside id="app-sidebar" class="sidebar" aria-label="Primary" inert={narrow && !mobileOpen}>
    <div class="brand">
      <!-- Left of the wordmark and padded like a nav item, so its glyph sits on the same vertical
           line as every icon below it — in BOTH visible states (spec 063). -->
      <SidebarToggle state={sidebar} onchange={setSidebar} />
      {#if brand}
        {@render brand()}
      {:else}
        <span class="brand-lockup">
          <span class="brand-text">Vagus</span>
          {#if tier}<TierBadge {tier} size="sm" />{/if}
        </span>
      {/if}
    </div>
    <nav class="nav" bind:this={navEl}>
      {#if nav}{@render nav()}{:else}<NavLinks {advanced} />{/if}
    </nav>

    {#if footer}
      <div class="sidebar-footer">{@render footer()}</div>
    {/if}

    <div class="build" title={buildTitle}>
      <span class="build-label">Wersja</span>
      <time class="build-time" datetime={__BUILD_TIME__}>{buildStamp}</time>
      {#if __BUILD_SHA__}<span class="build-sha">{__BUILD_SHA__}</span>{/if}
    </div>
  </aside>

  {#if mobileOpen}
    <button type="button" class="scrim" aria-label="Zamknij menu" onclick={closeMobile}></button>
  {/if}

  <div class="frame">
    <header class="topbar">
      <button
        type="button"
        class="menu-btn"
        aria-label={mobileOpen ? 'Zamknij menu' : 'Otwórz menu'}
        aria-expanded={mobileOpen}
        aria-controls="app-sidebar"
        onclick={() => (mobileOpen = !mobileOpen)}
      >
        <svg
          class="menu-glyph"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      <!-- The way back from `hidden` (spec 063). Rendered only in that state: with the sidebar on
           screen its own toggle is the obvious control, and two copies of the same button would be
           two answers to one question. -->
      {#if sidebar === 'hidden'}
        <span class="topbar-toggle"><SidebarToggle state={sidebar} onchange={setSidebar} /></span>
      {/if}

      {#if title}<h1 class="page-title">{title}</h1>{/if}

      <!--
        A direct child of the bar, NOT nested in the action cluster: on a phone this slot takes a full
        row of its own, and a slot nested inside `.topbar-actions` could only ever be as wide as those
        buttons — which clipped the last segment off the switch (spec 047).
        Placed BEFORE the actions so the `~` rule below can hand the auto margin over to it.
      -->
      {#if showRange}<div class="range-slot"><RangeSwitch /></div>{/if}

      <div class="topbar-actions">
        {#if actions}{@render actions()}{:else}<LogoutButton />{/if}
        <ThemeToggle />
      </div>
    </header>

    <main class="content">
      {@render children?.()}
    </main>
  </div>
</div>

<style>
  .shell {
    min-height: 100dvh;
    background: var(--color-bg);
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: var(--sidebar-width);
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
    z-index: var(--z-drawer);
    transition: transform var(--transition-base);
  }

  /* `--space-3` matches `.nav`'s own padding, which is what lets the toggle inside share the nav
     icons' vertical line (spec 063). */
  .brand {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--topbar-height);
    padding: 0 var(--space-3);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    /* The row is exactly one topbar tall: a wordmark that wrapped beside the tier badge used to
       spill out of it (spec 034). Nothing here may grow the row. */
    overflow: hidden;
  }

  .brand-lockup {
    display: inline-flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: var(--space-3);
    min-width: 0;
  }
  .brand-text {
    white-space: nowrap;
    font-size: var(--text-md);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
  }

  .nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-4) var(--space-3);
    overflow-y: auto;
  }

  /*
    Pinned to the bottom of the sidebar: `margin-top: auto` on the FIRST of the two blocks pushes the
    pair below the nav list, so freshness (spec 027) and the build stamp read as one footer stack.
  */
  .sidebar-footer {
    margin-top: auto;
    padding: var(--space-3) var(--space-5);
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .sidebar-footer + .build {
    margin-top: 0;
  }

  .build {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-3) var(--space-5);
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
  }
  .build-label {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-subtle);
  }
  .build-time {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }
  .build-sha {
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    font-family: var(--font-mono);
  }

  .frame {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
    margin-left: var(--sidebar-width);
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: var(--z-sticky);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    height: var(--topbar-height);
    padding: 0 var(--space-6);
    background: color-mix(in srgb, var(--color-surface) 88%, transparent);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--color-border);
  }

  .page-title {
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-tight);
    margin: 0;
    /* Truncate rather than push the actions off the bar or wrap it taller. */
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .topbar-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-left: auto;
    flex-shrink: 0;
  }

  /* The range switch sits at the right end of the bar, immediately left of the page's own actions.
     It claims the free space so the actions stay packed beside it; when no switch is rendered the
     rule above keeps `.topbar-actions` doing that job itself. */
  .range-slot {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    margin-left: auto;
  }
  .range-slot ~ .topbar-actions {
    margin-left: var(--space-1);
  }

  /*
    --- Sidebar collapse, wide layout only (spec 063) ---
    Width itself is a token redefined on the root, so nothing here resizes anything. These rules only
    remove what a narrower column cannot hold. Below 769px the sidebar is a drawer (spec 034) and the
    collapse preference must not touch it — a drawer you deliberately opened has to be complete.
  */
  @media (min-width: 769px) {
    /* Icon-only: the wordmark and the freshness/build stamps are all text in a 68px column. The nav
       icons are the only thing that still means something at that width. */
    :global(html[data-sidebar='icons']) .brand-lockup,
    :global(html[data-sidebar='icons']) .sidebar-footer,
    :global(html[data-sidebar='icons']) .build {
      display: none;
    }
    /* Hidden: `display: none` rather than a transform, so the sidebar leaves the tab order and the
       a11y tree without needing `inert` bookkeeping the way the drawer does. */
    :global(html[data-sidebar='hidden']) .sidebar {
      display: none;
    }
  }

  /* Sits where the mobile menu button sits, so "the control at the far left of the bar opens the
     navigation" is one rule at every width. */
  .topbar-toggle {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
  }

  .menu-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: var(--space-8);
    height: var(--space-8);
    padding: 0;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-on-surface);
    cursor: pointer;
  }

  .menu-glyph {
    display: block;
  }

  .scrim {
    display: none;
    position: fixed;
    inset: 0;
    z-index: var(--z-scrim);
    background: var(--color-overlay);
    border: none;
    cursor: pointer;
  }

  .content {
    flex: 1;
    padding: var(--space-6);
    max-width: var(--container-max);
    width: 100%;
  }

  /* --- Responsive: collapse the sidebar into a drawer below 768px --- */
  /* NOTE: no breakpoint token exists yet (custom properties can't be used in @media) — raw 768px,
     mirrored by MOBILE_QUERY in the script above. Breakpoints documented in spec 034. */
  @media (max-width: 768px) {
    .sidebar {
      /* Never wider than the phone it's on; the scrim must stay tappable beside it. `-full`, not the
         state-dependent `--sidebar-width`: a desktop collapse preference must not shrink or zero the
         drawer (spec 063). */
      width: min(var(--sidebar-width-full), 86vw);
      transform: translateX(-100%);
      padding-bottom: env(safe-area-inset-bottom);
    }
    /* The hamburger and the scrim own opening/closing at this width. Both collapse toggles would be
       inert here (their rules are guarded to the wide layout) while still writing a preference that
       silently reshapes the desktop — a control that appears to do nothing is worse than no control. */
    .topbar-toggle,
    .brand :global(.sidebar-toggle) {
      display: none;
    }
    .shell.mobile-open .sidebar {
      transform: translateX(0);
      box-shadow: var(--shadow-lg);
    }
    .frame {
      margin-left: 0;
    }
    .menu-btn {
      display: inline-flex;
    }
    .shell.mobile-open .scrim {
      display: block;
    }
    /* Gutters step down: --space-6 on both sides costs 48px of a 375px screen (spec 034). */
    .topbar {
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      /* Five range segments cannot share a 375px row with the title and the actions (spec 047), so
         the bar wraps to a second line instead of squeezing the switch into unreadability. Height
         becomes a floor rather than a fixed value; the sidebar is a drawer at this width, so nothing
         is aligned to it any more. */
      height: auto;
      min-height: var(--topbar-height);
      flex-wrap: wrap;
      align-content: center;
    }
    /* Own full-width row under the title and buttons, so all five segments fit a 375px screen. */
    .range-slot {
      order: 1;
      flex-basis: 100%;
      margin-left: 0;
      justify-content: flex-end;
      /* Should a future sixth segment still not fit, scroll the track rather than clip it. */
      overflow-x: auto;
      scrollbar-width: none;
    }
    .range-slot::-webkit-scrollbar {
      display: none;
    }
    /* Row one keeps its own right alignment now that the slot no longer holds the auto margin. */
    .range-slot ~ .topbar-actions {
      margin-left: auto;
    }
    .page-title {
      font-size: var(--text-md);
    }
    .content {
      padding: var(--space-4);
      padding-left: max(var(--space-4), env(safe-area-inset-left));
      padding-right: max(var(--space-4), env(safe-area-inset-right));
      padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
    }
  }
</style>
