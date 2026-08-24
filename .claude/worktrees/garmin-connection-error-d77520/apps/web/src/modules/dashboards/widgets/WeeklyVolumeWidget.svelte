<script lang="ts">
  import type { WidgetData } from '../dashboard-data';
  import { bucketAxisLabel } from '$lib/series';

  let { data }: { data: WidgetData } = $props();

  /**
   * How many bars fit a widget this size. The range can reach "cały czas", which is ~60 monthly
   * buckets — more rows than the tile is tall. We show the most RECENT `MAX_BARS` and say so below,
   * rather than silently cropping (which would read as "that is the whole range").
   */
  const MAX_BARS = 14;

  const all = $derived(data.weeklyVolume);
  const shown = $derived(all.slice(-MAX_BARS));
  const hidden = $derived(all.length - shown.length);
  const max = $derived(Math.max(1, ...shown.map((w) => w.hours)));
  // Bucket start is a calendar day key — rendered without touching a timezone (spec 018).
  const fmtBucket = (start: string): string => bucketAxisLabel(start, data.range.bucket);
</script>

<div class="bars">
  {#each shown as w (w.week)}
    <div class="row">
      <span class="lbl">{fmtBucket(w.week)}</span>
      <div class="track"><div class="fill" style="width: {(w.hours / max) * 100}%"></div></div>
      <span class="val">{w.hours ? `${w.hours} h` : '—'}</span>
    </div>
  {/each}
  {#if hidden > 0}
    <p class="note">Pokazano {shown.length} ostatnich z {all.length} w zakresie.</p>
  {/if}
</div>

<style>
  .bars {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    height: 100%;
    justify-content: center;
  }
  .row {
    display: grid;
    grid-template-columns: 42px 1fr 48px;
    align-items: center;
    gap: var(--space-3);
  }
  .lbl,
  .val {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }
  .note {
    margin: var(--space-1) 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
  }
  .val {
    text-align: right;
    color: var(--color-text);
  }
  .track {
    height: 10px;
    border-radius: var(--radius-pill, 999px);
    background: var(--color-surface-hover, rgba(127, 127, 127, 0.15));
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--lane-orange, #ff5a1f);
    border-radius: inherit;
    min-width: 2px;
  }
</style>
