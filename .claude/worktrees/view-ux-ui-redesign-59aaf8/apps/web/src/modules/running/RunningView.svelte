<script lang="ts">
  /** Running (Bieg) page (PWRX-style, pace-based): totals, weekly mileage, HR zones, race predictions.
   * Presentational — all data from the loader (local store). Format helpers are inlined to avoid
   * importing values from `$lib/server`. The hand-rolled div bar tracks are gone (spec 025): weekly
   * mileage is a real `BarChart` with axes and a read-out, HR time-in-zone a `StackedBar`.
   *
   * Records live in the `records` snippet (spec 054), not here: the all-time leaderboard is its own
   * vertical slice, and a module may not import another module's component (AGENTS.md §5). The page
   * passes the card in, so this view still decides WHERE records sit in the stack. */
  import type { Snippet } from 'svelte';
  import Card from '$lib/ui/Card.svelte';
  import StatTile from '$lib/ui/StatTile.svelte';
  import BarChart from '$lib/ui/BarChart.svelte';
  import StackedBar from '$lib/ui/StackedBar.svelte';
  import type { StackedBarSegment } from '$lib/ui/StackedBar.svelte';
  import TrendChart from '$lib/ui/TrendChart.svelte';
  import RangeBadge from '$lib/ui/RangeBadge.svelte';
  import { formatMonth } from '$lib/date';
  import { bucketAxisLabel, bucketNounKey, volumeBucket } from '$lib/series';
  import RunnerProfileCard from './RunnerProfileCard.svelte';
  import RacePredictionsCard from './RacePredictionsCard.svelte';
  import type { RunningData } from './running.types';
  import { getI18n } from '$lib/i18n';
  import { rangeLabel } from '$lib/range';

  const i18n = getI18n();

  let {
    data,
    records
  }: {
    data: RunningData;
    /** All-time best-efforts card, rendered where "Rekordy życiowe" used to sit. */
    records?: Snippet;
  } = $props();

  const nf = new Intl.NumberFormat('pl-PL');

  // Mileage buckets go monthly once the range is long (spec 047), so the card titles follow.
  const volBucket = $derived(volumeBucket(data.range));
  const monthly = $derived(volBucket === 'month');
  const bucketLabel = $derived(i18n.t(bucketNounKey(volBucket)));

  const fmtPace = (secPerKm: number | null): string => {
    if (secPerKm == null || !Number.isFinite(secPerKm)) return '—';
    // Round to whole seconds first so 59.6s rolls to the next minute (avoids "1:60").
    const t = Math.round(secPerKm);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  };
  const fmtDur = (totalS: number | null): string => {
    if (totalS == null || !Number.isFinite(totalS)) return '—';
    const s = Math.round(totalS);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  };
  // Cool → hot across the five bands, so the zone split reads as intensity at a glance.
  const ZONE_LANES = ['cyan', 'green', 'amber', 'orange', 'red'];

  const weekLabels = $derived(data.weekly.map((w) => bucketAxisLabel(i18n.locale, w.week, volBucket)));
  const weekKm = $derived(data.weekly.map((w) => w.km));

  const zoneSegments = $derived<StackedBarSegment[]>(
    data.hrZones.map((z, i) => ({
      label: z.label,
      value: z.pct,
      color: `var(--lane-${ZONE_LANES[i % ZONE_LANES.length]})`
    }))
  );

  /* ---- speed–duration curve + critical speed (spec 042) ---- */
  const curveLabels = $derived(data.speedCurve.map((p) => fmtDur(p.durationS)));
  const curvePace = $derived(data.speedCurve.map((p) => p.paceSecPerKm));

  /* ---- aerobic efficiency over months (spec 038) ---- */
  const nf2 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });
  /** Months carrying at least one measurable run — nothing to chart when none do. */
  const efficiencyMonths = $derived(data.efficiency.filter((m) => m.ef !== null).length);
  const efficiencyLabels = $derived(
    data.efficiency.map((m) =>
      m.month.endsWith('-01')
        ? formatMonth(i18n.locale, m.month, 'shortYear')
        : formatMonth(i18n.locale, m.month)
    )
  );
  /**
   * Two series, one chart. Cardiac cost is in the hundreds and EF is around 1, so plotting the raw
   * numbers together would flatten EF to a straight line — the cost is scaled onto EF's range and the
   * card says the shapes are what matter, not the axis. `NaN` is how `TrendChart` draws a real gap.
   */
  const COST_SCALE = 500;
  const efficiencySeries = $derived([
    {
      name: 'Wydolność (m/min/bpm)',
      values: data.efficiency.map((m) => m.ef ?? Number.NaN),
      color: 'var(--lane-green)'
    },
    {
      name: `Koszt sercowy (÷${nf.format(COST_SCALE)} ud./km)`,
      values: data.efficiency.map((m) => (m.cardiacCost === null ? Number.NaN : m.cardiacCost / COST_SCALE)),
      color: 'var(--lane-red)'
    }
  ]);
</script>

