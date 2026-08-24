<script lang="ts">
  /**
   * "How good was this session?" at the top of the page (spec 026, user request 5.3).
   *
   * Two answers stacked: **against the plan** (when Garmin's synced calendar has a workout for that
   * day and sport) and **against the athlete's own recent training** — the session's stress vs the
   * median comparable session of the last six weeks, and vs the fitness and form it met. When no
   * plan can be matched the block says which reason applies rather than inventing an adherence score.
   */
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import { bandLabel, verdictLabel, type ActivityVerdict } from './activity-comparison.format';
  import { DASH, fmtDuration, fmtKm, fmtNum, fmtSigned } from './activity-format';
  import type { PlannedStepComparison, PowerBlock, TrainingComparison } from './activity-detail.types';

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

  const METHODS: Record<string, string> = {
    garmin: 'obciążenie z Garmina',
    power: 'z mocy (TSS)',
    hr: 'oszacowane z tętna',
    none: 'brak źródła'
  };

  const c = $derived(comparison);
  const headline = $derived(
    c === null || c.vsRecentPct === null ? null : `${c.vsRecentPct > 0 ? '+' : ''}${c.vsRecentPct}%`
  );

  const PLANNED_EMPTY: Record<string, string> = {
    'none-scheduled':
      'Na ten dzień nie było w kalendarzu zaplanowanego treningu w tej dyscyplinie — ta sesja była poza planem.',
    'not-synced':
      'Nie mamy zsynchronizowanego kalendarza treningowego w okolicy tej daty, więc nie wiemy, czy sesja realizowała jakiś plan.'
  };

  /** Plan targets and what was actually done share a formatter per metric. */
  function stepValue(step: PlannedStepComparison, value: number | null): string {
    if (value === null) return DASH;
    if (step.key === 'duration') return fmtDuration(value);
    if (step.key === 'distance') return `${fmtKm(value, 2)} km`;
    return fmtNum(value);
  }
</script>

<Card
  title="Ocena treningu"
  subtitle="Wobec planu z kalendarza i Twoich własnych sesji z ostatnich 6 tygodni"
>
  {#if c === null}
    <p class="empty">Brak danych do oceny tego treningu.</p>
  {:else}
    <div class="verdict">
      <div class="lead">
        <Badge tone={TONES[c.verdict]}>{verdictLabel(c.verdict)}</Badge>
        {#if headline}
          <p class="headline" class:down={(c.vsRecentPct ?? 0) < 0}>
            {headline}<span class="headline-label">wzgl. normy</span>
          </p>
        {/if}
        <p class="summary">{c.summary}</p>
      </div>

      <dl class="metrics">
        <div class="metric">
          <dt>Obciążenie</dt>
          <dd>{c.load === null ? DASH : fmtNum(c.load)}</dd>
          <p class="foot">{METHODS[c.loadMethod] ?? METHODS.none}</p>
        </div>
        <div class="metric">
          <dt>Norma 6 tyg.</dt>
          <dd>{c.recentMedianLoad === null ? DASH : fmtNum(c.recentMedianLoad)}</dd>
          <p class="foot">{c.recentCount} porównywalnych</p>
        </div>
        <div class="metric">
          <dt>Forma przed</dt>
          <dd>{c.tsbBefore === null ? DASH : fmtSigned(c.tsbBefore)}</dd>
          <p class="foot">{c.bandBefore === null ? 'brak historii' : bandLabel(c.bandBefore)}</p>
        </div>
        <div class="metric">
          <dt>Kondycja (CTL)</dt>
          <dd>{c.ctlBefore === null ? DASH : fmtNum(c.ctlBefore)}</dd>
          <p class="foot">
            {c.loadRatio === null ? 'w przeddzień' : `sesja = ${fmtNum(c.loadRatio, 2)}× CTL`}
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
          <span class="s-label">Praca</span>
        </div>
        <p class="ftp">
          {#if ftp !== null}
            FTP {ftp} W{ftpEstimated ? ' (szacowane z krzywej mocy)' : ''}
          {:else}
            Ustaw FTP w ustawieniach, aby zobaczyć IF i TSS.
          {/if}
        </p>
      </div>
    {/if}

    {#if c.plannedWorkout}
      {@const plan = c.plannedWorkout}
      <section class="plan">
        <header class="plan-head">
          <div class="plan-title">
            <Badge tone="info" dot={false}>{plan.kind === 'race' ? 'Start' : 'Plan'}</Badge>
            <strong>{plan.name}</strong>
          </div>
          {#if plan.compliancePct !== null}
            <span class="plan-score">
              <span class="plan-score-value">{plan.compliancePct}%</span>
              <span class="plan-score-label">zgodności z planem</span>
            </span>
          {/if}
        </header>
        {#if plan.description}<p class="plan-desc">{plan.description}</p>{/if}
        {#if plan.steps.length > 0}
          <ul class="plan-steps">
            {#each plan.steps as step (step.key)}
              <li class:met={step.met === true} class:missed={step.met === false}>
                <span class="step-label">{step.label}</span>
                <span class="step-values">
                  <span class="step-actual">{stepValue(step, step.actual)}</span>
                  <span class="step-sep">z</span>
                  <span class="step-target">{stepValue(step, step.target)}</span>
                </span>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="plan-desc">Ten wpis w kalendarzu nie ma mierzalnych celów do porównania.</p>
        {/if}
      </section>
    {:else}
      <p class="planned">
        <strong>Zaplanowany trening</strong> — {PLANNED_EMPTY[c.plannedWorkoutStatus] ??
          PLANNED_EMPTY['not-synced']}
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

  .plan {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-top: var(--space-5);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .plan-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .plan-title {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .plan-title strong {
    font-size: var(--text-md);
    font-weight: var(--font-bold);
    color: var(--color-text);
  }

  .plan-score {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .plan-score-value {
    font-size: var(--readout-sm);
    font-weight: var(--font-black);
    color: var(--color-text);
    font-feature-settings: var(--numeric);
  }

  .plan-score-label {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .plan-desc {
    margin: 0;
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
    color: var(--color-text-muted);
    max-width: 72ch;
  }

  .plan-steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-3);
  }

  .plan-steps li {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding-left: var(--space-3);
    border-left: 1px solid var(--color-border);
  }

  /* Hit or missed is carried by the value's colour, not by a heavy rail. */
  .plan-steps li.met {
    border-left-color: var(--color-success);
  }

  .plan-steps li.missed {
    border-left-color: var(--color-warning);
  }

  .step-label {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }

  .step-values {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    font-feature-settings: var(--numeric);
  }

  .step-actual {
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    color: var(--color-text);
  }

  .met .step-actual {
    color: var(--color-success);
  }

  .missed .step-actual {
    color: var(--color-warning);
  }

  .step-sep,
  .step-target {
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
