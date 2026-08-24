<script lang="ts">
  import { Card, Badge, Banner, StatTile, TrendChart, RangeBadge, Skeleton } from '$lib/ui';
  import { formatDay } from '$lib/date';
  import { bucketAxisLabel, bucketNounKey } from '$lib/series';
  import type { ResolvedRange } from '$lib/range';
  import ReadinessCard from './ReadinessCard.svelte';
  import type { CorrelationStrength, InsightsData, MetricChart, MetricFormat, Trend } from './insights.types';
  import { getI18n } from '$lib/i18n';
  import { rangeLabel } from '$lib/range';

  const i18n = getI18n();

  interface Props {
    data: InsightsData;
    /**
     * The global range this page was built for (spec 047). Every block below is derived from it —
     * this page used to own a 7/30/90/365 selector of its own, which is now the topbar switch.
     */
    range: ResolvedRange;
    loading?: boolean;
  }

  let { data, range, loading = false }: Props = $props();

  const bucketLabel = $derived(range.bucket === 'day' ? undefined : i18n.t(bucketNounKey(range.bucket)));

  const STRENGTH_TONE: Record<CorrelationStrength, 'neutral' | 'info' | 'success'> = {
    weak: 'neutral',
    moderate: 'info',
    strong: 'success'
  };

  const STRENGTH_LABEL: Record<CorrelationStrength, string> = {
    weak: 'słaba',
    moderate: 'umiarkowana',
    strong: 'silna'
  };

  const SEVERITY_LABEL: Record<'moderate' | 'strong', string> = {
    moderate: 'umiarkowana',
    strong: 'silna'
  };

  // Anomalies carry no format, so borrow each metric's format from its chart.
  const formatByKey = $derived(new Map<string, MetricFormat>(data.charts.map((c) => [c.key, c.format])));

  function fmt(n: number | null, format: MetricFormat): string {
    if (n === null) return '—';
    switch (format) {
      case 'int':
        return Math.round(n).toLocaleString('pl-PL');
      case 'decimal':
        return n.toFixed(1);
      case 'duration': {
        const t = Math.round(n);
        return `${Math.floor(t / 3600)}h ${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}m`;
      }
    }
  }

  // Day keys are calendar days — `formatDay` renders them without timezone drift (spec 018).
  const fmtDate = (key: string): string => formatDay(i18n.locale, key, 'short');

  /** Reconstruct the "healthy direction" so StatTile colours an oriented trend correctly. */
  function trendGoodWhen(t: Trend): 'up' | 'down' | undefined {
    if (t.direction === 'stable' || t.magnitudePct === null) return undefined;
    const moveUp = t.magnitudePct > 0;
    return t.direction === 'improving' ? (moveUp ? 'up' : 'down') : moveUp ? 'down' : 'up';
  }

  /** Arrow direction for StatTile — always defined ('flat' for stable). */
  function trendArrow(t: Trend): 'up' | 'down' | 'flat' {
    if (t.direction === 'stable' || t.magnitudePct === null) return 'flat';
    return t.magnitudePct > 0 ? 'up' : 'down';
  }

  interface StatRow {
    label: string;
    value: string;
    tone?: 'good';
  }

  /**
   * The statistics row under each chart — the half of this page that used to be a separate Analityka
   * page (spec 048). Every one of these is computed from the DAILY series server-side, so "najlepszy"
   * names a real day even when the chart above it is bucketed into weeks or months.
   */
  function stats(m: MetricChart): StatRow[] {
    if (m.count === 0) return [];
    const rows: StatRow[] = [
      { label: 'Średnia', value: fmt(m.avg, m.format) },
      { label: 'Zakres', value: `${fmt(m.min, m.format)} – ${fmt(m.max, m.format)}` }
    ];
    if (m.total !== null) rows.push({ label: 'Suma', value: fmt(m.total, m.format) });
    if (m.best)
      rows.push({
        label: 'Najlepszy',
        value: `${fmt(m.best.value, m.format)} · ${fmtDate(m.best.date)}`,
        tone: 'good'
      });
    if (m.worst)
      rows.push({ label: 'Najsłabszy', value: `${fmt(m.worst.value, m.format)} · ${fmtDate(m.worst.date)}` });
    rows.push({ label: 'Dni z danymi', value: `${m.count} / ${m.rangeDays}` });
    return rows;
  }
</script>

