<script lang="ts" module>
  import type { ReadinessBand } from './insights.types';
  import type { MessageKey } from '$lib/i18n';

  export const BAND_TONE: Record<ReadinessBand, 'danger' | 'warning' | 'info' | 'success'> = {
    low: 'danger',
    moderate: 'warning',
    high: 'info',
    peak: 'success'
  };

  export const BAND_LABEL: Record<ReadinessBand, MessageKey> = {
    low: 'readiness.band.low',
    moderate: 'readiness.band.moderate',
    high: 'readiness.band.high',
    peak: 'readiness.band.peak'
  };
</script>

<script lang="ts">
  /**
   * The readiness readout on its own: score, band, the six channels, what is capping them, and when
   * the cap lifts (specs 022, 084).
   *
   * Rewritten by spec 084. The chips used to carry a z-score arrow — "HRV ↑" meaning *above your own
   * 30-day mean* — which is what let this gauge read 52 on a morning the athlete was HRV-unbalanced
   * with 21 hours on the recovery clock: last night really was above his recent average, and his recent
   * average had drifted below his balanced range. The chips now carry the channel's own absolute
   * percent, and the reason the number is what it is sits underneath rather than being left to the
   * reader's arithmetic.
   */
  import { Badge } from '$lib/ui';
  import { getI18n } from '$lib/i18n';
  import { fmtRecovery, fmtRecoveryEnd } from './condition.format';
  import { formatDay, isDayKey } from '$lib/date';
  import type { Readiness, ReadinessLimit } from './insights.types';

  const i18n = getI18n();

  interface Props {
    readiness: Readiness;
    /** `lg` is the start-page hero size; `md` suits a card among equals. */
    size?: 'md' | 'lg';
    /** Garmin's own score, shown as a reference rather than a rival (spec 084). */
    garminScore?: number | null;
    /** "Now" (epoch ms) for the recovery instant; omitted, absolute times are not written. */
    now?: number | null;
  }

  let { readiness, size = 'md', garminScore = null, now = null }: Props = $props();

  /** What lowered the NUMBER (the sentence) vs everything standing between here and 100% (the list). */
  const capped = $derived(readiness.limitedBy);
  const forecast = $derived(readiness.forecast);
  const limits = $derived(forecast.limits);

  /** At least one channel we computed ourselves — the card owes the reader that disclosure. */
  const anyDerived = $derived(readiness.drivers.some((d) => d.source === 'derived'));

  /**
   * When each limit lifts. The recovery timer gets an absolute clock time because it is derived from
   * Garmin's own capture instant (spec 075); a projection only ever names a day, because pretending to
   * know the hour would dress an assumption up as a measurement.
   */
  function clearance(limit: ReadinessLimit): string | null {
    if (limit.confidence === 'unknown') return i18n.t('readiness.clearsUnknown');
    if (limit.clearsAt !== null) {
      const at = fmtRecoveryEnd(i18n.t, limit.clearsAt, now);
      return at === null ? null : i18n.t('readiness.clearsAt', { when: at });
    }
    if (limit.clearsOn !== null && isDayKey(limit.clearsOn)) {
      return i18n.t('readiness.clearsOn', { day: formatDay(i18n.t.locale, limit.clearsOn) });
    }
    return null;
  }

  /** The one line that answers "kiedy będę na 100%", or the honest refusal. */
  const fullyReady = $derived.by(() => {
    const day = forecast.fullyReadyAt;
    if (day === null) return i18n.t('readiness.fullyReadyUnknown');
    if (limits.length === 0) return i18n.t('readiness.fullyReadyToday');
    return i18n.t('readiness.fullyReadyOn', { day: formatDay(i18n.t.locale, day) });
  });

  /** Why the number is below its channels, when it is. */
  const limitSentence = $derived.by(() => {
    if (capped.length === 0) return null;
    const names = capped.map((l) => i18n.t(l.labelKey));
    const args = { composite: String(readiness.composite), score: String(readiness.score) };
    return capped.length === 1
      ? i18n.t('readiness.limitedBy', { ...args, limit: names[0]! })
      : i18n.t('readiness.limitedByMany', { ...args, limits: names.join(i18n.t('readiness.limitJoin')) });
  });
