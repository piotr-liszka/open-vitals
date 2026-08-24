<script lang="ts">
  /**
   * The volume page (spec 037): months down one side, years down the other.
   *
   * Two comparisons the app could not make before, and both are only honest with a caveat attached,
   * so the caveat is on the page rather than in a doc comment:
   *
   *  · The month in progress is **partial**. Its bar is drawn hatched and excluded from the average
   *    and the best-month tile, because on the 2nd of a month the alternative is a page that says
   *    training has collapsed.
   *  · A year is compared at **the same day of the season**, never full-year against part-year. The
   *    headline tile is "do dziś" for exactly that reason, and last year's whole-year total sits
   *    beside it as context rather than as the comparison.
   */
  import Card from '$lib/ui/Card.svelte';
  import StatTile from '$lib/ui/StatTile.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import BarChart from '$lib/ui/BarChart.svelte';
  import TrendChart from '$lib/ui/TrendChart.svelte';
  import SegmentedControl from '$lib/ui/SegmentedControl.svelte';
  import YearGrid from '$lib/ui/YearGrid.svelte';
  import { formatMonth } from '$lib/date';
  import {
    LAST_12,
    avgCompleteDistanceM,
    bestCompleteMonth,
    periodOptions,
    slicePeriod
  } from './volume.period';
  import type { VolumeData, VolumeMeasure, VolumeSportFilter } from './volume.types';
  import { formatNumber, getI18n } from '$lib/i18n';

  const i18n = getI18n();

  let { data }: { data: VolumeData } = $props();

  let measure = $state<VolumeMeasure>('distance');

  const measureOptions = [
    { value: 'distance', label: i18n.t('volume.measure.distance') },
    { value: 'duration', label: i18n.t('volume.measure.duration') },
    { value: 'elevation', label: i18n.t('volume.measure.elevation') }
  ];

  /* ---------------------------------------------------------------- *
   * Year over year — one sport family at a time (spec 070)
   * ---------------------------------------------------------------- */

  let sport = $state<VolumeSportFilter>('all');

  /** Only offered when there is something to choose between: one sport, no switch. */
  const hasSportFilter = $derived(data.sportOptions.length > 1);
  const yoy = $derived(data.yearsBySport[sport] ?? { years: data.years, vsLastYearKm: data.vsLastYearKm });
  const sportLabel = $derived(
    data.sportOptions.find((o) => o.value === sport)?.label ?? i18n.t('volume.sportFilter.all')
  );
  /** ` · Bieg` when a family is picked, empty for the combined view. */
  const sportSuffix = $derived(sport === 'all' ? '' : ` · ${sportLabel}`);

  /* ---------------------------------------------------------------- *
   * Period — ONE filter over the monthly bars, the grid and the table
   * ---------------------------------------------------------------- */

  let period = $state<string>(LAST_12);

  const periods = $derived(
    periodOptions(data.years.map((y) => y.year)).map((o) => ({
      value: o.value,
      label: o.labelKey ? i18n.t(o.labelKey) : o.label,
      short: o.shortKey ? i18n.t(o.shortKey) : o.short
    }))
  );
  const slice = $derived(slicePeriod(data.months, period, data.today));
  /** The period as the reader's language reads it — see `PeriodSlice.labelKey`. */
  const periodLabel = $derived(slice.labelKey ? i18n.t(slice.labelKey) : slice.label);

  /** Every parallel series is index-aligned with `data.months`, so one index list slices them all. */
  const monthlyInPeriod = $derived(slice.indices.map((i) => data.monthly[i]!).filter(Boolean));
  const avgDistanceM = $derived(avgCompleteDistanceM(monthlyInPeriod));
  const bestMonth = $derived(bestCompleteMonth(monthlyInPeriod));

  /**
   * The partial-month caveat is only true when a partial month is on screen. A finished year has
   * none, and a caveat about a bar that is not there sends the reader looking for it.
   */
  const monthlySubtitle = $derived.by(() => {
    const period = `${periodLabel[0]!.toUpperCase()}${periodLabel.slice(1)}`;
    const caveat = monthlyInPeriod.some((m) => m.partial) ? ` ${i18n.t('volume.monthly.partialCaveat')}` : '';
    return `${i18n.t('volume.monthly.subtitleFor', { period })}${caveat}`;
  });

  // Locale-aware, not a hardcoded 'pl-PL': an English UI reading "740,2 km" (Polish decimal comma)
  // is the same bug as untranslated text, just in the numbers instead of the words.
  const nf = (n: number): string => formatNumber(i18n.locale, n);
  const nf1 = (n: number): string =>
    formatNumber(i18n.locale, n, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const fmtKm = (metres: number): string => `${nf(Math.round(metres / 1000))} km`;
  const fmtM = (metres: number): string => `${nf(Math.round(metres))} m`;
  function fmtHours(totalS: number): string {
    const h = Math.floor(totalS / 3600);
    const m = Math.round((totalS % 3600) / 60);
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
  }

  /** Everything the monthly chart needs for the chosen measure, in one place. */
  const chosen = $derived.by(() => {
    if (measure === 'duration') {
      return {
        label: i18n.t('volume.measure.duration'),
        unit: 'h',
        pick: (i: number) => data.monthly[i]?.durationS ?? 0,
        series: (s: { durationS: number[] }) => s.durationS,
        format: fmtHours,
        tick: (v: number) => nf(Math.round(v / 3600))
      };
    }
    if (measure === 'elevation') {
      return {
        label: i18n.t('volume.measure.elevation'),
        unit: 'm',
        pick: (i: number) => data.monthly[i]?.elevationGainM ?? 0,
        series: (s: { elevationGainM: number[] }) => s.elevationGainM,
        format: fmtM,
        tick: (v: number) => nf(Math.round(v))
      };
    }
    return {
      label: i18n.t('volume.measure.distance'),
      unit: 'km',
      pick: (i: number) => data.monthly[i]?.distanceM ?? 0,
      series: (s: { distanceM: number[] }) => s.distanceM,
      format: fmtKm,
      tick: (v: number) => nf(Math.round(v / 1000))
    };
  });

  const monthLabels = $derived(
    slice.months.map((m) =>
      m.endsWith('-01') ? formatMonth(i18n.locale, m, 'shortYear') : formatMonth(i18n.locale, m, 'short')
    )
  );

  /** One bar series per sport family, so a month's bar shows what the month was made of. */
  const monthSeries = $derived(
    data.bySport.map((s) => ({
      name: s.label,
      values: slice.indices.map((i) => chosen.series(s)[i] ?? 0),
      color: s.color
    }))
  );

  /** The average line is only meaningful for distance, which is what it is measured in. */
  const baseline = $derived(measure === 'distance' && avgDistanceM !== null ? avgDistanceM : undefined);

  const current = $derived(yoy.years.find((y) => y.partial) ?? yoy.years[0]);
  const previous = $derived(yoy.years.find((y) => y.year === (current?.year ?? 0) - 1));

  /** Newest year first reads best in a legend, and a brighter lane marks the year in progress. */
  const YEAR_LANES = ['var(--lane-orange)', 'var(--lane-cyan)', 'var(--lane-violet)', 'var(--lane-teal)'];
  const yearSeries = $derived(
    yoy.years.map((y, i) => ({
      name: String(y.year),
      values: y.cumulativeKm.map((v) => (v === null ? NaN : v)),
      color: YEAR_LANES[i] ?? 'var(--color-accent)'
    }))
  );

  const aheadTone = $derived(
    yoy.vsLastYearKm === null ? 'neutral' : yoy.vsLastYearKm >= 0 ? 'success' : 'warning'
  );
</script>

{#if !data.hasData}
  <Card title={i18n.t('volume.title')}>
    <p class="empty">{i18n.t('volume.empty')}</p>
  </Card>
{:else}
  <div class="page">
    <!--
      These are the year chart's own numbers, so they follow its sport filter. The label carries the
      family when one is picked: the switch lives in the card below them, and "1936 km" quietly
      becoming "159 km" with nothing on the tile to say why reads as a bug (spec 070).
    -->
    <section class="tiles" aria-label={i18n.t('volume.summaryLabel')}>
      {#if current}
        <StatTile
          label={`${i18n.t('volume.tile.thisYearToDate')}${sportSuffix}`}
          value={nf(Math.round(current.toDateKm))}
          unit="km"
          accent="orange"
        />
      {/if}
      {#if previous}
        <StatTile
          label={`${i18n.t('volume.tile.yearToThisDay', { year: previous.year })}${sportSuffix}`}
          value={nf(Math.round(previous.toDateKm))}
          unit="km"
          accent="cyan"
        />
        <StatTile
          label={`${i18n.t('volume.tile.wholeYear', { year: previous.year })}${sportSuffix}`}
          value={nf(Math.round(previous.totalKm))}
          unit="km"
          accent="teal"
        />
      {/if}
    </section>

    <Card
      title={i18n.t('volume.yoy.title')}
      subtitle={hasSportFilter
        ? i18n.t('volume.yoy.subtitleWithSport', { sport: sportLabel.toLowerCase() })
        : i18n.t('volume.yoy.subtitle')}
    >
      {#snippet actions()}
        {#if hasSportFilter}
          <SegmentedControl
            options={data.sportOptions.map((o) => ({ value: o.value, label: o.label }))}
            value={sport}
            onChange={(v) => (sport = v as VolumeSportFilter)}
            ariaLabel={i18n.t('volume.yoy.sportAriaLabel')}
            size="sm"
          />
        {/if}
      {/snippet}
      {#if yoy.vsLastYearKm !== null && previous}
        <p class="verdict">
          <Badge tone={aheadTone}>
            {i18n.t(yoy.vsLastYearKm >= 0 ? 'volume.yoy.ahead' : 'volume.yoy.behind', {
              year: previous.year
            })}
          </Badge>
          <span class="verdict-text">
            {i18n.t('volume.yoy.byKmLead')} <strong>{nf1(Math.abs(yoy.vsLastYearKm))} km</strong>
            {i18n.t('volume.yoy.byKmTrail')}
          </span>
        </p>
      {/if}
      {#if yearSeries.length === 0}
        <p class="empty">{i18n.t('volume.yoy.emptySport')}</p>
      {:else}
        <TrendChart
          series={yearSeries}
          labels={data.dayOfYearLabels}
          height={300}
          unit="km"
          label={i18n.t('volume.yoy.label')}
          formatValue={(v) => `${nf1(v)} km`}
          formatTick={(v) => nf(Math.round(v))}
        />
      {/if}
    </Card>

    <!--
      ONE control for the three blocks below it (spec 070). The bars, the grid and the table are the
      same months at three resolutions; they used to cover three different spans, so "Regularność
      2026" sat between a 24-month chart and a 24-month table. The switch sits in its own header
      above all three rather than in any one card's actions, because it governs none of them alone.
    -->
    <section class="period" aria-labelledby="volume-period">
      <div class="period-head">
        <h2 class="period-title" id="volume-period">{i18n.t('volume.period.sectionTitle')}</h2>
        <SegmentedControl
          options={periods.map((o) => ({ value: o.value, label: o.label, short: o.short }))}
          value={period}
          onChange={(v) => (period = v)}
          ariaLabel={i18n.t('volume.period.ariaLabel')}
          size="sm"
        />
      </div>

      {#if avgDistanceM !== null || bestMonth}
        <div class="tiles">
          {#if avgDistanceM !== null}
            <StatTile
              label={i18n.t('volume.tile.avgPerFullMonth')}
              value={nf(Math.round(avgDistanceM / 1000))}
              unit="km"
              accent="green"
            />
          {/if}
          {#if bestMonth}
            <StatTile
              label={i18n.t('volume.tile.bestMonth', {
                month: formatMonth(i18n.locale, bestMonth.month, 'shortYear')
              })}
              value={nf(Math.round(bestMonth.distanceM / 1000))}
              unit="km"
              accent="violet"
            />
          {/if}
        </div>
      {/if}

      <Card title={i18n.t('volume.monthly.title')} subtitle={monthlySubtitle}>
        {#snippet actions()}
          <SegmentedControl
            options={measureOptions}
            value={measure}
            onChange={(v) => (measure = v as VolumeMeasure)}
            ariaLabel={i18n.t('volume.measureAriaLabel')}
            size="sm"
          />
        {/snippet}
        <BarChart
          series={monthSeries}
          labels={monthLabels}
          height={300}
          unit={chosen.unit}
          label={chosen.label}
          formatValue={chosen.format}
          formatTick={chosen.tick}
          {...baseline === undefined ? {} : { baseline }}
        />
        {#if baseline !== undefined}
          <p class="note">{i18n.t('volume.monthly.baselineNote')}</p>
        {/if}
      </Card>

      {#if data.gridDays.length > 0}
        <Card
          title={i18n.t('volume.grid.titleWithPeriod', { period: periodLabel })}
          subtitle={i18n.t('volume.grid.subtitleGeneric')}
        >
          <YearGrid
            days={data.gridDays.map((d) => ({ day: d.day, value: d.km, title: d.title }))}
            from={slice.from}
            to={slice.to}
            year={Number(slice.months[0]?.slice(0, 4) ?? data.today.slice(0, 4))}
            spanLabel={periodLabel}
            color="var(--lane-orange)"
            ariaLabel={i18n.t('volume.grid.ariaLabel')}
            unit="km"
          />
          <p class="note">{i18n.t('volume.grid.noteWithPeriod')}</p>
        </Card>
      {/if}

      <Card title={i18n.t('volume.months.title')} subtitle={i18n.t('volume.months.subtitle')}>
        <div class="table-wrap">
          <table class="months">
            <thead>
              <tr>
                <th scope="col">{i18n.t('volume.months.month')}</th>
                <th scope="col" class="num">{i18n.t('volume.months.activities')}</th>
                <th scope="col" class="num">{i18n.t('volume.measure.distance')}</th>
                <th scope="col" class="num">{i18n.t('volume.measure.duration')}</th>
                <th scope="col" class="num">{i18n.t('volume.measure.elevation')}</th>
              </tr>
            </thead>
            <tbody>
              {#each [...monthlyInPeriod].reverse() as m (m.month)}
                <tr class:partial={m.partial}>
                  <th scope="row">
                    {formatMonth(i18n.locale, m.month, 'longYear')}
                    {#if m.partial}<span class="tag">{i18n.t('volume.months.inProgress')}</span>{/if}
                  </th>
                  <td class="num">{nf(m.activities)}</td>
                  <td class="num">{fmtKm(m.distanceM)}</td>
                  <td class="num">{fmtHours(m.durationS)}</td>
                  <td class="num">{fmtM(m.elevationGainM)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  </div>
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-4);
  }

  /* The three blocks one period switch governs, held together so the switch's scope is visible. */
  .period {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .period-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .period-title {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
  }

  .empty {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    max-width: 60ch;
  }

  .verdict {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    margin: 0 0 var(--space-4);
  }

  .verdict-text {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .verdict-text strong {
    color: var(--color-text);
    font-feature-settings: var(--numeric);
  }

  .note {
    margin: var(--space-3) 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    max-width: 72ch;
  }

  /* A wide table must scroll inside its own box, never push the page sideways. */
  .table-wrap {
    overflow-x: auto;
  }

  .months {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  .months th,
  .months td {
    padding: var(--space-2) var(--space-3);
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
  }

  .months thead th {
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }

  .months tbody th {
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }

  .num {
    text-align: right;
    font-feature-settings: var(--numeric);
  }

  /* The month in progress is dimmed so its short bar is never read as a drop in training. */
  .months tr.partial {
    color: var(--color-text-muted);
  }

  .tag {
    margin-left: var(--space-2);
    padding: 0 var(--space-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }
</style>
