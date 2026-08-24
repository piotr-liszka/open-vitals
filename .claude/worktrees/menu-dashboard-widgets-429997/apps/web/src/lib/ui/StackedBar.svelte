<script lang="ts" module>
  /** One proportional slice of a `StackedBar`. */
  export interface StackedBarSegment {
    /** Human label used in the legend and the accessible summary. */
    label: string;
    /** Non-negative magnitude; slices are sized by their share of the total. */
    value: number;
    /** Any CSS colour — pass a token, e.g. `var(--lane-indigo)`. */
    color: string;
  }
</script>

<script lang="ts">
  /**
   * A single composition bar: one track split into proportional, token-coloured slices with an
   * optional legend (spec 022). Built for "what was this made of" data — sleep stages, HR zones,
   * sport mix — where a stack carries the whole shape in one line of vertical space.
   *
   * Not a chart: no axes, no interaction. Segments with a zero/negative value are dropped so a
   * missing stage leaves no hairline artefact.
   */
  interface Props {
    segments: StackedBarSegment[];
    /** Accessible name for the bar as a whole. */
    ariaLabel: string;
    /** Render the label/value legend under the track. */
    legend?: boolean;
    /** Formats a segment's value for the legend (defaults to the raw number). */
    format?: (value: number) => string;
    /** Track thickness token, e.g. `var(--space-3)`. */
    thickness?: string;
  }

  let {
    segments,
    ariaLabel,
    legend = true,
    format = (v) => String(v),
    thickness = 'var(--space-3)'
  }: Props = $props();

  const shown = $derived(segments.filter((s) => Number.isFinite(s.value) && s.value > 0));
  const total = $derived(shown.reduce((sum, s) => sum + s.value, 0));

  function pct(value: number, sum: number): number {
    return sum > 0 ? (value / sum) * 100 : 0;
  }

  const summary = $derived(
    shown.map((s) => `${s.label} ${format(s.value)} (${Math.round(pct(s.value, total))}%)`).join(', ')
  );
</script>

{#if shown.length > 0}
  <div class="stack" style="--track: {thickness}">
    <div class="track" role="img" aria-label={`${ariaLabel}: ${summary}`}>
      {#each shown as s (s.label)}
        <span class="seg" style="width: {pct(s.value, total)}%; background: {s.color}"></span>
      {/each}
    </div>

    {#if legend}
      <ul class="legend">
        {#each shown as s (s.label)}
          <li class="item">
            <span class="swatch" style="background: {s.color}" aria-hidden="true"></span>
            <span class="label">{s.label}</span>
            <span class="value">{format(s.value)}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  .track {
    display: flex;
    width: 100%;
    height: var(--track);
    border-radius: var(--radius-full);
    overflow: hidden;
    background: var(--color-surface-2);
    /* Hairline gaps between slices read as an instrument scale, not as separate pills. */
    gap: 2px;
  }

  .seg {
    display: block;
    height: 100%;
    min-width: 2px;
  }

  .legend {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-4);
  }

  .item {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-2);
    font-size: var(--text-xs);
    min-width: 0;
  }

  .swatch {
    align-self: center;
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    flex-shrink: 0;
  }

  .label {
    color: var(--color-text-muted);
    letter-spacing: var(--tracking-wide);
  }

  .value {
    color: var(--color-text);
    font-weight: var(--font-semibold);
    font-feature-settings: var(--numeric);
  }
</style>
