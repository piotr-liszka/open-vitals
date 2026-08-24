<script lang="ts">
  /**
   * The floating read-out shared by every chart (spec 016): a heading (usually the x-axis label)
   * plus one row per series. Purely presentational and `pointer-events: none` — the owning chart
   * decides when it is visible and where it is anchored. Its parent must be `position: relative`.
   */
  import { tooltipAlign } from './chart-interaction';

  export interface ChartTooltipRow {
    /** Series name; omitted for single-series charts where the heading already says what it is. */
    label?: string | undefined;
    /** Pre-formatted value — the chart owns its own number formatting. */
    value: string;
    /** Swatch colour, e.g. `var(--lane-cyan)`. Omit for no swatch. */
    color?: string | undefined;
  }

  interface Props {
    /** Anchor x, in px within the parent box. */
    x: number;
    /** Parent width in px — decides which side the box hangs off. */
    width: number;
    /** Heading line, usually the active x-axis label (a date). */
    title?: string | undefined;
    rows: ChartTooltipRow[];
  }

  let { x, width, title, rows }: Props = $props();

  const align = $derived(tooltipAlign(x, width));
  // Percent keeps the box glued to the point when the chart is resized between renders.
  const leftPct = $derived(width > 0 ? (x / width) * 100 : 50);
</script>

<div class="tip {align}" style="left: {leftPct}%" aria-hidden="true">
  {#if title}<span class="tip-title">{title}</span>{/if}
  {#each rows as r, i (r.label ?? i)}
    <span class="tip-row">
      {#if r.color}<span class="swatch" style="--sw: {r.color}"></span>{/if}
      {#if r.label}<span class="k">{r.label}</span>{/if}
      <span class="v">{r.value}</span>
    </span>
  {/each}
</div>

<style>
  .tip {
    position: absolute;
    top: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    min-width: max-content;
    background: var(--color-surface);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    /* The read-out must never eat the pointer events the chart's hit layer needs. */
    pointer-events: none;
  }

  /* Hang the box inside the frame near the edges instead of centring it off-canvas. */
  .tip.middle {
    transform: translateX(-50%);
  }
  .tip.start {
    transform: translateX(0);
  }
  .tip.end {
    transform: translateX(-100%);
  }

  .tip-title {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
    font-feature-settings: var(--numeric);
  }

  .tip-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    font-size: var(--text-sm);
    line-height: var(--leading-snug);
  }

  .swatch {
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--sw);
    flex-shrink: 0;
    /* Baseline-align the dot with the digits next to it. */
    transform: translateY(-1px);
  }

  .k {
    color: var(--color-text-muted);
  }

  .v {
    margin-left: auto;
    font-weight: var(--font-bold);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
  }
</style>
