<script lang="ts">
  /**
   * One goal, and everything the app can say about the road to it (spec 060).
   *
   * The order is deliberate: countdown first (the thing the athlete opened the page for), then the
   * verdict, then the numbers behind the verdict. A card whose numbers came first would bury the
   * one sentence that matters under four statistics.
   *
   * Presentational. Every `null` here is a real "we will not guess" from the handler — under the
   * history floor there is no CTL, past a race there is no trajectory — and each renders as an
   * honest absence rather than a zero.
   */
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import Button from '$lib/ui/Button.svelte';
  import ProgressBar from '$lib/ui/ProgressBar.svelte';
  import { formatDay } from '$lib/date';
  import type { GoalStatus, GoalStatusBand } from './season.types';
  import { formatNumber, getI18n, type MessageKey } from '$lib/i18n';

  const i18n = getI18n();

  let { status, onDelete }: { status: GoalStatus; onDelete?: ((id: string) => void) | undefined } = $props();

  /*
   * Key lookups only — the actual words come from `i18n.t` at the point of use, so a locale switch
   * (which re-renders in place rather than remounting the card) is reflected immediately instead of
   * being frozen at whatever the translator returned on mount.
   */
  const BAND_LABEL_KEY: Record<GoalStatusBand, MessageKey> = {
    'on-track': 'season.band.onTrack',
    ahead: 'season.band.ahead',
    behind: 'season.band.behind',
    'at-risk': 'season.band.atRisk',
    unknown: 'season.band.unknown'
  };

  const BAND_TONE: Record<GoalStatusBand, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
    'on-track': 'success',
    ahead: 'info',
    behind: 'warning',
    'at-risk': 'danger',
    unknown: 'neutral'
  };

  const PRIORITY_LABEL_KEY: Record<string, MessageKey> = {
    a: 'season.priorityLabel.a',
    b: 'season.priorityLabel.b',
    c: 'season.priorityLabel.c'
  };

  const nf1 = (n: number): string =>
    formatNumber(i18n.locale, n, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const signed = (v: number): string => `${v > 0 ? '+' : ''}${nf1(v)}`;

  /** `hh:mm:ss`, or `mm:ss` under an hour — the way a finish time is read aloud. */
  function hms(totalS: number): string {
    const s = Math.max(0, Math.round(totalS));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n: number): string => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
  }

  const km = (m: number): string => (m >= 1000 ? `${nf1(m / 1000)} km` : `${Math.round(m)} m`);

  const past = $derived(status.daysOut < 0);
  const daysLabel = $derived(
    past
      ? i18n.t('season.daysAgo', { count: Math.abs(status.daysOut) })
      : status.daysOut === 0
        ? i18n.t('season.today')
        : i18n.t('season.daysUntil', { count: status.daysOut })
  );

  /**
   * How much of the gap to the target is already closed, as a 0–1 fraction (`ProgressBar`'s scale).
   * Only drawn when there IS a target and a projection — a bar with nothing behind it would imply a
   * plan exists.
   */
  const progress = $derived.by(() => {
    const target = status.goal.targetCtl;
    if (target === null || status.ctl === null || status.projectedCtl === null) return null;
    if (status.ctl >= target) return 1;
    // Measured from wherever the trajectory starts, so a detraining ramp does not read as progress.
    const start = Math.min(status.ctl, status.projectedCtl);
    const span = target - start;
    if (span <= 0) return 1;
    return Math.max(0, Math.min(1, (status.ctl - start) / span));
  });

  const prediction = $derived(status.prediction);
  /** Riegel is the headline; critical speed only fills in when no best was close enough. */
  const predictedS = $derived(prediction?.riegelS ?? prediction?.criticalSpeedS ?? null);
</script>

<Card
  title={status.goal.title}
  subtitle="{status.sportLabel} · {formatDay(i18n.locale, status.goal.day, 'longYear')}"