{#if !data.hasData}
  <Card>
    <p class="empty">
      Brak aktywności biegowych. Zsynchronizuj dane w zakładce <a href="/data">Dane</a>, a bieganie pojawi się
      tutaj.
    </p>
  </Card>
{:else}
  <div class="stack">
    <!-- Totals follow the range, so the row is labelled with it — otherwise "Biegi 3" reads as a
         career total when the switch is on 7 dni (spec 047). -->
    <div class="section-head">
      <h2 class="section-title">Zakres: {rangeLabel(i18n.t, data.range)}</h2>
      <RangeBadge label={rangeLabel(i18n.t, data.range)} size="sm" />
    </div>
    {#if !data.hasWindowData}
      <p class="empty">
        Brak biegów w tym zakresie. Rekordy życiowe i profil biegacza poniżej liczą całą historię.
      </p>
    {/if}
    <div class="tiles">
      <StatTile label="Biegi" value={String(data.totals.runs)} accent="orange" />
      <StatTile label="Łączny dystans" value={`${data.totals.totalKm} km`} accent="green" />
      <StatTile label="Najdłuższy" value={`${data.totals.longestKm} km`} accent="cyan" />
      <StatTile label="Śr. tempo" value={fmtPace(data.totals.avgPaceSecPerKm)} unit="/km" accent="indigo" />
    </div>

    <RunnerProfileCard profile={data.profile} />

    <!-- No range badge on the records card, deliberately: a personal best is over a career.
         Windowing it would turn "rekord życiowy" into "best in the last week", which is a different
         claim (spec 047). -->
    {@render records?.()}

    <Card
      title="Strefy tętna"
      subtitle={data.maxHr ? `Podział na podstawie maks. tętna ${data.maxHr} bpm` : 'Brak danych o tętnie'}
      range={rangeLabel(i18n.t, data.range)}
    >
      {#if zoneSegments.length > 0}
        <StackedBar
          segments={zoneSegments}
          ariaLabel="Udział czasu w strefach tętna"
          format={(v) => `${nf.format(v)}%`}
          thickness="var(--space-4)"
        />
      {:else}
        <p class="empty">Brak strumieni tętna w zsynchronizowanych biegach.</p>
      {/if}
    </Card>

    <Card
      title="Kilometraż {monthly ? 'miesięczny' : 'tygodniowy'}"
      subtitle="Dystans w kolejnych {monthly ? 'miesiącach' : 'tygodniach'}"
      range={rangeLabel(i18n.t, data.range)}
      rangeBucketNoun={bucketLabel}
    >
      <BarChart
        values={weekKm}
        labels={weekLabels}
        color="var(--lane-orange)"
        height={200}
        unit="km"
        label="Kilometraż"
        formatValue={(n) => `${nf.format(n)} km`}
      />
    </Card>

    {#if data.predictions.length > 0}
      <RacePredictionsCard predictions={data.predictions} />
    {/if}

    {#if data.speedCurve.length > 1}
      <Card
        title="Krzywa tempa"
        subtitle="Najlepsze tempo utrzymane przez dany czas — obwiednia z ostatnich biegów, nie jedna sesja"
      >
        {#if data.criticalSpeed}
          <div class="cs">
            <div class="cs-item">
              <span class="cs-label">Tempo krytyczne</span>
              <p class="cs-value">{fmtPace(data.criticalSpeed.paceSecPerKm)}<small>min/km</small></p>
              <p class="cs-hint">
                Tempo, do którego krzywa się wypłaszcza — najszybsze, które da się utrzymać tlenowo. Biegowy
                odpowiednik FTP.
              </p>
            </div>
            <div class="cs-item">
              <span class="cs-label">Zapas beztlenowy</span>
              <p class="cs-value">{nf.format(data.criticalSpeed.dPrimeM)}<small>m</small></p>
              <p class="cs-hint">
                Ile metrów da się przebiec powyżej tempa krytycznego, zanim się skończy. Duża wartość to mocny
                finisz.
              </p>
            </div>
          </div>
        {/if}
        <TrendChart
          values={curvePace}
          labels={curveLabels}
          color="var(--lane-orange)"
          height={240}
          unit="min/km"
          label="krzywa tempa"
          formatValue={(v) => fmtPace(v)}
          formatTick={(v) => fmtPace(v)}
        />
        <p class="note">
          Niżej na wykresie = szybciej. Krzywa to obwiednia z ostatnich biegów, przy założeniu próbkowania
          sekundowego — na zegarku zapisującym rzadziej krótki koniec krzywej będzie zawyżony. To obraz
          treningu, nie wynik testu.
        </p>
      </Card>
    {/if}

    {#if efficiencyMonths > 0}
      <Card
        title="Wydolność tlenowa w czasie"
        subtitle="Średnia miesięczna. Rosnąca wydolność albo malejący koszt = lepsza forma tlenowa, niezależnie od tego, jak mocno się starało."
      >
        <TrendChart
          series={efficiencySeries}
          labels={efficiencyLabels}
          height={240}
          label="wydolność tlenowa"
          formatValue={(v) => nf2.format(v)}
        />
        <p class="note">
          Wydolność to metry na minutę na jedno uderzenie serca, koszt to uderzenia na kilometr — dlatego
          jedna linia powinna rosnąć, a druga maleć. Miesiące bez biegów są przerwą w linii, a nie zerem.
          Liczone ze średnich, więc porównuj miesiące o podobnej intensywności.
        </p>
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
  /* Heading + range indicator for the windowed totals row. */
  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .section-title {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--space-4);
  }
  .empty {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
  .note {
    margin: var(--space-3) 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    max-width: 76ch;
  }
  .cs {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--space-5);
    margin-bottom: var(--space-5);
  }
  .cs-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .cs-label {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }
  .cs-value {
    margin: 0;
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    color: var(--color-text);
    font-feature-settings: var(--numeric);
    letter-spacing: var(--tracking-tight);
  }
  .cs-value small {
    margin-left: 0.35ch;
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text-muted);
  }
  .cs-hint {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    max-width: 46ch;
  }
</style>
