<script lang="ts">
  /**
   * MultiSelect — a button that opens a popover checklist for picking zero-or-more items from a
   * small-to-medium list (roughly 2–15 options), e.g. "which of this group's charts to overlay".
   *
   * A native `<select multiple>` cannot show a colour swatch per option (it renders whatever the OS
   * gives it), and picking more than one option needs ctrl/cmd-click that most users never discover.
   * This is a real ARIA listbox instead: a trigger button (`aria-haspopup="listbox"`) that opens a
   * `role="listbox"` of `role="option"` rows, each pairing a decorative checkbox glyph with the
   * option's own swatch colour — the same colour a chart legend would show for that series
   * (`ChartLegendItem`, `FloatingReadoutItem`).
   *
   * Presentational: `selected` is the caller's state (bindable so a route/module owns the source of
   * truth); this component only toggles membership and manages its own open/focus state. Multi-select
   * stays open across clicks — closing on every pick would make choosing three of twelve options
   * three separate re-opens.
   */
  import Icon from './Icon.svelte';

  export interface MultiSelectOption {
    value: string;
    label: string;
    /** Swatch colour — any CSS color, normally a token (e.g. `var(--lane-cyan)`). Omit for no swatch. */
    color?: string;
  }

  interface Props {
    options: MultiSelectOption[];
    /** Currently chosen `value`s (bindable). */
    selected: string[];
    /** The control's own name, e.g. "Charts to overlay" — used as the trigger/listbox accessible
     * name whenever `ariaLabel` is not given, and as the trigger's visible text when nothing (and
     * no `placeholder`) is more specific. */
    label: string;
    /** Accessible name for the trigger + listbox, when `label` alone is not descriptive enough. */
    ariaLabel?: string;
    /** Trigger text shown while `selected` is empty. Falls back to `label`. */
    placeholder?: string;
    /** Formats the trigger summary for 2+ selections. Default: `"${count} selected"` — override to
     * localize. */
    summaryFormatter?: (count: number, total: number) => string;
  }

  function defaultSummaryFormatter(count: number): string {
    return `${count} selected`;
  }

  let {
    options,
    selected = $bindable(),
    label,
    ariaLabel,
    placeholder,
    summaryFormatter = defaultSummaryFormatter
  }: Props = $props();

  const id = $props.id();
  const listId = `${id}-listbox`;
  const accessibleName = $derived(ariaLabel ?? label);

  const summaryText = $derived.by(() => {
    if (selected.length === 0) return placeholder ?? label;
    if (selected.length === 1) {
      const only = options.find((o) => o.value === selected[0]);
      return only?.label ?? summaryFormatter(1, options.length);
    }
    return summaryFormatter(selected.length, options.length);
  });

  let open = $state(false);
  let root = $state<HTMLElement | null>(null);
  let triggerEl = $state<HTMLButtonElement | null>(null);
  let rows = $state<(HTMLButtonElement | null)[]>([]);
  let focusedIndex = $state(0);

  // Whenever the popover opens (by any means), send focus to a sensible row: the first selected one
  // if there is one, otherwise the first row. Re-runs if focusedIndex changes while still open, which
  // is exactly the roving-focus case (arrow keys inside the list).
  $effect(() => {
    if (open) rows[focusedIndex]?.focus();
  });

  function isSelected(value: string): boolean {
    return selected.includes(value);
  }

  function toggle(value: string): void {
    selected = isSelected(value) ? selected.filter((v) => v !== value) : [...selected, value];
  }

  function close(): void {
    open = false;
  }

  function openList(): void {
    if (options.length === 0) return;
    const preselected = options.findIndex((o) => isSelected(o.value));
    focusedIndex = preselected >= 0 ? preselected : 0;
    open = true;
  }

  function onTriggerClick(): void {
    if (open) close();
    else openList();
  }

  function onTriggerKeydown(event: KeyboardEvent): void {
    if (open) return;
    switch (event.key) {
      case 'Enter':
      case ' ':
      case 'ArrowDown':
        event.preventDefault();
        openList();
        break;
      default:
        return;
    }
  }

  function onRowKeydown(event: KeyboardEvent, index: number): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusedIndex = Math.min(index + 1, options.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusedIndex = Math.max(index - 1, 0);
        break;
      case 'Home':
        event.preventDefault();
        focusedIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        focusedIndex = options.length - 1;
        break;
      case 'Enter':
      case ' ': {
        const option = options[index];
        if (!option) return;
        event.preventDefault();
        toggle(option.value);
        break;
      }
      case 'Escape':
        event.preventDefault();
        close();
        triggerEl?.focus();
        break;
      default:
        return;
    }
  }

  // Dismiss on any click that lands outside the trigger + popover. Capturing (not bubbling), so a
  // row inside the popover that also stops propagation on click can't defeat the outside-close.
  $effect(() => {
    if (!open) return;
    function onDocumentClick(event: MouseEvent): void {
      if (root && !root.contains(event.target as Node)) close();
    }
    document.addEventListener('click', onDocumentClick, true);
    return () => document.removeEventListener('click', onDocumentClick, true);
  });

  function onWindowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && open) {
      close();
      triggerEl?.focus();
    }
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="multiselect" bind:this={root}>
  <button
    type="button"
    class="trigger"
    class:open
    bind:this={triggerEl}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls={listId}
    aria-label={`${accessibleName}: ${summaryText}`}
    onclick={onTriggerClick}
    onkeydown={onTriggerKeydown}
  >
    <span class="summary">{summaryText}</span>
    <Icon name="chevron-down" size={16} />
  </button>

  {#if open}
    <ul class="popover" id={listId} role="listbox" aria-multiselectable="true" aria-label={accessibleName}>
      {#each options as option, index (option.value)}
        {@const checked = isSelected(option.value)}
        <li>
          <button
            type="button"
            role="option"
            class="option"
            aria-selected={checked}
            bind:this={rows[index]}
            tabindex={index === focusedIndex ? 0 : -1}
            onclick={() => toggle(option.value)}
            onkeydown={(event) => onRowKeydown(event, index)}
          >
            <span class="checkbox" class:checked aria-hidden="true">
              {#if checked}<Icon name="check" size={12} />{/if}
            </span>
            {#if option.color}<span class="swatch" style="--sw: {option.color}" aria-hidden="true"
              ></span>{/if}
            <span class="opt-label">{option.label}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .multiselect {
    position: relative;
    display: inline-flex;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--space-10);
    max-width: 18rem;
    padding: 0 var(--space-3);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: var(--color-text-on-surface);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast);
  }

  .trigger:hover {
    background: var(--color-surface-hover);
  }

  .trigger:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .trigger.open {
    border-color: var(--color-accent);
    color: var(--color-text);
  }

  .trigger .summary {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .trigger :global(svg) {
    flex-shrink: 0;
    color: var(--color-text-muted);
    transition: transform var(--transition-fast);
  }

  .trigger.open :global(svg) {
    transform: rotate(180deg);
  }

  /*
    Elevated surface anchored to the trigger, same recipe as InfoPopover's panel. Sits above sticky
    in-page chrome (table headers, the topbar) so it is never clipped underneath one, but stays below
    the sidebar drawer and toasts (spec 034's stacking scale).
  */
  .popover {
    position: absolute;
    top: calc(100% + var(--space-2));
    left: 0;
    z-index: calc(var(--z-sticky) + 10);
    width: max-content;
    min-width: 100%;
    max-width: min(20rem, calc(100vw - var(--space-8)));
    /* ~8 rows before it scrolls internally instead of growing down the page. */
    max-height: 18rem;
    overflow-y: auto;
    margin: 0;
    padding: var(--space-1);
    list-style: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-lg);
  }

  .option {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-on-surface);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    text-align: left;
    cursor: pointer;
    transition: background var(--transition-fast);
  }

  .option:hover {
    background: var(--color-surface-hover);
  }

  .option:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  .option[aria-selected='true'] {
    color: var(--color-text);
  }

  .checkbox {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--space-4);
    height: var(--space-4);
    flex-shrink: 0;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    color: var(--color-on-accent);
    transition:
      background var(--transition-fast),
      border-color var(--transition-fast);
  }

  .checkbox.checked {
    background: var(--color-accent-fill);
    border-color: var(--color-accent-fill);
  }

  .swatch {
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--sw);
    flex-shrink: 0;
  }

  .opt-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
