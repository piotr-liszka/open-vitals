<script lang="ts">
  /**
   * Training overview (spec 025) — the multi-sport landing page. Answers "where did my training
   * actually go?" before it answers "what is my form", because that is the question a person who
   * walks, rides and runs in the same week opens this page with.
   *
   * Presentational: every number comes from the loader. Charts are the shared `lib/ui` primitives.
   */
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import StatTile from '$lib/ui/StatTile.svelte';
  import BarChart from '$lib/ui/BarChart.svelte';
  import TrendChart from '$lib/ui/TrendChart.svelte';
  import LoadRiskCard from './LoadRiskCard.svelte';
  import IntensityMixCard from './IntensityMixCard.svelte';
  import StackedBar from '$lib/ui/StackedBar.svelte';
  import type { ChartSeries } from '$lib/ui/chart-axis';
  import type { StackedBarSegment } from '$lib/ui/StackedBar.svelte';
  import { formatDay } from '$lib/date';
  import { bucketAxisLabel, bucketNoun } from '$lib/series';
  import RangeBadge from '$lib/ui/RangeBadge.svelte';
  import { SPORT_GROUP_LANES, type SportGroup } from '$lib/sport-labels';
  import type { TrainingBand, TrainingOverviewData } from './training.types';

  let { data }: { data: TrainingOverviewData } = $props();

  const BAND_LABEL: Record<TrainingBand, string> = {
    fresh: 'Świeży',
    optimal: 'Optymalny',
    neutral: 'Neutralny',
    fatigued: 'Zmęczony',
    'very-fatigued': 'Bardzo zmęczony'
  };
  const BAND_TONE: Record<TrainingBand, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
    fresh: 'info',
    optimal: 'success',
    neutral: 'neutral',
    fatigued: 'warning',
    'very-fatigued': 'danger'
  };

  /**
   * One lane colour per sport family, so a family reads the same in every chart in the APP — the map
   * moved into the shared taxonomy in spec 037 rather than being re-declared per page.
   */
  const GROUP_LANE = SPORT_GROUP_LANES;
  const REST_LANE = 'var(--lane-teal)';

  /** Grouped bars stay readable up to four families; the tail is summed so no hour goes missing. */
  const MAX_SERIES = 4;

  const nf = new Intl.NumberFormat('pl-PL');
  const round = (n: number): string => nf.format(Math.round(n));

  function fmtHours(totalS: number): string {
    const h = Math.floor(totalS / 3600);
    const m = Math.round((totalS % 3600) / 60);
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
  }
  const fmtKm = (m: number): string => nf.format(Math.round(m / 1000));
  const weekLabels = $derived(data.weeks.map((w) => bucketAxisLabel(w, data.range.bucket)));

  // The window is the global range now (spec 047), so headings name the range instead of a week count.
  const rangeLabel = $derived(data.range.label);
  const bucketLabel = $derived(data.range.bucket === 'day' ? undefined : bucketNoun(data.range.bucket));
  /** What one volume column covers — the chart is weekly until the range forces monthly buckets. */
  const volumeUnit = $derived(data.range.bucket === 'month' ? 'miesiącu' : 'tygodniu');

  const mix = $derived<StackedBarSegment[]>(
    data.sports.map((s) => ({ label: s.label, value: s.durationS, color: GROUP_LANE[s.group] }))
  );

  const volumeSeries = $derived.by<ChartSeries[]>(() => {
    const head = data.weekly.slice(0, MAX_SERIES).map((s) => ({
      name: s.label,
      values: s.hours,
      color: GROUP_LANE[s.group]
    }));
    const tail = data.weekly.slice(MAX_SERIES);
    if (tail.length === 0) return head;
    const merged = data.weeks.map(
      (_, i) => Math.round(tail.reduce((sum, s) => sum + (s.hours[i] ?? 0), 0) * 10) / 10
    );
    return [...head, { name: 'Pozostałe', values: merged, color: REST_LANE }];
  });

  const pmcSeries = $derived<ChartSeries[]>([
    { name: 'CTL', values: data.series.map((p) => p.ctl), color: 'var(--lane-green)' },
    { name: 'ATL', values: data.series.map((p) => p.atl), color: 'var(--lane-red)' },
    { name: 'TSB', values: data.series.map((p) => p.tsb), color: 'var(--lane-sky)' }
  ]);
  const pmcLabels = $derived(data.series.map((p) => formatDay(p.day, 'short')));

  const hasWindow = $derived(data.totals.activities > 0);
</script>

