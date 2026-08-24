<script lang="ts" module>
  import type { GarminReadinessLevel } from './insights.types';
  import type { MessageKey } from '$lib/i18n';

  export const GARMIN_LEVEL_TONE: Record<
    GarminReadinessLevel,
    'danger' | 'warning' | 'info' | 'success' | 'neutral'
  > = {
    prime: 'success',
    high: 'info',
    moderate: 'warning',
    low: 'danger',
    poor: 'danger',
    unknown: 'neutral'
  };

  /**
   * Keys, not words — and NO `getI18n()` in this block: a `<script module>` runs at IMPORT time, so a
   * context read here happens outside component initialisation and throws (spec 076).
   */
  export const GARMIN_LEVEL_LABEL: Record<GarminReadinessLevel, MessageKey> = {
    prime: 'garminReadiness.level.prime',
    high: 'garminReadiness.level.high',
    moderate: 'garminReadiness.level.moderate',
    low: 'garminReadiness.level.low',
    poor: 'garminReadiness.level.poor',
    unknown: 'garminReadiness.level.unknown'
  };
</script>

<script lang="ts">
  /**
   * Garmin's own Training Readiness, on the same instrument face as ours (spec 059).
   *
   * A sibling of `ReadinessGauge`, not a variant of it: the two carry different quantities. Ours
   * reports per-driver *contributions* that sum to the score; Garmin reports per-factor
   * *percentages* that do not. Folding both into one component would mean a chip whose number means
   * one thing on Monday and another on Tuesday — so the shape is shared and the semantics are not.
   */
  import { Badge } from '$lib/ui';
  import { getI18n } from '$lib/i18n';
  import { formatDay, isDayKey } from '$lib/date';
  import type { GarminReadiness } from './insights.types';

  const i18n = getI18n();

  interface Props {
    readiness: GarminReadiness;
    size?: 'md' | 'lg';
  }

  let { readiness, size = 'md' }: Props = $props();

  /*
   * A score Garmin has not refreshed since `day` is still Garmin's score — but it is not an answer
   * to "how am I right now", which is the question this instrument face implies (spec 072). So the
   * number stays, and the day it belongs to stops being invisible.
   */
  const stale = $derived(readiness.staleDays > 0 && isDayKey(readiness.day));
</script>

<div class="gauge" class:lg={size === 'lg'}>
  <div class="score-block">
    <span class="score">{readiness.score}</span>
    <div class="band">
      <div class="tags">
        <Badge tone={GARMIN_LEVEL_TONE[readiness.level]}>{i18n.t(GARMIN_LEVEL_LABEL[readiness.level])}</Badge>
        {#if stale}
          <Badge tone="warning"
            >{i18n.t('garminReadiness.asOf', { day: formatDay(i18n.locale, readiness.day) })}</Badge
          >
        {/if}
      </div>
      <span class="basis">{i18n.t('garminReadiness.basis')}</span>
    </div>
  </div>

  {#if readiness.factors.length > 0}
    <ul class="factors" aria-label={i18n.t('garminReadiness.factorsAriaLabel')}>
      {#each readiness.factors as f (f.key)}
        <li class="chip" style="--m: var(--lane-{f.accent})">
          <span class="marker" aria-hidden="true"></span>
          <span class="chip-label">{i18n.t(f.labelKey)}</span>
          <span class="chip-value">{f.percent}%</span>
        </li>
      {/each}
    </ul>
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
    letter-spacing: var(--tracking-tighter);
  }

  .band {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  .basis {
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    letter-spacing: var(--tracking-wide);
    font-feature-settings: var(--numeric);
  }

  .factors {
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

  .chip-value {
    font-feature-settings: var(--numeric);
    color: var(--color-text);
  }
</style>
