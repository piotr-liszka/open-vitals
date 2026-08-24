<script lang="ts">
  /**
   * "How good was this session?" at the top of the page (spec 026, user request 5.3).
   *
   * The session's stress against the athlete's own recent training — vs the median comparable
   * session of the last six weeks, and vs the fitness and form it met.
   *
   * Spec 085 took the PLAN out of here. It had been a footnote in this card's footer; it is now
   * `PlannedVsActual`, its own section directly below. What remains is the note saying whether we
   * hold any calendar around this date at all, because that is a statement about how much this
   * verdict can be trusted, not about a plan.
   */
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import { getI18n, type MessageKey } from '$lib/i18n';
  import { bandLabel, verdictLabel, type ActivityVerdict } from './activity-comparison.format';
  import { DASH, fmtNum, fmtSigned } from './activity-format';
  import type { PowerBlock, TrainingComparison } from './activity-detail.types';

  const i18n = getI18n();

  interface Props {
    comparison: TrainingComparison | null;
    power: PowerBlock | null;
    ftp: number | null;
    ftpEstimated: boolean;
  }

  let { comparison, power, ftp, ftpEstimated }: Props = $props();

  type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  const TONES: Record<ActivityVerdict, Tone> = {
    easy: 'info',
    steady: 'neutral',
    hard: 'warning',
    peak: 'danger',
    unknown: 'neutral'
  };

  const METHOD_KEYS: Record<string, MessageKey> = {
    garmin: 'verdict.method.garmin',
    power: 'verdict.method.power',
    hr: 'verdict.method.hr',
    none: 'verdict.method.none'
  };

  const c = $derived(comparison);
  const headline = $derived(
    c === null || c.vsRecentPct === null ? null : `${c.vsRecentPct > 0 ? '+' : ''}${c.vsRecentPct}%`
  );

  const PLANNED_EMPTY_KEYS: Record<string, MessageKey> = {
    'none-scheduled': 'verdict.plannedNoneScheduled',
    'not-synced': 'verdict.plannedNotSynced'
  };
</script>

