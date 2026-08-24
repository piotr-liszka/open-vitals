<script lang="ts">
  /**
   * Is the easy training actually easy? (spec 044)
   *
   * The page above says how much the athlete trained. This says how much of it was comfortable, which is
   * the question behind the most repeated piece of endurance advice there is — and the one most
   * self-coached athletes get wrong in the same direction.
   *
   * Presentational. Two things are on the page rather than only in the engine, because both change what
   * the reader should conclude: the shares are of CLASSIFIED time (a strapless session is not counted as
   * easy), and a session's band comes from its AVERAGE heart rate, so an interval session lands in the
   * middle whatever its zone split looked like.
   */
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import StackedBar from '$lib/ui/StackedBar.svelte';
  import type { StackedBarSegment } from '$lib/ui/StackedBar.svelte';
  import BarChart from '$lib/ui/BarChart.svelte';
  import { formatDay } from '$lib/date';
  import type { IntensityBand, IntensityMix, IntensityWeek, MixVerdict } from './training.types';
  import { formatNumber, getI18n } from '$lib/i18n';

  const i18n = getI18n();

  let { mix, weeks }: { mix: IntensityMix; weeks: readonly IntensityWeek[] } = $props();

  /** The WHO's weekly target, drawn as the chart's baseline. */
  const WEEKLY_TARGET = 150;
  const weekLabels = $derived(weeks.map((w) => formatDay(i18n.locale, w.week, 'dayMonth')));
  const weekMinutes = $derived(weeks.map((w) => w.weightedMinutes));
  const weeksOnTarget = $derived(weeks.filter((w) => w.metTarget).length);
  /** Nothing to chart when no week scored a single qualifying minute. */
  const hasMinutes = $derived(weekMinutes.some((m) => m > 0));

  const BAND_LABEL: Record<IntensityBand, string> = {
    easy: 'Spokojnie',
    moderate: 'Średnio',
    hard: 'Mocno'
  };

  const BAND_LANE: Record<IntensityBand, string> = {
    easy: 'var(--lane-green)',
    moderate: 'var(--lane-amber)',
    hard: 'var(--lane-red)'
  };

  const VERDICT_LABEL: Record<MixVerdict, string> = {
    'on-model': 'Zgodnie z modelem',
    'too-hard': 'Za mało spokojnie',
    'too-easy': 'Brak mocnych bodźców',
    unknown: 'Brak danych'
  };

  const VERDICT_TONE: Record<MixVerdict, 'neutral' | 'success' | 'warning' | 'info'> = {
    'on-model': 'success',
    'too-hard': 'warning',
    'too-easy': 'info',
    unknown: 'neutral'
  };

  const nf = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 });

  function fmtHours(totalS: number): string {
    const h = Math.floor(totalS / 3600);
    const m = Math.round((totalS % 3600) / 60);
    return h > 0 ? `${h} h ${m} min` : `${m} min`;
  }

  const segments = $derived<StackedBarSegment[]>(
    mix.bands.map((b) => ({ label: BAND_LABEL[b.band], value: b.pct, color: BAND_LANE[b.band] }))
  );
</script>

<Card
  title="Rozkład intensywności"
  subtitle="Ile treningu było naprawdę spokojne — pytanie, na którym najczęściej łapią się trenujący samodzielnie"
>
  {#snippet actions()}
    <Badge tone={VERDICT_TONE[mix.verdict]}>{VERDICT_LABEL[mix.verdict]}</Badge>
  {/snippet}

  {#if mix.easyPct === null}
    <p class="advice">{mix.advice}</p>
  {:else}
    <p class="headline">
      <span class="big">{nf1.format(mix.easyPct)}<small>%</small></span>
      <span class="headline-text">czasu treningowego spokojnie</span>
    </p>

    <StackedBar
      {segments}
      ariaLabel="Rozkład czasu treningowego po intensywności"
      format={(v) => `${nf1.format(v)}%`}
      thickness="var(--space-4)"
    />

    <ul class="bands">
      {#each mix.bands as b (b.band)}
        <li class="band" style="--lane: {BAND_LANE[b.band]}">
          <span class="band-name">{BAND_LABEL[b.band]}</span>
          <span class="band-time">{fmtHours(b.seconds)}</span>
          <span class="band-meta">
            {nf.format(b.sessions)}
            {b.sessions === 1 ? 'jednostka' : 'jednostek'}{#if b.load > 0}
              · obciążenie {nf.format(b.load)}{/if}
          </span>
        </li>
      {/each}
    </ul>

    <p class="advice">{mix.advice}</p>

    {#if hasMinutes}
      <section class="minutes">
        <h4 class="minutes-title">Minuty intensywności</h4>
        <p class="hint">
          Cel WHO to 150 minut tygodniowo, licząc minuty intensywne podwójnie. Czas spokojny nie liczy się
          tutaj wcale — spacer jest zdrowy, ale nie jest aktywnością o umiarkowanej intensywności.
          {#if weeksOnTarget > 0}
            Cel osiągnięty w {nf.format(weeksOnTarget)} z {nf.format(weeks.length)} tygodni.
          {:else}
            Żaden tydzień w tym okresie nie osiągnął celu.
          {/if}
        </p>
        <BarChart
          values={weekMinutes}
          labels={weekLabels}
          color="var(--lane-amber)"
          height={200}
          unit="min"
          label="Minuty intensywności"
          baseline={WEEKLY_TARGET}
          formatValue={(v) => `${nf.format(v)} min`}
        />
      </section>
    {/if}

    <p class="note">
      Podział z tętna średniego wobec maksymalnego {nf.format(mix.maxHr ?? 0)} bpm: poniżej 80% spokojnie, do 87%
      średnio, wyżej mocno. Udziały liczymy z czasu, który dało się zaklasyfikować — jednostka bez pomiaru tętna
      nie jest wliczana jako spokojna.
      {#if mix.unclassifiedSessions > 0}
        Pominięto {nf.format(mix.unclassifiedSessions)}
        {mix.unclassifiedSessions === 1 ? 'jednostkę' : 'jednostek'} bez tętna.
      {/if}
      Pasmo bierze się ze ŚREDNIEJ, więc trening interwałowy wypada w środku niezależnie od tego, jak wyglądał jego
      rozkład stref.
    </p>
  {/if}
</Card>

<style>
  .headline {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    margin: 0 0 var(--space-4);
    flex-wrap: wrap;
  }

  .big {
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    color: var(--color-text);
    font-feature-settings: var(--numeric);
    letter-spacing: var(--tracking-tight);
  }

  .big small {
    margin-left: 0.15ch;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-muted);
  }

  .headline-text {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .bands {
    list-style: none;
    margin: var(--space-5) 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-3);
  }

  .band {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-left: var(--space-3);
    border-left: 3px solid var(--lane);
  }

  .band-name {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }

  .band-time {
    font-size: var(--text-base);
    font-weight: var(--font-bold);
    color: var(--color-text);
    font-feature-settings: var(--numeric);
  }

  .band-meta {
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    font-feature-settings: var(--numeric);
  }

  .minutes {
    margin-top: var(--space-6);
    padding-top: var(--space-5);
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .minutes-title {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
  }

  .hint {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    max-width: 78ch;
  }

  .advice {
    margin: var(--space-5) 0 0;
    font-size: var(--text-sm);
    line-height: var(--leading-snug);
    color: var(--color-text);
    max-width: 78ch;
  }

  .note {
    margin: var(--space-3) 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    max-width: 82ch;
  }
</style>
