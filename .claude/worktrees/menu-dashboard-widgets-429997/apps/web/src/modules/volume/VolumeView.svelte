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
  import type { VolumeData, VolumeMeasure } from './volume.types';

  let { data }: { data: VolumeData } = $props();

  let measure = $state<VolumeMeasure>('distance');

  const measureOptions = [
    { value: 'distance', label: 'Dystans' },
    { value: 'duration', label: 'Czas' },
    { value: 'elevation', label: 'Przewyższenie' }
  ];

  const nf = new Intl.NumberFormat('pl-PL');
  const nf1 = new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const fmtKm = (metres: number): string => `${nf.format(Math.round(metres / 1000))} km`;
  const fmtM = (metres: number): string => `${nf.format(Math.round(metres))} m`;
  function fmtHours(totalS: number): string {
    const h = Math.floor(totalS / 3600);
    const m = Math.round((totalS % 3600) / 60);
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
  }

  /** Everything the monthly chart needs for the chosen measure, in one place. */
  const chosen = $derived.by(() => {
    if (measure === 'duration') {
      return {
        label: 'Czas',
        unit: 'h',
        pick: (i: number) => data.monthly[i]?.durationS ?? 0,
        series: (s: { durationS: number[] }) => s.durationS,
        format: fmtHours,
        tick: (v: number) => nf.format(Math.round(v / 3600))
      };
    }
    if (measure === 'elevation') {
      return {
        label: 'Przewyższenie',
        unit: 'm',
        pick: (i: number) => data.monthly[i]?.elevationGainM ?? 0,
        series: (s: { elevationGainM: number[] }) => s.elevationGainM,
        format: fmtM,
        tick: (v: number) => nf.format(Math.round(v))
      };
    }
    return {
      label: 'Dystans',
      unit: 'km',
      pick: (i: number) => data.monthly[i]?.distanceM ?? 0,
      series: (s: { distanceM: number[] }) => s.distanceM,
      format: fmtKm,
      tick: (v: number) => nf.format(Math.round(v / 1000))
    };
  });

  const monthLabels = $derived(
    data.months.map((m) => (m.endsWith('-01') ? formatMonth(m, 'shortYear') : formatMonth(m, 'short')))
  );

  /** One bar series per sport family, so a month's bar shows what the month was made of. */
  const monthSeries = $derived(
    data.bySport.map((s) => ({ name: s.label, values: chosen.series(s), color: s.color }))
  );

  /** The average line is only meaningful for distance, which is what it is measured in. */
  const baseline = $derived(
    measure === 'distance' && data.avgDistanceM !== null ? data.avgDistanceM : undefined
  );

  const current = $derived(data.years.find((y) => y.partial) ?? data.years[0]);
  const previous = $derived(data.years.find((y) => y.year === (current?.year ?? 0) - 1));

  /** Newest year first reads best in a legend, and a brighter lane marks the year in progress. */
  const YEAR_LANES = ['var(--lane-orange)', 'var(--lane-cyan)', 'var(--lane-violet)', 'var(--lane-teal)'];
  const yearSeries = $derived(
    data.years.map((y, i) => ({
      name: String(y.year),
      values: y.cumulativeKm.map((v) => (v === null ? NaN : v)),
      color: YEAR_LANES[i] ?? 'var(--color-accent)'
    }))
  );

  const aheadTone = $derived(
    data.vsLastYearKm === null ? 'neutral' : data.vsLastYearKm >= 0 ? 'success' : 'warning'
  );
</script>

