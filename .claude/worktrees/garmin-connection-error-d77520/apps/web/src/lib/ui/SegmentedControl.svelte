<script lang="ts">
  /**
   * SegmentedControl — a windowed range selector (e.g. 7D / 30D / 90D / 1Y).
   *
   * Presentational: state lives in the parent (bind:value). A single pill/track
   * holds the segments; the active one gets a raised "thumb". Fully keyboard
   * accessible as an ARIA radiogroup with roving tabindex.
   */
  interface Option {
    value: string;
    label: string;
    /**
     * Optional compact label swapped in below 768px (spec 047). Only options that provide one
     * shorten — a control without `short` behaves exactly as before at every width.
     */
    short?: string;
  }

  interface Props {
    options: Option[];
    /** Currently selected value (bindable). */
    value: string;
    /** Labels the group for assistive tech. */
    ariaLabel: string;
    /** Fired with the newly selected value on any change. */
    onChange?: (value: string) => void;
    size?: 'sm' | 'md';
  }

  let { options, value = $bindable(), ariaLabel, onChange, size = 'md' }: Props = $props();

  // Roving-tabindex refs so keyboard nav can move focus between segments.
  let buttons = $state<HTMLButtonElement[]>([]);

  const selectedIndex = $derived(options.findIndex((o) => o.value === value));

  function select(index: number, focus = false): void {
    const option = options[index];
    if (!option || option.value === value) {
      if (focus) buttons[index]?.focus();
      return;
    }
    value = option.value;
    onChange?.(option.value);
    if (focus) buttons[index]?.focus();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (options.length === 0) return;
    const current = selectedIndex === -1 ? 0 : selectedIndex;
    let next: number | null = null;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (current + 1) % options.length;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (current - 1 + options.length) % options.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = options.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    select(next, true);
  }
</script>

<div class="segmented {size}" role="radiogroup" aria-label={ariaLabel}>
  {#each options as option, index (option.value)}
    {@const active = option.value === value}
    <button
      bind:this={buttons[index]}
      type="button"
      role="radio"
      class="segment"
      class:active
      aria-checked={active}
      aria-label={option.short ? option.label : undefined}
      tabindex={active || (selectedIndex === -1 && index === 0) ? 0 : -1}
      onclick={() => select(index)}
      onkeydown={handleKeydown}
    >
      {#if option.short}
        <!-- Both labels ship; CSS picks one, so the swap costs no JS and no layout measurement.
             The full label stays the accessible name at every width via `aria-label`. -->
        <span class="label long">{option.label}</span>
        <span class="label short" aria-hidden="true">{option.short}</span>
      {:else}
        <span class="label">{option.label}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .segment {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-muted);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-wide);
    line-height: var(--leading-tight);
    font-feature-settings: var(--numeric);
    white-space: nowrap;
    cursor: pointer;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .segment:hover:not(.active) {
    background: var(--color-surface-hover);
    color: var(--color-text-on-surface);
  }

  .segment:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  /* Raised "thumb": elevated surface, hairline border, subtle depth, accent text. */
  .segment.active {
    background: var(--color-surface);
    border-color: var(--color-border-strong);
    color: var(--color-accent);
    box-shadow: var(--shadow-sm);
  }

  /* Long/short label pair (spec 047): full label on wide, compact one on a phone. Only rendered
     when the option supplies a `short`, so controls without one are untouched. */
  .label.short {
    display: none;
  }

  /* NOTE: mirrors the 768px drawer breakpoint in AppShell — no breakpoint token exists yet
     (custom properties can't be used in @media). Documented in spec 034. */
  @media (max-width: 768px) {
    .label.long {
      display: none;
    }
    .label.short {
      display: inline;
    }
  }

  /* Sizes */
  .sm .segment {
    height: var(--space-8);
    padding: 0 var(--space-3);
    font-size: var(--text-xs);
  }

  .md .segment {
    height: var(--space-10);
    padding: 0 var(--space-4);
    font-size: var(--text-sm);
  }
</style>