<div class="insights">
  <header class="head">
    <div>
      <h2 class="h">Wnioski</h2>
      {#if data.connected}
        <p class="sub">{fmtDate(data.start)} – {fmtDate(data.end)} · {data.window} dni</p>
      {:else}
        <p class="sub">Gotowość, trendy, anomalie i korelacje z Twoich własnych metryk</p>
      {/if}
    </div>
    <!-- Everything on this page is derived from the range, so it is marked once here rather than on
         each of the five blocks below. -->
    <RangeBadge label={rangeLabel(i18n.t, range)} bucketNoun={bucketLabel} />
  </header>

  {#if loading}
    <div class="loading">
      <Skeleton height="var(--space-24)" radius="lg" />
      <Skeleton height="var(--space-16)" radius="lg" />
      <Skeleton height="var(--space-24)" radius="lg" />
    </div>
  {:else if !data.connected}
    <Card title="Połącz Garmina, aby zobaczyć wnioski" subtitle="Wnioski wymagają połączonego konta Garmin.">
      <a class="link" href="/">Połącz na pulpicie →</a>
    </Card>
  {:else}
    <ReadinessCard readiness={data.readiness} connected={data.connected} />

    <section aria-label="Trendy">
      <h3 class="section-title">Trendy</h3>
      {#if data.trends.length === 0}
        <p class="empty">Za mało danych, aby pokazać trendy.</p>
      {:else}
        <div class="trend-grid">
          {#each data.trends as t (t.key)}
            <StatTile
              label={t.label}
              value={`${fmt(t.recentAvg, t.format)}${t.unit ? ' ' + t.unit : ''}`}
              accent={t.accent}
              delta={t.magnitudePct ?? undefined}
              deltaSuffix="%"
              goodWhen={trendGoodWhen(t)}
              trend={trendArrow(t)}
            />
          {/each}
        </div>
      {/if}
    </section>

    <section aria-label="Anomalie">
      <h3 class="section-title">Anomalie</h3>
      {#if data.anomalies.length === 0}
        <Banner tone="success" title="Nic nietypowego">Nic nietypowego — Twoje metryki są stabilne.</Banner>
      {:else}
        <div class="anomaly-list">
          {#each data.anomalies as a (a.key + a.date)}
            <Banner
              tone={a.severity === 'strong' ? 'warning' : 'info'}
              title={`${a.label}: ${a.direction === 'up' ? 'nietypowo wysoko' : 'nietypowo nisko'} ${fmtDate(a.date)}`}
            >
              Odczyt {fmt(a.value, formatByKey.get(a.key) ?? 'int')} — {Math.abs(a.z).toFixed(1)} SD od Twojej bazy
              z {data.window} dni (odchylenie {SEVERITY_LABEL[a.severity]}).
            </Banner>
          {/each}
        </div>
      {/if}
    </section>

    <section aria-label="Korelacje">
      <h3 class="section-title">Korelacje</h3>
      {#if data.correlations.length === 0}
        <p class="empty">Brak istotnych korelacji — pojawią się, gdy zbierzemy więcej dni.</p>
      {:else}
        <div class="corr-grid">
          {#each data.correlations as c (c.a + c.b + c.lag)}
            <Card>
              <div class="corr">
                <p class="corr-phrase">{c.phrasing}</p>
                <div class="corr-meta">
                  <Badge tone={STRENGTH_TONE[c.strength]}>{STRENGTH_LABEL[c.strength]}</Badge>
                  <span class="corr-r">r = {c.r} · {c.n} dni</span>
                </div>
              </div>
            </Card>
          {/each}
        </div>
      {/if}
    </section>

    <section aria-label="Wykresy długiego okresu">
      <div class="section-head">
        <h3 class="section-title">Metryki — {rangeLabel(i18n.t, range)}</h3>
        <!-- Repeated here because this is where the bucketing matters: past 45 days a point stops
             being a day, and the reader has to be told which. -->
        <RangeBadge label={rangeLabel(i18n.t, range)} bucketNoun={bucketLabel} size="sm" />
      </div>
      <div class="chart-grid">
        {#each data.charts as chart (chart.key)}
          <Card>
            <div class="chart-panel">
              <div class="chart-head">
                <span class="chart-title">
                  <span class="marker" style="--m: var(--lane-{chart.accent})"></span>{chart.label}
                </span>
                {#if chart.unit}<span class="chart-unit">{chart.unit}</span>{/if}
              </div>
              {#if chart.count === 0}
                <p class="empty">Brak danych w tym zakresie.</p>
              {:else}
                <TrendChart
                  values={chart.days.map((d) => d.value ?? NaN)}
                  labels={chart.days.map((d) => bucketAxisLabel(i18n.locale, d.date, range.bucket))}
                  color={`var(--lane-${chart.accent})`}
                  height={150}
                  showAvg
                  label={chart.label}
                  formatValue={(n) => fmt(n, chart.format)}
                />
                <dl class="stats">
                  {#each stats(chart) as s (s.label)}
                    <div class="stat">
                      <dt>{s.label}</dt>
                      <dd class:good={s.tone === 'good'}>{s.value}</dd>
                    </div>
                  {/each}
                </dl>
              {/if}
            </div>
          </Card>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .insights {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .h {
    margin: 0;
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
  }
  .sub {
    margin: var(--space-1) 0 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    font-feature-settings: var(--numeric);
  }

  .loading {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  /* Section heading with its range indicator on the same baseline. */
  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }

  .section-head .section-title {
    margin-bottom: 0;
  }

  .section-title {
    margin: 0 0 var(--space-3);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
  }

  .trend-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
  }
  @media (max-width: 900px) {
    .trend-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 560px) {
    .trend-grid {
      grid-template-columns: 1fr;
    }
  }

  .anomaly-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .corr-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }
  @media (max-width: 720px) {
    .corr-grid {
      grid-template-columns: 1fr;
    }
  }
  .corr {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .corr-phrase {
    margin: 0;
    font-size: var(--text-base);
    font-weight: var(--font-medium);
    line-height: var(--leading-normal);
    color: var(--color-text);
  }
  .corr-meta {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .corr-r {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    font-feature-settings: var(--numeric);
  }

  .chart-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-5);
  }
  @media (max-width: 900px) {
    .chart-grid {
      grid-template-columns: 1fr;
    }
  }
  .chart-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }
  .chart-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .chart-title {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
  }
  .marker {
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--m);
  }
  .chart-unit {
    font-size: var(--text-sm);
    color: var(--color-text-subtle);
  }

  /* The numbers under each chart — the old Analityka page's contribution (spec 048). Three across
     inside the two-column chart grid; two across once a card is alone on the row. */
  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
    margin: 0;
  }
  @media (max-width: 560px) {
    .stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  .stat {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }
  .stat dt {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-subtle);
  }
  .stat dd {
    margin: 0;
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
  }
  .stat dd.good {
    color: var(--color-success);
  }

  .empty {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-subtle);
  }

  .link {
    color: var(--color-accent);
    text-decoration: none;
    font-weight: var(--font-medium);
    font-size: var(--text-sm);
  }
  .link:hover {
    text-decoration: underline;
  }
</style>
