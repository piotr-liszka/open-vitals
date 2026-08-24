<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Spinner from './Spinner.svelte';

  type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
  type Size = 'sm' | 'md';

  interface Props extends HTMLButtonAttributes {
    variant?: Variant;
    size?: Size;
    /** Shows a spinner and disables interaction. */
    loading?: boolean;
    children?: Snippet;
  }

  let {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    type = 'button',
    class: className = '',
    children,
    ...rest
  }: Props = $props();

  const classes = $derived(['btn', variant, size, className].filter((c) => c).join(' '));
</script>

<button
  class={classes}
  class:is-loading={loading}
  {type}
  disabled={disabled || loading}
  aria-busy={loading}
  {...rest}
>
  {#if loading}
    <span class="spin" aria-hidden="true"><Spinner size="sm" label="" /></span>
  {/if}
  <span class="label">{@render children?.()}</span>
</button>

<style>
  .btn {
    --btn-fg: var(--color-text);
    --btn-bg: transparent;
    --btn-bg-hover: var(--color-surface-hover);
    --btn-border: transparent;

    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    border: 1px solid var(--btn-border);
    border-radius: var(--radius-md);
    background: var(--btn-bg);
    color: var(--btn-fg);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-tight);
    line-height: var(--leading-tight);
    white-space: nowrap;
    cursor: pointer;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast),
      box-shadow var(--transition-fast),
      transform var(--transition-fast),
      opacity var(--transition-fast);
  }

  .btn:hover:not(:disabled) {
    background: var(--btn-bg-hover);
  }

  /* Snappy press — brief physical dip. */
  .btn:active:not(:disabled) {
    transform: translateY(1px);
  }

  .btn:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  @media (prefers-reduced-motion: reduce) {
    .btn:active:not(:disabled) {
      transform: none;
    }
  }

  .btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .btn.is-loading {
    cursor: progress;
  }

  /* Sizes */
  .sm {
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-sm);
    height: var(--space-8);
  }

  .md {
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-base);
    height: var(--space-10);
  }

  /* Variants */
  /* Filled control: the bright accent step, so the ink label keeps its contrast margin. */
  .primary {
    --btn-bg: var(--color-accent-fill);
    --btn-bg-hover: var(--color-accent-fill-hover);
    --btn-fg: var(--color-on-accent);
    --btn-border: var(--color-accent-fill);
    box-shadow: var(--shadow-sm);
  }
  .primary:hover:not(:disabled) {
    --btn-border: var(--color-accent-fill-hover);
  }

  .secondary {
    --btn-bg: var(--color-surface);
    --btn-bg-hover: var(--color-surface-hover);
    --btn-fg: var(--color-text-on-surface);
    --btn-border: var(--color-border-strong);
    box-shadow: var(--shadow-sm);
  }

  .ghost {
    --btn-bg: transparent;
    --btn-bg-hover: var(--color-surface-hover);
    --btn-fg: var(--color-text-on-surface);
    --btn-border: transparent;
  }

  .danger {
    --btn-bg: var(--color-danger);
    --btn-bg-hover: color-mix(in srgb, var(--color-danger) 85%, black);
    --btn-fg: var(--color-on-accent);
    --btn-border: var(--color-danger);
    box-shadow: var(--shadow-sm);
  }

  .label {
    display: inline-flex;
    align-items: center;
  }

  .spin {
    display: inline-flex;
  }
</style>