<div class="overview">
  {#if !hasWindow && !data.hasData}
    <Card title="Brak treningów do pokazania" subtitle="Ta sekcja czyta zsynchronizowane aktywności.">
      <p class="empty">
        Nie znaleziono żadnych aktywności. Uruchom synchronizację w zakładce <a href="/data">Dane</a>, a
        rower, bieg i marsz pojawią się tutaj automatycznie.
      </p>
    </Card>
  {:else}
    <section class="block" aria-labelledby="window-heading">
      <div class="head">
        <h2 class="heading" id="window-heading">Zakres: {rangeLabel}</h2>
        <RangeBadge label={rangeLabel} size="sm" />
      </div>
      <div class="tiles">
        <StatTile label="Aktywności" value={round(data.totals.activities)} accent="orange" />
        <StatTile label="Czas" value={fmtHours(data.totals.durationS)} accent="cyan" />
        <StatTile label="Dystans" value={fmtKm(data.totals.distanceM)} unit="km" accent="green" />
        <StatTile label="Przewyższenie" value={round(data.totals.elevationGainM)} unit="m" accent="violet" />
      </div>
    </section>

    {#if data.sports.length > 0}
      <Card
        title="Podział na sporty"
        subtitle="Udział czasu treningowego w wybranym zakresie"
        range={rangeLabel}
      >
        <StackedBar
          segments={mix}
          ariaLabel="Podział czasu treningowego na sporty"
          legend={false}
          format={fmtHours}
          thickness="var(--space-4)"
        />
        <ul class="sports">
          {#each data.sports as s (s.group)}
            <li class="sport">
              <span class="sport-name">
                <span class="dot" style="background: {GROUP_LANE[s.group]}" aria-hidden="true"></span>
                {#if s.href}
                  <a href={s.href}>{s.label}</a>
                {:else}
                  <span>{s.label}</span>
                {/if}
              </span>
              <span class="metric"
                ><span class="k">Treningi</span><span class="v">{round(s.activities)}</span></span
              >
              <span class="metric"
                ><span class="k">Czas</span><span class="v">{fmtHours(s.durationS)}</span></span
              >
              <span class="metric"
                ><span class="k">Dystans</span><span class="v">{fmtKm(s.distanceM)} km</span></span
              >
              <span class="metric"
                ><span class="k">Przewyższenie</span><span class="v">{round(s.elevationGainM)} m</span></span
              >
              <span class="metric"
                ><span class="k">Obciążenie</span><span class="v">{round(s.load)}</span></span
              >
            </li>
          {/each}
        </ul>
      </Card>

      <Card
        title="Objętość treningu"
        subtitle="Godziny treningu w {volumeUnit}, z podziałem na sporty"
        range={rangeLabel}
        rangeBucketNoun={bucketLabel}
      >
        <BarChart
          series={volumeSeries}
          labels={weekLabels}
          height={220}
          unit="godz."
          label="Objętość"
          formatValue={(n) => `${nf.format(n)} h`}
        />
      </Card>
    {/if}

    <section class="block" aria-labelledby="form-heading">
      <div class="head">
        <h2 class="heading" id="form-heading">Forma</h2>
        <Badge tone={BAND_TONE[data.band]}>{BAND_LABEL[data.band]}</Badge>
      </div>
      <!-- The streak sits with CTL/ATL/TSB rather than in the window tiles above because, like them,
           it is all-time and does not follow the range (spec 048). It shows even without load data:
           weeks you turned up are countable whether or not the watch reported a training load. -->
      <div class="tiles">
        {#if data.hasData}
          <StatTile label="CTL (forma)" value={round(data.ctl)} unit="TSS/d" accent="green" />
          <StatTile label="ATL (zmęczenie)" value={round(data.atl)} unit="TSS/d" accent="red" />
          <StatTile label="TSB (świeżość)" value={round(data.tsb)} accent="sky" />
        {/if}
        <StatTile
          label="Seria"
          value={round(data.streakWeeks)}
          unit={data.streakWeeks === 1 ? 'tydzień' : 'tygodni'}
          accent="orange"
        />
      </div>
    </section>

    <Card
      title="Rekomendacja"
      subtitle={data.ftpWatts
        ? `Obciążenie z mocy · FTP ${data.ftpWatts} W`
        : 'Obciążenie z danych Garmina i tętna'}
    >
      <p class="reco">{data.recommendation}</p>
      {#if !data.hasData}
        <p class="empty">
          PMC potrzebuje treningów z obciążeniem, mocą lub tętnem. Uruchom synchronizację w zakładce
          <a href="/data">Dane</a>.
        </p>
      {/if}
    </Card>

    {#if data.hasData && data.series.length > 1}
      <!-- No range indicator, on purpose: CTL/ATL/TSB is a 42-day-constant model, so its window is
           fixed at a year and the global switch does not (and must not) narrow it — spec 047. -->
      <Card title="PMC — zarządzanie formą" subtitle="CTL (forma), ATL (zmęczenie) i TSB (świeżość) w czasie">
        <TrendChart
          series={pmcSeries}
          labels={pmcLabels}
          height={300}
          unit="TSS/d"
          label="PMC"
          formatValue={(n) => round(n)}
        />
      </Card>
    {/if}

    {#if data.hasData}
      <LoadRiskCard risk={data.risk} perSport={data.perSport} />
    {/if}

    <IntensityMixCard mix={data.intensityMix} weeks={data.intensityWeeks} />
  {/if}
</div>

<style>
  .overview {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .heading {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-subtle);
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--space-4);
  }

  @media (max-width: 900px) {
    .tiles {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 520px) {
    .tiles {
      grid-template-columns: 1fr;
    }
  }

  .sports {
    list-style: none;
    margin: var(--space-5) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .sport {
    display: grid;
    grid-template-columns: minmax(120px, 1.4fr) repeat(5, minmax(0, 1fr));
    align-items: baseline;
    gap: var(--space-3);
    padding: var(--space-3) 0;
    border-top: 1px solid var(--color-border);
  }

  .sport-name {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-2);
    font-weight: var(--font-semibold);
    color: var(--color-text);
    min-width: 0;
  }

  .sport-name a {
    color: var(--color-text);
    text-decoration: none;
  }

  .sport-name a:hover {
    color: var(--color-accent);
    text-decoration: underline;
  }

  .dot {
    align-self: center;
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    flex-shrink: 0;
  }

  .metric {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .metric .k {
    font-size: var(--text-xs);
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-subtle);
  }

  .metric .v {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
  }

  @media (max-width: 900px) {
    .sport {
      grid-template-columns: 1fr 1fr 1fr;
    }
    .sport-name {
      grid-column: 1 / -1;
    }
  }

  .reco {
    margin: 0;
    font-size: var(--text-base);
    line-height: var(--leading-normal);
    color: var(--color-text);
  }

  .empty {
    margin: var(--space-3) 0 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .empty a {
    color: var(--color-accent);
  }
</style>
