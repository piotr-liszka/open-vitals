<script lang="ts">
  /**
   * FilterChips — a wrapping row of single-select filter pills with an "all" chip and a collapsible
   * tail (spec 020). Long facet lists (e.g. every sport a user has ever recorded) render only the
   * first `maxVisible` options; the rest hide behind a real `<button>` with `aria-expanded`.
   *
   * Presentational: order is the caller's business (pass facets sorted by frequency), selection state
   * lives in the parent (`value` + `onSelect`). A selected option outside the visible head is always
   * pulled in, so the active filter can never be hidden.
   */

  import { getI18n } from '$lib/i18n';

  export interface FilterChipOption {
    /** Stable key sent back to `onSelect`. */
    value: string;
    label: string;
  }

  interface Props {
    options: FilterChipOption[];
    /** Selected option value; `null` selects the "all" chip. */
    value: string | null;
    /** Fired with the picked value, or `null` for "all". */
    onSelect: (value: string | null) => void;
    /** Labels the group for assistive tech. */
    ariaLabel: string;
    /** Text of the leading "all" chip; `null` hides it. */
    allLabel?: string | null;
    /** How many options stay visible while collapsed. */
    maxVisible?: number;
    /** Expander text, given the number of hidden options. */
    expandLabel?: (hidden: number) => string;
    collapseLabel?: string;
  }

  const i18n = getI18n();

  let {
    options,
    value,
    onSelect,
    ariaLabel,
    allLabel = i18n.t('common.all'),
    maxVisible = 5,
    expandLabel = (hidden: number) => i18n.t('ui.moreCount', { count: hidden }),
    collapseLabel = i18n.t('common.less')
  }: Props = $props();

  let expanded = $state(false);

  const visible = $derived.by<FilterChipOption[]>(() => {
    if (expanded || options.length <= maxVisible) return options;
    const head = options.slice(0, Math.max(0, maxVisible));
    if (value == null || head.some((o) => o.value === value)) return head;
    const selected = options.find((o) => o.value === value);
    return selected ? [...head, selected] : head;
  });

  const hidden = $derived(options.length - visible.length);
</script>

<div class="chips" role="group" aria-label={ariaLabel}>
  {#if allLabel != null}
    <button
      type="button"
      class="chip"
      class:active={value == null}
      aria-pressed={value == null}
      onclick={() => onSelect(null)}
    >
      {allLabel}
    </button>
  {/if}

  {#each visible as option (option.value)}
    <button
      type="button"
      class="chip"
      class:active={value === option.value}
      aria-pressed={value === option.value}
      onclick={() => onSelect(option.value)}
    >
      {option.label}
    </button>
  {/each}

  {#if hidden > 0 || expanded}
    <button type="button" class="chip more" aria-expanded={expanded} onclick={() => (expanded = !expanded)}>
      {expanded ? collapseLabel : expandLabel(hidden)}
    </button>
  {/if}
</div>

<style>
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .chip {
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    line-height: var(--leading-tight);
    white-space: nowrap;
    cursor: pointer;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast);
  }

  .chip:hover {
    color: var(--color-text);
    border-color: var(--color-text-muted);
  }

  .chip:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .chip.active {
    background: var(--color-accent-fill);
    color: var(--color-on-accent);
    border-color: var(--color-accent-fill);
  }

  .chip.more {
    background: transparent;
    border-style: dashed;
    font-weight: var(--font-semibold);
    font-feature-settings: var(--numeric);
  }
</style>
