<script lang="ts">
  import { sportLabel } from '$lib/sport-labels';
  import type { WidgetData } from '../dashboard-data';
  let { data }: { data: WidgetData } = $props();
  const km = (m: number | null): string =>
    m == null ? '—' : `${(m / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 1 })} km`;
  const dur = (s: number | null): string => {
    if (s == null) return '—';
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return h ? `${h}h ${m}m` : `${m}m`;
  };
</script>

<div class="list">
  {#each data.recentActivities as a (a.activityId)}
    <a class="item" href={`/activities/${a.activityId}`}>
      <div class="main">
        <span class="name">{a.name ?? sportLabel(a.sport)}</span>
        <span class="date">{a.startTimeLocal.slice(0, 10)}</span>
      </div>
      <div class="stats">
        <span>{km(a.distanceM)}</span>
        <span>{dur(a.movingS ?? a.durationS)}</span>
      </div>
    </a>
  {:else}
    <!-- Empty is now attributable: the list is windowed, so name the window rather than implying the
         store is empty (spec 047). -->
    <p class="empty">
      Brak aktywności w zakresie: {data.range.label}. Zmień zakres u góry lub zsynchronizuj dane w zakładce
      <a href="/data">Dane</a>.
    </p>
  {/each}
</div>

<style>
  .list {
    display: flex;
    flex-direction: column;
  }
  .item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--color-border);
    text-decoration: none;
    color: inherit;
  }
  .item:last-child {
    border-bottom: none;
  }
  .item:hover .name {
    color: var(--color-accent);
  }
  .main {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .date {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
  .stats {
    display: flex;
    gap: var(--space-3);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }
  .empty {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
</style>
