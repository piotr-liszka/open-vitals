<script lang="ts">
  import type { WidgetData } from '../dashboard-data';
  let { data }: { data: WidgetData } = $props();
  const km = (m: number): string => `${(m / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 0 })} km`;
  const cov = $derived(data.coverage);
</script>

<div class="grid">
  <div class="cell"><span class="v">{cov.activities.count}</span><span class="k">Aktywności</span></div>
  <div class="cell"><span class="v">{cov.activities.withGps}</span><span class="k">Z trasą GPS</span></div>
  <div class="cell">
    <span class="v">{km(cov.activities.totalDistanceM)}</span><span class="k">Dystans</span>
  </div>
  <div class="cell"><span class="v">{cov.weight.count}</span><span class="k">Pomiary wagi</span></div>
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: var(--space-4);
    height: 100%;
    align-content: center;
  }
  .cell {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .v {
    font-size: var(--text-xl, 1.4rem);
    font-weight: var(--font-bold);
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
  }
  .k {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }
</style>
