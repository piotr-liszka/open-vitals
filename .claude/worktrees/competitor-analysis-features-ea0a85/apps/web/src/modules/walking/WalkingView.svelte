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
  import { bucketAxisLabel, bucketNoun, volumeBucket } from '$lib/series';
  import type { WalkingData } from './walking.types';

  let { data }: { data: WalkingData } = $props();

  const nf = new Intl.NumberFormat('pl-PL');

  /*
   * Volume buckets are weekly until the range is long enough to want months (spec 047), so the card
   * titles have to follow — "Kilometraż tygodniowy" over a five-year range would be a lie about what
   * one bar is.
   */
  const volBucket = $derived(volumeBucket(data.range));
  const monthly = $derived(volBucket === 'month');
  const bucketAdjective = $derived(monthly ? 'miesięczny' : 'tygodniowy');
  const bucketPlural = $derived(monthly ? 'miesiącach' : 'tygodniach');
  const bucketLocative = $derived(monthly ? 'miesiącu' : 'tygodniu');
  const bucketLabel = $derived(bucketNoun(volBucket));

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

  const weekLabels = $derived(data.weekly.map((w) => bucketAxisLabel(w.week, volBucket)));
  const weekKm = $derived(data.weekly.map((w) => w.km));
  const weekElevation = $derived(data.weekly.map((w) => w.elevationM));
  const stepLabels = $derived(data.steps.map((s) => formatDay(s.day, 'short')));
  // Non-finite entries are gaps in TrendChart, so a day without a synced payload breaks the line
  // rather than being drawn as a zero-step day.
  const stepValues = $derived(data.steps.map((s) => s.steps ?? Number.NaN));
</script>

{#if !data.hasData && !data.hasSteps}
  <Card title="Brak marszów i wędrówek" subtitle="Ta strona czyta zsynchronizowane aktywności typu marsz.">
    <p class="empty">
      Nie znaleziono marszów, spacerów ani wędrówek w zakresie: {data.range.label}. Zmień zakres u góry strony
      lub uruchom synchronizację w zakładce <a href="/data">Dane</a>.
    </p>
  </Card>
{:else}
  <div class="stack">
    <div class="tiles">
      <StatTile label="Marsze" value={nf.format(data.totals.sessions)} accent="green" />
      <StatTile label="Dystans" value={nf.format(data.totals.totalKm)} unit="km" accent="cyan" />
      <StatTile label="Czas" value={fmtDur(data.totals.totalTimeS)} accent="indigo" />
      <StatTile
        label="Przewyższenie"
        value={nf.format(data.totals.totalElevationM)}
        unit="m"
        accent="violet"
      />
      <StatTile label="Najdłuższy" value={nf.format(data.totals.longestKm)} unit="km" accent="teal" />
      <StatTile label="Śr. tempo" value={fmtPace(data.totals.avgPaceSecPerKm)} unit="/km" accent="orange" />
    </div>

    {#if data.hasData}
      <Card
        title="Kilometraż {bucketAdjective}"
        subtitle="Dystans pokonany w kolejnych {bucketPlural}"
        range={data.range.label}
        rangeBucketNoun={bucketLabel}
      >
        <BarChart
          values={weekKm}
          labels={weekLabels}
          color="var(--lane-green)"
          height={200}
          unit="km"
          label="Kilometraż"
          formatValue={(n) => `${nf.format(n)} km`}
        />
      </Card>

      <div class="cols">
        <Card
          title="Przewyższenie {monthly ? 'miesięczne' : 'tygodniowe'}"
          subtitle="Suma podejść w {bucketLocative}"
          range={data.range.label}
          rangeBucketNoun={bucketLabel}
        >
          <BarChart
            values={weekElevation}
            labels={weekLabels}
            color="var(--lane-violet)"
            height={180}
            unit="m"
            label="Przewyższenie"
            formatValue={(n) => `${nf.format(n)} m`}
          />
        </Card>

        <Card title="Najdłuższe trasy" subtitle="Największy dystans w zakresie" range={data.range.label}>
          <ul class="list">
            {#each data.highlights as h (h.activityId)}
              <li>
                <a class="row" href={`/activities/${h.activityId}`}>
                  <span class="primary">{h.name ?? h.sportLabel}</span>
                  <span class="muted">{formatDay(h.day, 'shortYear')}</span>
                  <span class="num">{nf.format(h.km)} km</span>
                  <span class="num">{fmtDur(h.durationS)}</span>
                  <span class="num">{nf.format(h.elevationM)} m</span>
                </a>
              </li>
            {/each}
          </ul>
        </Card>
      </div>
    {/if}

    {#if data.hasSteps}
      <Card
        title="Kroki dzienne"
        range={data.range.label}
        subtitle={data.avgSteps
          ? `Średnio ${nf.format(data.avgSteps)} kroków dziennie`
          : 'Dzienna liczba kroków'}
      >
        <TrendChart
          values={stepValues}
          labels={stepLabels}
          color="var(--lane-orange)"
          height={200}
          unit="kroki"
          label="Kroki"
          showAvg
          formatValue={(n) => nf.format(Math.round(n))}
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