>
  {#snippet actions()}
    <span class="badges">
      <Badge tone="neutral">
        {PRIORITY_LABEL_KEY[status.goal.priority]
          ? i18n.t(PRIORITY_LABEL_KEY[status.goal.priority]!)
          : i18n.t('season.priorityLabel.fallback')}
      </Badge>
      {#if !past}
        <Badge tone={BAND_TONE[status.status]}>{i18n.t(BAND_LABEL_KEY[status.status])}</Badge>
      {/if}
    </span>
  {/snippet}

  <div class="head" style="--lane: {status.color}">
    <p class="countdown">
      <span class="days">{daysLabel}</span>
      <span class="phase">{status.phaseLabel}</span>
    </p>
    {#if status.goal.distanceM !== null}
      <p class="distance">{km(status.goal.distanceM)}</p>
    {/if}
  </div>

  <p class="verdict">{status.note}</p>

  {#if !past}
    {#if status.ctl !== null}
      <div class="numbers">
        <div class="item">
          <span class="label">{i18n.t('season.stat.formToday')}</span>
          <p class="value">{nf1(status.ctl)}<span class="unit">CTL</span></p>
        </div>
        {#if status.goal.targetCtl !== null}
          <div class="item">
            <span class="label">{i18n.t('season.stat.targetAtTaper')}</span>
            <p class="value">{nf1(status.goal.targetCtl)}<span class="unit">CTL</span></p>
          </div>
        {/if}
        {#if status.projectedCtl !== null}
          <div class="item">
            <span class="label">{i18n.t('season.stat.reaching')}</span>
            <p class="value">{nf1(status.projectedCtl)}<span class="unit">CTL</span></p>
            <p class="hint">{i18n.t('season.stat.reachingHint')}</p>
          </div>
        {/if}
        {#if status.rampPerWeek !== null}
          <div class="item">
            <span class="label">{i18n.t('season.stat.paceNow')}</span>
            <p class="value">
              {signed(status.rampPerWeek)}<span class="unit">{i18n.t('season.stat.ctlPerWeekUnit')}</span>
            </p>
            {#if status.requiredRampPerWeek !== null}
              <p class="hint">
                {i18n.t('season.stat.needed', { value: signed(status.requiredRampPerWeek) })}
              </p>
            {/if}
          </div>
        {/if}
      </div>

      {#if progress !== null}
        <ProgressBar value={progress} label={i18n.t('season.progressLabel')} accent={status.color} />
      {/if}
    {/if}

    {#if status.taper}
      <div class="taper">
        <span class="label">{i18n.t('season.taperLabel')}</span>
        <p class="hint">
          {i18n.t('season.taperHint', {
            recent: nf1(status.taper.recentDailyLoad),
            baseline: nf1(status.taper.baselineDailyLoad)
          })}
        </p>
      </div>
    {/if}

    {#if prediction && predictedS !== null}
      <div class="prediction">
        <span class="label">{i18n.t('season.predictionLabel')}</span>
        <p class="value">{hms(predictedS)}</p>
        <p class="hint">
          {#if prediction.fromLabel}
            {i18n.t('season.predictionFrom', { label: prediction.fromLabel })}{#if prediction.fromDay}
              &nbsp;({formatDay(i18n.locale, prediction.fromDay, 'short')}){/if}.
          {/if}
          {#if !prediction.confident}
            {i18n.t('season.predictionUnconfident')}
          {/if}
          {#if prediction.criticalSpeedS !== null && prediction.riegelS !== null}
            {i18n.t('season.predictionCriticalSpeed', { time: hms(prediction.criticalSpeedS) })}
          {/if}
        </p>
        {#if status.goal.targetTimeS !== null && prediction.gapS !== null}
          <p class="gap" class:ahead={prediction.gapS > 0}>
            {i18n.t('season.gapTarget', { time: hms(status.goal.targetTimeS) })}
            {prediction.gapS > 0
              ? i18n.t('season.gapAhead', { time: hms(prediction.gapS) })
              : i18n.t('season.gapBehind', { time: hms(-prediction.gapS) })}
          </p>
        {/if}
      </div>
    {/if}
  {/if}

  {#if status.goal.note}
    <p class="own-note">{status.goal.note}</p>
  {/if}

  {#if onDelete}
    <div class="foot">
      {#if status.goal.source === 'garmin'}
        <span class="hint">{i18n.t('season.importedFromGarmin')}</span>
      {/if}
      <Button variant="ghost" onclick={() => onDelete(status.goal.id)}>{i18n.t('season.deleteGoal')}</Button>
    </div>
  {/if}
</Card>

<style>
  .badges {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
    padding-left: var(--space-3);
    border-left: 3px solid var(--lane);
  }

  .countdown {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .days {
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
  }

  .phase {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .distance {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .verdict {
    margin-top: var(--space-4);
    color: var(--color-text);
    line-height: var(--leading-normal);
  }

  .numbers {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-5);
    margin-top: var(--space-5);
  }

  .item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .label {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }

  .value {
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    font-variant-numeric: tabular-nums;
    color: var(--color-text);
  }

  .unit {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    margin-left: var(--space-1);
  }

  .hint {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
  }

  .taper,
  .prediction {
    margin-top: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .gap {
    font-size: var(--text-sm);
    color: var(--color-danger);
    font-variant-numeric: tabular-nums;
  }

  .gap.ahead {
    color: var(--color-success);
  }

  .own-note {
    margin-top: var(--space-4);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    font-style: italic;
  }

  .foot {
    margin-top: var(--space-5);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }
</style>
