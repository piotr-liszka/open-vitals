<script lang="ts">
  /**
   * Walking (Marsz) page (spec 025) — the sport that previously had no analysis view at all.
   * Volume, elevation and pace from logged walks and hikes, plus the daily step count.
   * Presentational: all data from the loader; charts are the shared `lib/ui` primitives.
   */
  import Card from '$lib/ui/Card.svelte';
  import StatTile from '$lib/ui/StatTile.svelte';
  import BarChart from '$lib/ui/BarChart.svelte';
  import TrendChart from '$lib/ui/TrendChart.svelte';
  import { formatDay } from '$lib/date';
  import { bucketAxisLabel, bucketNounKey, volumeBucket } from '$lib/series';
  import { formatNumber, getI18n } from '$lib/i18n';
  import { rangeLabel } from '$lib/range';
  import type { WalkingData } from './walking.types';

  let { data }: { data: WalkingData } = $props();

  const i18n = getI18n();
  const nf = (n: number): string => formatNumber(i18n.locale, n);
  const range = $derived(rangeLabel(i18n.t, data.range));

  /*
   * Volume buckets are weekly until the range is long enough to want months (spec 047), so the card
   * titles have to follow — "Kilometraż tygodniowy" over a five-year range would be a lie about what
   * one bar is.
   */
  const volBucket = $derived(volumeBucket(data.range));
  const monthly = $derived(volBucket === 'month');
  const bucketLabel = $derived(i18n.t(bucketNounKey(volBucket)));

  function fmtPace(secPerKm: number | null): string {
    if (secPerKm == null || !Number.isFinite(secPerKm)) return '—';
    const t = Math.round(secPerKm);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  }
  function fmtDur(totalS: number): string {
    const s = Math.round(totalS);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
  }

  const weekLabels = $derived(data.weekly.map((w) => bucketAxisLabel(i18n.locale, w.week, volBucket)));
  const weekKm = $derived(data.weekly.map((w) => w.km));
  const weekElevation = $derived(data.weekly.map((w) => w.elevationM));
  const stepLabels = $derived(data.steps.map((s) => formatDay(i18n.locale, s.day, 'short')));
  // Non-finite entries are gaps in TrendChart, so a day without a synced payload breaks the line
  // rather than being drawn as a zero-step day.
  const stepValues = $derived(data.steps.map((s) => s.steps ?? Number.NaN));
</script>

{#if !data.hasData && !data.hasSteps}
  <Card title={i18n.t('walking.emptyTitle')} subtitle={i18n.t('walking.emptySubtitle')}>
    <p class="empty">
      {i18n.t('walking.emptyBody', { range })}
      <a href="/data">{i18n.t('nav.data')}</a>.
    </p>
  </Card>
{:else}
  <div class="stack">
    <div class="tiles">
      <StatTile label={i18n.t('walking.tile.sessions')} value={nf(data.totals.sessions)} accent="green" />
      <StatTile
        label={i18n.t('timeline.stat.distance')}
        value={nf(data.totals.totalKm)}
        unit="km"
        accent="cyan"
      />
      <StatTile label={i18n.t('timeline.stat.time')} value={fmtDur(data.totals.totalTimeS)} accent="indigo" />
      <StatTile
        label={i18n.t('timeline.stat.elevation')}
        value={nf(data.totals.totalElevationM)}
        unit="m"
        accent="violet"
      />
      <StatTile
        label={i18n.t('walking.tile.longest')}
        value={nf(data.totals.longestKm)}
        unit="km"
        accent="teal"
      />
      <StatTile
        label={i18n.t('walking.tile.avgPace')}
        value={fmtPace(data.totals.avgPaceSecPerKm)}
        unit="/km"
        accent="orange"
      />
    </div>

    {#if data.hasData}
      <Card
        title={i18n.t(monthly ? 'walking.kmTitle.month' : 'walking.kmTitle.week')}
        subtitle={i18n.t(monthly ? 'walking.kmSubtitle.month' : 'walking.kmSubtitle.week')}
        {range}
        rangeBucketNoun={bucketLabel}
      >
        <BarChart
          values={weekKm}
          labels={weekLabels}
          color="var(--lane-green)"
          height={200}
          unit="km"
          label={i18n.t('walking.chart.distance')}
          formatValue={(n) => `${nf(n)} km`}
        />
      </Card>

      <div class="cols">
        <Card
          title={i18n.t(monthly ? 'walking.elevationTitle.month' : 'walking.elevationTitle.week')}
          subtitle={i18n.t(monthly ? 'walking.elevationSubtitle.month' : 'walking.elevationSubtitle.week')}
          {range}
          rangeBucketNoun={bucketLabel}
        >
          <BarChart
            values={weekElevation}
            labels={weekLabels}
            color="var(--lane-violet)"
            height={180}
            unit="m"
            label={i18n.t('timeline.stat.elevation')}
            formatValue={(n) => `${nf(n)} m`}
          />
        </Card>

        <Card title={i18n.t('walking.longestTitle')} subtitle={i18n.t('walking.longestSubtitle')} {range}>
          <ul class="list">
            {#each data.highlights as h (h.activityId)}
              <li>
                <a class="row" href={`/activities/${h.activityId}`}>
                  <span class="primary">{h.name ?? h.sportLabel}</span>
                  <span class="muted">{formatDay(i18n.locale, h.day, 'shortYear')}</span>
                  <span class="num">{nf(h.km)} km</span>
                  <span class="num">{fmtDur(h.durationS)}</span>
                  <span class="num">{nf(h.elevationM)} m</span>
                </a>
              </li>
            {/each}
          </ul>
        </Card>
      </div>
    {/if}

    {#if data.hasSteps}
      <Card
        title={i18n.t('walking.stepsTitle')}
        {range}
        subtitle={data.avgSteps
          ? i18n.t('walking.stepsAvgSubtitle', { steps: nf(data.avgSteps) })
          : i18n.t('walking.stepsSubtitle')}
      >
        <TrendChart
          values={stepValues}
          labels={stepLabels}
          color="var(--lane-orange)"
          height={200}
          unit={i18n.t('walking.stepsUnit')}
          label={i18n.t('metric.steps')}
          showAvg
          formatValue={(n) => nf(Math.round(n))}
        />
      </Card>
    {/if}
  </div>
{/if}

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--space-4);
  }

  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-5);
  }

  @media (max-width: 860px) {
    .cols {
      grid-template-columns: 1fr;
    }
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .row {
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) repeat(4, minmax(0, 1fr));
    align-items: baseline;
    gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--color-border);
    font-size: var(--text-sm);
    color: var(--color-text);
    text-decoration: none;
  }

  .list li:last-child .row {
    border-bottom: none;
  }

  .row:hover .primary {
    color: var(--color-accent);
  }

  .primary {
    font-weight: var(--font-medium);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .muted {
    color: var(--color-text-muted);
    font-feature-settings: var(--numeric);
  }

  .num {
    text-align: right;
    font-feature-settings: var(--numeric);
  }

  .empty {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .empty a {
    color: var(--color-accent);
  }
</style>
