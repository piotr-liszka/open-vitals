<script lang="ts">
  import type { WidgetData } from '../dashboard-data';
  import { metricLabel, metricMeta } from '$lib/metric-labels';
  import { getI18n } from '$lib/i18n';
  import { rangeLabel } from '$lib/range';

  const i18n = getI18n();

  let { data, options }: { data: WidgetData; options?: Record<string, unknown> } = $props();

  const metricKey = $derived(typeof options?.metric === 'string' ? options.metric : 'steps');
  const spec = $derived(metricMeta(metricKey));
  const series = $derived(data.metricSeries[metricKey] ?? []);
  const points = $derived(series.filter((p): p is { date: string; value: number } => p.value !== null));
  const latest = $derived(points.length ? points[points.length - 1]!.value : null);
  const lane = $derived(spec?.accent ?? 'orange');

  // Build an inline sparkline path in a 100x32 viewbox.
  const path = $derived.by(() => {
    if (points.length < 2) return '';
    const vals = points.map((p) => p.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * 100;
        const y = 30 - ((p.value - min) / span) * 28;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });
</script>

<div class="trend">
  <div class="head">
    <span class="label">{metricLabel(i18n.t, metricKey)}</span>
    <span class="value">
      {latest ?? '—'}<span class="unit">{spec?.unit ?? ''}</span>
    </span>
  </div>
  {#if path}
    <svg class="spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke="var(--lane-{lane})"
        stroke-width="1.5"
        vector-effect="non-scaling-stroke"
      />
    </svg>
  {:else}
    <p class="empty">{i18n.t('widget.notEnoughData', { range: rangeLabel(i18n.t, data.range) })}</p>
  {/if}
</div>

<style>
  .trend {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    height: 100%;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .label {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }
  .value {
    font-size: var(--text-xl, 1.4rem);
    font-weight: var(--font-bold);
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
  }
  .unit {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    margin-left: 2px;
  }
  .spark {
    width: 100%;
    height: 48px;
    flex: 1;
  }
  .empty {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
</style>