{#if !data.hasData}
  <Card title="Objętość">
    <p class="empty">
      Brak zsynchronizowanych aktywności w ostatnich latach. Po pierwszej synchronizacji pojawią się tu
      miesiące i porównanie rok do roku.
    </p>
  </Card>
{:else}
  <div class="page">
    <section class="tiles" aria-label="Podsumowanie objętości">
      {#if current}
        <StatTile
          label="W tym roku do dziś"
          value={nf.format(Math.round(current.toDateKm))}
          unit="km"
          accent="orange"
        />
      {/if}
      {#if previous}
        <StatTile
          label={`${previous.year} do tego dnia`}
          value={nf.format(Math.round(previous.toDateKm))}
          unit="km"
          accent="cyan"
        />
        <StatTile
          label={`Cały ${previous.year}`}
          value={nf.format(Math.round(previous.totalKm))}
          unit="km"
          accent="teal"
        />
      {/if}
      {#if data.avgDistanceM !== null}
        <StatTile
          label="Średnio na pełny miesiąc"
          value={nf.format(Math.round(data.avgDistanceM / 1000))}
          unit="km"
          accent="green"
        />
      {/if}
      {#if data.bestMonth}
        <StatTile
          label={`Najlepszy miesiąc · ${formatMonth(data.bestMonth.month, 'shortYear')}`}
          value={nf.format(Math.round(data.bestMonth.distanceM / 1000))}
          unit="km"
          accent="violet"
        />
      {/if}
    </section>

    <Card
      title="Rok do roku"
      subtitle="Suma kilometrów narastająco. Każdy rok mierzony w tym samym dniu sezonu — inaczej porównanie nie miałoby sensu."
    >
      {#if data.vsLastYearKm !== null && previous}
        <p class="verdict">
          <Badge tone={aheadTone}>
            {data.vsLastYearKm >= 0 ? 'Przed' : 'Za'} rokiem {previous.year}
          </Badge>
          <span class="verdict-text">
            o <strong>{nf1.format(Math.abs(data.vsLastYearKm))} km</strong> na ten sam dzień roku.
          </span>
        </p>
      {/if}
      <TrendChart
        series={yearSeries}
        labels={data.dayOfYearLabels}
        height={300}
        unit="km"
        label="dystans narastająco"
        formatValue={(v) => `${nf1.format(v)} km`}
        formatTick={(v) => nf.format(Math.round(v))}
      />
    </Card>

    <Card
      title="Miesiąc po miesiącu"
      subtitle={`Ostatnie ${data.windowMonths} miesięcy, w podziale na sporty. Bieżący miesiąc jest niepełny.`}
    >
      {#snippet actions()}
        <SegmentedControl
          options={measureOptions}
          value={measure}
          onChange={(v) => (measure = v as VolumeMeasure)}
          ariaLabel="Miara objętości"
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
        <p class="note">
          Linia odniesienia to średnia z pełnych miesięcy — bieżący, niepełny miesiąc nie wchodzi do tej
          średniej ani do „najlepszego miesiąca”.
        </p>
      {/if}
    </Card>

    {#if data.gridDays.length > 0}
      <Card
        title="Regularność {data.gridYear}"
        subtitle="Każdy dzień roku jako jedno pole — streaki, przerwy i sezonowość widać tu od razu, czego nie pokaże żaden wykres tygodniowy"
      >
        <YearGrid
          days={data.gridDays.map((d) => ({ day: d.day, value: d.km, title: d.title }))}
          year={data.gridYear}
          color="var(--lane-orange)"
          ariaLabel="Regularność treningu"
          unit="km"
        />
        <p class="note">
          Odcień zależy od tego, jak duży był to dzień <em>na tle Twoich pozostałych dni</em>, a nie na tle
          największego — inaczej jeden długi bieg wyblakłby cały rok. Dzień bez aktywności jest pustym polem,
          nie najjaśniejszym odcieniem.
        </p>
      </Card>
    {/if}

    <Card title="Miesiące" subtitle="Te same liczby w tabeli, z zaznaczonym miesiącem w toku">
      <div class="table-wrap">
        <table class="months">
          <thead>
            <tr>
              <th scope="col">Miesiąc</th>
              <th scope="col" class="num">Aktywności</th>
              <th scope="col" class="num">Dystans</th>
              <th scope="col" class="num">Czas</th>
              <th scope="col" class="num">Przewyższenie</th>
            </tr>
          </thead>
          <tbody>
            {#each [...data.monthly].reverse() as m (m.month)}
              <tr class:partial={m.partial}>
                <th scope="row">
                  {formatMonth(m.month, 'longYear')}
                  {#if m.partial}<span class="tag">w toku</span>{/if}
                </th>
                <td class="num">{nf.format(m.activities)}</td>
                <td class="num">{fmtKm(m.distanceM)}</td>
                <td class="num">{fmtHours(m.durationS)}</td>
                <td class="num">{fmtM(m.elevationGainM)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Card>
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
