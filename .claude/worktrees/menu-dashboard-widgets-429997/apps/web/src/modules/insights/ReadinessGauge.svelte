<script lang="ts" module>
  import type { ReadinessBand } from './insights.types';

  export const BAND_TONE: Record<ReadinessBand, 'danger' | 'warning' | 'info' | 'success'> = {
    low: 'danger',
    moderate: 'warning',
    high: 'info',
    peak: 'success'
  };

  export const BAND_LABEL: Record<ReadinessBand, string> = {
    low: 'Niska',
    moderate: 'Umiarkowana',
    high: 'Wysoka',
    peak: 'Szczytowa'
  };
</script>

<script lang="ts">
  /**
   * The readiness readout on its own: score, band, basis and the driver chips (spec 022).
   *
   * Extracted from `ReadinessCard` so `/insights` and the start page's condition panel render the
   * SAME gauge instead of two drifting copies — the start page absorbs it into a bigger block
   * rather than stacking a second overlapping card next to it.
   */
  import { Badge } from '$lib/ui';
  import type { Readiness } from './insights.types';

  interface Props {
    readiness: Readiness;
    /** `lg` is the start-page hero size; `md` suits a card among equals. */
    size?: 'md' | 'lg';
  }

  let { readiness, size = 'md' }: Props = $props();

  function arrow(direction: 'up' | 'down'): string {
    return direction === 'up' ? '↑' : '↓';
  }
</script>

<div class="gauge" class:lg={size === 'lg'}>
  <div class="score-block">
    <span class="score">{readiness.score}</span>
    <div class="band">
      <Badge tone={BAND_TONE[readiness.band]}>{BAND_LABEL[readiness.band]}</Badge>
      <span class="basis">na podstawie {readiness.basisDays} dni</span>
    </div>
  </div>

  <ul class="drivers" aria-label="Czynniki gotowości">
    {#each readiness.drivers as d (d.key)}
      <li class="chip" style="--m: var(--lane-{d.accent})">
        <span class="marker" aria-hidden="true"></span>
        <span class="chip-label">{d.label}</span>
        <span class="chip-dir" class:up={d.direction === 'up'} class:down={d.direction === 'down'}>
          {arrow(d.direction)}
        </span>
        <span class="chip-contrib">{d.contribution}</span>
      </li>
    {/each}
  </ul>
</div>

<style>
  .gauge {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  .score-block {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .score {
    font-size: var(--readout-2xl);
    font-weight: var(--font-black);
    line-height: 1;
    letter-spacing: var(--tracking-tight);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
  }

  .lg .score {
    /* The start page's opening number: the one readout that carries the whole answer. */
    font-size: var(--readout-2xl);
    letter-spacing: var(--tracking-tighter);
  }

  .band {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .basis {
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    letter-spacing: var(--tracking-wide);
    font-feature-settings: var(--numeric);
  }

  .drivers {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--color-text-on-surface);
  }

  .marker {
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--m);
    flex-shrink: 0;
  }

  .chip-label {
    color: var(--color-text-muted);
  }

  .chip-dir {
    line-height: 1;
  }
  .chip-dir.up {
    color: var(--color-success);
  }
  .chip-dir.down {
    color: var(--color-danger);
  }

  .chip-contrib {
    font-feature-settings: var(--numeric);
    color: var(--color-text);
  }
</style>
