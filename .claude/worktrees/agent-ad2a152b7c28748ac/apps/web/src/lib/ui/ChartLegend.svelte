<script lang="ts">
  /**
   * The key to a chart's colours (spec 017): a swatch + series name per item, and — while a
   * read-out is active — that series' value at the active index, so the legend doubles as the
   * hover read-out for multi-series charts.
   *
   * Presentational: the owning chart holds the visibility state and passes `hidden` back in.
   * With `onToggle` each item becomes a real `<button aria-pressed>`, so hiding a series is
   * reachable by keyboard and announced; without it the legend is inert text.
   */

  export interface ChartLegendItem {
    /** Series name, e.g. "CTL". */
    name: string;
    /** Swatch colour — any CSS color, normally a token. */
    color: string;
    /** Pre-formatted value at the active index; omitted when no read-out is open. */
    value?: string | undefined;
    /** Series currently toggled off. */
    hidden?: boolean | undefined;
  }

  interface Props {
    items: ChartLegendItem[];
    /** Provide to make items toggle their series; omit for a read-only key. */
    onToggle?: ((index: number) => void) | undefined;
    /** Names the list for assistive tech, e.g. "Series". */
    ariaLabel?: string;
  }

  let { items, onToggle, ariaLabel = 'Chart series' }: Props = $props();
</script>

<ul class="legend" aria-label={ariaLabel}>
  {#each items as item, i (item.name + i)}
    <li>
      {#if onToggle}
        <button
          type="button"
          class="item"
          class:off={item.hidden}
          style="--sw: {item.color}"
          aria-pressed={!item.hidden}
          onclick={() => onToggle?.(i)}
        >
          <span class="swatch"></span>
          <span class="name">{item.name}</span>
          {#if item.value !== undefined}<span class="value">{item.value}</span>{/if}
        </button>
      {:else}
        <span class="item static" style="--sw: {item.color}">
          <span class="swatch"></span>
          <span class="name">{item.name}</span>
          {#if item.value !== undefined}<span class="value">{item.value}</span>{/if}
        </span>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
  }

  .item {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-1) var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-full);
    background: none;
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text-muted);
    line-height: var(--leading-snug);
    transition:
      color var(--transition-fast),
      background-color var(--transition-fast),
      border-color var(--transition-fast),
      opacity var(--transition-fast);
  }

  button.item {
    cursor: pointer;
  }

  button.item:hover {
    color: var(--color-text);
    background: var(--color-surface-hover);
    border-color: var(--color-border);
  }

  button.item:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
    border-color: var(--color-border-strong);
  }

  /* Toggled off: the swatch hollows out and the name is struck through — shape cues, not a fade,
     so the item stays AA-legible (and obviously clickable) while it is hidden. */
  .item.off .name {
    text-decoration: line-through;
  }

  .swatch {
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--sw);
    flex-shrink: 0;
    /* Line the dot up with the x-height of the name beside it. */
    transform: translateY(-1px);
  }

  .item.off .swatch {
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--sw);
  }

  .name {
    white-space: nowrap;
  }

  .value {
    font-weight: var(--font-bold);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
  }

  .item.off .value {
    color: var(--color-text-muted);
  }
</style>