</script>

<div class="gauge" class:lg={size === 'lg'}>
  <div class="score-block">
    <span class="score">{readiness.score}</span>
    <div class="band">
      <Badge tone={BAND_TONE[readiness.band]}>{i18n.t(BAND_LABEL[readiness.band])}</Badge>
      {#if garminScore !== null}
        <span class="reference">{i18n.t('readiness.garminReference', { score: String(garminScore) })}</span>
      {/if}
    </div>
  </div>

  <p class="forecast">{fullyReady}</p>

  <ul class="channels" aria-label={i18n.t('readiness.channelsAriaLabel')}>
    {#each readiness.drivers as d (d.key)}
      <li class="chip" style="--m: var(--lane-{d.accent})" class:derived={d.source === 'derived'}>
        <span class="marker" aria-hidden="true"></span>
        <span class="chip-label">{i18n.t(d.labelKey)}</span>
        <span class="chip-percent">{d.percent}%</span>
        {#if d.detail}<span class="chip-detail">{d.detail}</span>{/if}
      </li>
    {/each}
  </ul>

  {#if limitSentence}
    <p class="limit">{limitSentence}</p>
  {/if}

  {#if limits.length > 0}
    <ul class="limits" aria-label={i18n.t('readiness.limitsAriaLabel')}>
      {#each limits as l (l.key)}
        <li>
          <span class="limit-name">{i18n.t(l.labelKey)}</span>
          <span class="limit-cap">{l.ceiling}</span>
          {#if l.minutes !== undefined}<span class="limit-meta">{fmtRecovery(l.minutes)}</span>{/if}
          {#if clearance(l)}<span class="limit-when">{clearance(l)}</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if anyDerived}
    <p class="derived-note">{i18n.t('readiness.derivedNote')}</p>
  {/if}
</div>

<style>
  .gauge {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  .score-block {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .score {
    font-size: var(--readout-2xl);
    font-weight: var(--font-black);
    line-height: 1;
    letter-spacing: var(--tracking-tight);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
  }

  .lg .score {
    /* The start page's opening number: the one readout that carries the whole answer. */
    font-size: var(--readout-2xl);
    letter-spacing: var(--tracking-tighter);
  }

  .band {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .reference {
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    letter-spacing: var(--tracking-wide);
    font-feature-settings: var(--numeric);
  }

  .forecast {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text);
    line-height: var(--leading-normal);
  }

  .channels {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--color-text-on-surface);
  }

  /* A channel we computed ourselves is a weaker claim, and reads as one. */
  .chip.derived {
    border-style: dashed;
  }

  .marker {
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--m);
    flex-shrink: 0;
  }

  .chip-label {
    color: var(--color-text-muted);
  }

  .chip-percent {
    font-feature-settings: var(--numeric);
    color: var(--color-text);
  }

  .chip-detail {
    font-weight: var(--font-normal);
    color: var(--color-text-subtle);
    font-feature-settings: var(--numeric);
  }

  .limit {
    margin: 0;
    font-size: var(--text-xs);
    line-height: var(--leading-normal);
    color: var(--color-text-muted);
    max-width: 62ch;
  }

  .limits {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .limits li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-2);
    font-size: var(--text-xs);
  }

  .limit-name {
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }

  .limit-cap {
    font-feature-settings: var(--numeric);
    color: var(--color-text-muted);
  }

  .limit-meta,
  .limit-when {
    color: var(--color-text-subtle);
    font-feature-settings: var(--numeric);
  }

  .derived-note {
    margin: 0;
    font-size: var(--text-xs);
    line-height: var(--leading-normal);
    color: var(--color-text-subtle);
    max-width: 62ch;
  }
</style>
