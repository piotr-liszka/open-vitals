<script lang="ts">
  /**
   * InfoPopover — the "explain this number" affordance (spec 059).
   *
   * Every derived figure in this app is somebody's formula, and a card that shows a 0–100 score
   * without saying what went into it invites the reader to assume it means whatever the same number
   * means elsewhere. This is that explanation, once, as a design-system component: a `?` trigger and
   * a small panel of prose the caller supplies.
   *
   * Deliberately NOT a tooltip: the content is a paragraph, sometimes a list, and has to survive
   * touch, keyboard and a screen reader. So it is a real disclosure — a button with
   * `aria-expanded`/`aria-controls`, a labelled region, Escape to close, and a click outside to
   * dismiss. Nothing here traps focus, because nothing inside is interactive.
   */
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  interface Props {
    /** Accessible name of the trigger, e.g. "Jak liczymy gotowość?". */
    label: string;
    /** Heading shown at the top of the panel. Defaults to `label`. */
    title?: string;
    /** Which edge the panel hangs from on wide screens. */
    align?: 'start' | 'end';
    children: Snippet;
  }

  let { label, title, align = 'end', children }: Props = $props();

  let open = $state(false);
  let root = $state<HTMLElement | null>(null);
  let panel = $state<HTMLElement | null>(null);
  const id = $props.id();

  /**
   * The side the panel ACTUALLY hangs from. `align` is the caller's preference, not a guarantee:
   * a trigger near the left edge of the viewport with `align="end"` would open a 24rem panel
   * leftwards, off the page (or into whatever sits there). On open we measure and flip when the
   * preferred side does not fit and the other one does.
   *
   * Measurement can be unavailable — jsdom reports every rect as zero — so a zero-width panel keeps
   * the caller's preference rather than flipping on a number that means "we don't know".
   */
  let flipped = $state<'start' | 'end' | null>(null);
  const resolved = $derived(flipped ?? align);

  const GUTTER = 8;

  $effect(() => {
    if (!open) {
      flipped = null;
      return;
    }
    const anchor = root?.getBoundingClientRect();
    const width = panel?.getBoundingClientRect().width ?? 0;
    if (!anchor || width <= 0) return;

    const roomLeft = anchor.right - GUTTER;
    const roomRight = window.innerWidth - anchor.left - GUTTER;
    if (align === 'end' && width > roomLeft && width <= roomRight) flipped = 'start';
    else if (align === 'start' && width > roomRight && width <= roomLeft) flipped = 'end';
    else flipped = null;
  });

  function close(): void {
    open = false;
  }

  /**
   * Dismiss on any click that lands outside the trigger + panel. Bound on `window` only while open,
   * so a page full of these costs nothing until one is used.
   */
  function onWindowClick(event: MouseEvent): void {
    if (!open || !root) return;
    if (!root.contains(event.target as Node)) close();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && open) {
      close();
      // Escape should leave focus somewhere sensible, not adrift on the page body.
      (root?.querySelector('button') as HTMLButtonElement | null)?.focus();
    }
  }
</script>

<svelte:window onclick={onWindowClick} onkeydown={onKeydown} />

<span class="info" bind:this={root}>
  <button
    type="button"
    class="trigger"
    class:open
    aria-label={label}
    aria-expanded={open}
    aria-controls={id}
    title={label}
    onclick={() => (open = !open)}
  >
    <Icon name="help" size={16} />
  </button>

  {#if open}
    <div class="panel {resolved}" {id} bind:this={panel} role="group" aria-label={title ?? label}>
      <h4 class="panel-title">{title ?? label}</h4>
      <div class="panel-body">{@render children()}</div>
    </div>
  {/if}
</span>

<style>
  .info {
    position: relative;
    display: inline-flex;
    vertical-align: middle;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--space-6);
    height: var(--space-6);
    padding: 0;
    border: none;
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--color-text-subtle);
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background var(--transition-fast);
  }

  .trigger:hover,
  .trigger.open {
    color: var(--color-accent);
    background: var(--color-surface-2);
  }

  .trigger:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  /*
    Anchored to the trigger and clamped to the viewport width on small screens, where "hang off the
    right edge" would otherwise put half the explanation outside the page.
  */
  .panel {
    position: absolute;
    top: calc(100% + var(--space-2));
    z-index: 30;
    width: max-content;
    max-width: min(24rem, calc(100vw - var(--space-8)));
    padding: var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-lg);
    text-align: left;
    white-space: normal;
  }

  .panel.end {
    right: 0;
  }

  .panel.start {
    left: 0;
  }

  .panel-title {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
  }

  .panel-body {
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
    color: var(--color-text-on-surface);
  }

  .panel-body :global(p) {
    margin: 0 0 var(--space-2);
  }

  .panel-body :global(p:last-child) {
    margin-bottom: 0;
  }

  .panel-body :global(ul) {
    margin: 0 0 var(--space-2);
    padding-left: var(--space-5);
  }

  .panel-body :global(li + li) {
    margin-top: var(--space-1);
  }

  .panel-body :global(strong) {
    font-weight: var(--font-semibold);
    font-feature-settings: var(--numeric);
  }
</style>
