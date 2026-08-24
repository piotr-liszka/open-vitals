<script lang="ts">
  /**
   * IconButton — a square, icon-only action (spec 027).
   *
   * `Button` is built around a text label: at `size="sm"` it still carries horizontal padding and a
   * label slot, which reads wrong for a bare glyph in tight chrome (the sidebar footer, a card
   * header). This is that pattern, once, instead of a bespoke `<button>` per caller.
   *
   * Icon-only means the accessible name has to come from `label` — it is required, not optional, and
   * doubles as the tooltip unless `title` says otherwise.
   */
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Icon from './Icon.svelte';
  import Spinner from './Spinner.svelte';
  import type { IconName } from './icons';

  interface Props extends Omit<HTMLButtonAttributes, 'aria-label'> {
    /** Glyph from the shared icon set. */
    icon: IconName;
    /** Accessible name — required, because there is no visible text. Also the default tooltip. */
    label: string;
    /** Swaps the glyph for a spinner and disables interaction. */
    loading?: boolean;
    size?: 'sm' | 'md';
  }

  let {
    icon,
    label,
    loading = false,
    size = 'md',
    disabled = false,
    type = 'button',
    title,
    ...rest
  }: Props = $props();

  const glyphSize = $derived(size === 'sm' ? 14 : 18);
</script>

<button
  class="icon-btn {size}"
  {type}
  disabled={disabled || loading}
  aria-busy={loading}
  aria-label={label}
  title={title ?? label}
  {...rest}
>
  {#if loading}
    <Spinner size="sm" label="" />
  {:else}
    <Icon name={icon} size={glyphSize} />
  {/if}
</button>

<style>
  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    cursor: pointer;
    transition:
      color var(--transition-fast),
      border-color var(--transition-fast),
      background var(--transition-fast);
  }

  .icon-btn.sm {
    width: var(--space-6);
    height: var(--space-6);
  }

  .icon-btn.md {
    width: var(--space-8);
    height: var(--space-8);
  }

  .icon-btn:hover:not(:disabled) {
    color: var(--color-accent);
    border-color: var(--color-accent);
    background: var(--color-surface-hover);
  }

  .icon-btn:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .icon-btn:disabled {
    cursor: progress;
    opacity: 0.7;
  }
</style>
