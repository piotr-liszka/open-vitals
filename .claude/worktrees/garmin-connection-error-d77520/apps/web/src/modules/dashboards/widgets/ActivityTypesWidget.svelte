<script lang="ts">
  import { sportLabel } from '$lib/sport-labels';
  import type { WidgetData } from '../dashboard-data';
  let { data }: { data: WidgetData } = $props();

  const LANES = ['orange', 'cyan', 'green', 'indigo', 'amber', 'red', 'sky', 'teal', 'lime'];
  const total = $derived(data.typeBreakdown.reduce((s, t) => s + t.count, 0) || 1);
</script>

<div class="types">
  {#each data.typeBreakdown.slice(0, 6) as t, i (t.sport)}
    <div class="row">
      <span class="dot" style="background: var(--lane-{LANES[i % LANES.length]})"></span>
      <span class="name">{sportLabel(t.sport)}</span>
      <div class="track">
        <div
          class="fill"
          style="width: {(t.count / total) * 100}%; background: var(--lane-{LANES[i % LANES.length]})"
        ></div>
      </div>
      <span class="n">{t.count}</span>
    </div>
  {:else}
    <p class="empty">Brak aktywności w zakresie: {data.range.label}.</p>
  {/each}
</div>

<style>
  .types {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    height: 100%;
    justify-content: center;
  }
  .row {
    display: grid;
    grid-template-columns: 12px 88px 1fr 28px;
    align-items: center;
    gap: var(--space-2);
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .name {
    font-size: var(--text-sm);
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .track {
    height: 8px;
    border-radius: var(--radius-pill, 999px);
    background: var(--color-surface-hover, rgba(127, 127, 127, 0.15));
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: inherit;
    min-width: 2px;
  }
  .n {
    font-size: var(--text-xs);
    text-align: right;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }
  .empty {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
</style>
