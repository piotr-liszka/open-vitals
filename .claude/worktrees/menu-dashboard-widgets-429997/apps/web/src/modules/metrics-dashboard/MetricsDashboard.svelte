<script lang="ts">
  import { Card, StatTile, RangeBadge, TrendChart } from '$lib/ui';
  import { formatDay } from '$lib/date';
  import { bucketAxisLabel, bucketNoun } from '$lib/series';
  import ConsentPanel from '$modules/consent/ConsentPanel.svelte';
  import type { ConsentFeatureView } from '$modules/consent/consent.types';
  import { formatMetricText } from './dashboard.format';
  import type { DashboardData } from './dashboard.types';

  interface Props {
    data: DashboardData;
    analyticsFeature: ConsentFeatureView | null;
    /** Called after consent changes so the parent can reload trend data. */
    onConsentChange?: () => void;
    /** "Updated HH:MM"-style label from the last (auto-)refresh; hidden until set. */
    updatedLabel?: string | undefined;
    /** Dim + mark busy while a background refresh is in flight (no layout shift). */
    busy?: boolean;
  }

  let { data, analyticsFeature, onConsentChange, updatedLabel, busy = false }: Props = $props();

  // `data.date` is a calendar day key — formatted as a day, never re-parsed as an instant (spec 018).
  const dateLabel = $derived(formatDay(data.date, 'long'));

  /*
   * The window used to be picked here, by this card's own 7/14/30 control (spec 028). It is now the
   * app-wide range from the topbar (spec 047), so the card only *reports* it — one badge for the whole
   * grid rather than six identical ones, since every tile shares the range.
   *
   * Note what the badge does NOT cover: the headline readouts are the newest reading, not a windowed
   * figure. Only the sparklines and the deltas follow the range, which is what the tooltip says.
   */
  const bucketLabel = $derived(data.range.bucket === 'day' ? undefined : bucketNoun(data.range.bucket));

  // X-axis labels: one per bucket, thinned by TrendChart when they would collide.
  const dayLabels = $derived(data.days.map((d) => bucketAxisLabel(d, data.range.bucket)));

  /**
   * `null` is how a gap travels over JSON (`NaN` does not survive `JSON.stringify`); TrendChart's gap
   * contract is a non-finite value, so the conversion happens here, at the boundary.
   */
  function chartValues(series: (number | null)[]): number[] {
    return series.map((v) => (v === null ? Number.NaN : v));
  }

  const definedCount = (series: (number | null)[]): number =>
    series.reduce<number>((n, v) => (v === null ? n : n + 1), 0);
</script>

<section class="dash" aria-label="Dzisiejsze metryki">
  <header class="head">
    <div>
      <h2 class="h">Dziś</h2>
      <p class="sub">Migawka z {dateLabel}</p>
    </div>
    <div class="head-meta">
      {#if updatedLabel}
        <span class="updated" aria-live="polite">{updatedLabel}</span>
      {/if}
      {#if data.analyticsEnabled}
        <RangeBadge label={data.range.label} bucketNoun={bucketLabel} size="sm" />
      {/if}
    </div>
  </header>

  <div class="grid" class:busy aria-busy={busy}>
    {#each data.tiles as tile, i (tile.key)}
      <div class="cell" style="--i: {i};">
        <StatTile
          label={tile.label}
          value={tile.value ?? '—'}
          muted={tile.value === null}
          unit={tile.unit}
          accent={tile.accent}
          delta={data.analyticsEnabled && tile.delta !== null ? tile.delta : undefined}
          deltaSuffix="%"
          goodWhen={tile.goodWhen}
        >
          {#snippet sparkline()}
            {#if data.analyticsEnabled && definedCount(tile.series) > 1}
              <!--
                A real dated trend, not a decorative squiggle (spec 028): one slot per calendar day,
                gaps left as gaps, dates on the x axis, values formatted like the readout above.
              -->
              <TrendChart
                values={chartValues(tile.series)}
                labels={dayLabels}
                color={`var(--lane-${tile.accent})`}
                label={tile.label}
                height={96}
                yAxis={false}
                legend={false}
                showArea
                formatValue={(n) => formatMetricText(n, tile.format)}
              />
            {/if}
          {/snippet}
        </StatTile>
      </div>
    {/each}
  </div>

  {#if !data.analyticsEnabled && analyticsFeature}
    <Card
      title="Odblokuj trendy tygodniowe"
      subtitle="Włącz, aby zobaczyć, jak każda metryka zmienia się w czasie"
    >
      <ConsentPanel feature={analyticsFeature} onUpdated={() => onConsentChange?.()} />
    </Card>
  {/if}
</section>

<style>
  .dash {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .head-meta {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .updated {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-subtle);
    font-feature-settings: var(--numeric);
  }

  .h {
    margin: 0;
    font-size: var(--text-xl);
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

  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
    transition: opacity var(--transition-base);
  }

  /* Background refresh: dim in place, no layout shift, guard against double-clicks. */
  .grid.busy {
    opacity: 0.6;
    pointer-events: none;
  }

  .cell {
    display: contents;
  }

  /* Staggered entrance — one authored moment as the dashboard comes to life. */
  @media (prefers-reduced-motion: no-preference) {
    .cell {
      display: block;
      animation: tile-in var(--duration-slow) var(--ease-out) backwards;
      animation-delay: calc(var(--i) * var(--motion-stagger));
    }
  }

  @keyframes tile-in {
    from {
      opacity: 0;
      transform: translateY(var(--space-2));
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 900px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 560px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