<Card title={i18n.t('verdict.title')} subtitle={i18n.t('verdict.subtitle')}>
  {#if c === null}
    <p class="empty">{i18n.t('verdict.empty')}</p>
  {:else}
    <div class="verdict">
      <div class="lead">
        <Badge tone={TONES[c.verdict]}>{verdictLabel(i18n.t, c.verdict)}</Badge>
        {#if headline}
          <p class="headline" class:down={(c.vsRecentPct ?? 0) < 0}>
            {headline}<span class="headline-label">{i18n.t('verdict.vsNorm')}</span>
          </p>
        {/if}
        <p class="summary">{c.summary}</p>
      </div>

      <dl class="metrics">
        <div class="metric">
          <dt>{i18n.t('verdict.load')}</dt>
          <dd>{c.load === null ? DASH : fmtNum(c.load, 0, i18n.locale)}</dd>
          <p class="foot">{i18n.t(METHOD_KEYS[c.loadMethod] ?? 'verdict.method.none')}</p>
        </div>
        <div class="metric">
          <dt>{i18n.t('verdict.recentNorm')}</dt>
          <dd>{c.recentMedianLoad === null ? DASH : fmtNum(c.recentMedianLoad, 0, i18n.locale)}</dd>
          <p class="foot">{i18n.t('verdict.recentComparable', { count: c.recentCount })}</p>
        </div>
        <div class="metric">
          <dt>{i18n.t('verdict.formBefore')}</dt>
          <dd>{c.tsbBefore === null ? DASH : fmtSigned(c.tsbBefore, 0, i18n.locale)}</dd>
          <p class="foot">
            {c.bandBefore === null ? i18n.t('verdict.noHistory') : bandLabel(i18n.t, c.bandBefore)}
          </p>
        </div>
        <div class="metric">
          <dt>{i18n.t('verdict.fitness')}</dt>
          <dd>{c.ctlBefore === null ? DASH : fmtNum(c.ctlBefore, 0, i18n.locale)}</dd>
          <p class="foot">
            {c.loadRatio === null
              ? i18n.t('verdict.dayBefore')
              : i18n.t('verdict.loadRatio', { ratio: fmtNum(c.loadRatio, 2, i18n.locale) })}
          </p>
        </div>
      </dl>
    </div>

    {#if power}
      <div class="stimulus">
        <div class="s-item">
          <span class="s-value">{power.if ?? DASH}</span>
          <span class="s-label">IF</span>
        </div>
        <div class="s-item">
          <span class="s-value">{power.tss ?? DASH}</span>
          <span class="s-label">TSS</span>
        </div>
        <div class="s-item">
          <span class="s-value">{power.np ?? DASH}<small>W</small></span>
          <span class="s-label">NP</span>
        </div>
        <div class="s-item">
          <span class="s-value">{power.kj ?? DASH}<small>kJ</small></span>
          <span class="s-label">{i18n.t('verdict.work')}</span>
        </div>
        <p class="ftp">
          {#if ftp !== null}
            {i18n.t('verdict.ftpLine', {
              ftp,
              estimated: ftpEstimated ? i18n.t('verdict.ftpEstimatedSuffix') : ''
            })}
          {:else}
            {i18n.t('verdict.ftpMissing')}
          {/if}
        </p>
      </div>
    {/if}

    <!-- The plan itself moved to its own section (spec 085): `PlannedVsActual` renders directly
         after this card. What stays here is the statement about the VERDICT's confidence — whether
         we can even see the calendar around this date — which is not a statement about a plan. -->
    {#if c.plannedWorkout === null}
      <p class="planned">
        <strong>{i18n.t('verdict.plannedLabel')}</strong> — {i18n.t(
          PLANNED_EMPTY_KEYS[c.plannedWorkoutStatus] ?? 'verdict.plannedNotSynced'
        )}
      </p>
    {/if}
  {/if}
</Card>

<style>
  .empty {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .verdict {
    display: grid;
    grid-template-columns: minmax(240px, 1fr) minmax(280px, 1.1fr);
    gap: var(--space-6);
    align-items: start;
  }

  .lead {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    min-width: 0;
  }

  .headline {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    margin: 0;
    font-size: var(--readout-xl);
    font-weight: var(--font-black);
    letter-spacing: var(--tracking-tighter);
    line-height: var(--leading-tight);
    color: var(--color-accent);
    font-feature-settings: var(--numeric);
  }

  .headline.down {
    color: var(--color-info);
  }

  .headline-label {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .summary {
    margin: 0;
    font-size: var(--text-base);
    line-height: var(--leading-normal);
    color: var(--color-text-on-surface);
    max-width: 46ch;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: var(--space-4);
    margin: 0;
  }

  .metric {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .metric dt {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }

  .metric dd {
    margin: 0;
    font-size: var(--readout-sm);
    font-weight: var(--font-black);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
    font-feature-settings: var(--numeric);
  }

  .foot {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
  }

  .stimulus {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-6);
    margin-top: var(--space-5);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .s-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .s-value {
    font-size: var(--readout-sm);
    font-weight: var(--font-black);
    color: var(--color-text);
    font-feature-settings: var(--numeric);
  }

  .s-value small {
    margin-left: 2px;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--color-text-muted);
  }

  .s-label {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }

  .ftp {
    margin: 0 0 0 auto;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .planned {
    margin: var(--space-5) 0 0;
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
    font-size: var(--text-xs);
    line-height: var(--leading-normal);
    color: var(--color-text-muted);
    max-width: 78ch;
  }

  .planned strong {
    color: var(--color-text-on-surface);
    font-weight: var(--font-semibold);
  }

  @media (max-width: 860px) {
    .verdict {
      grid-template-columns: 1fr;
    }
  }
</style>
