<script lang="ts">
  /**
   * "Plan kontra wykonanie" (spec 085) — the plan's own section, not a footnote.
   *
   * Before this it was three lines under the training verdict, and the sentence it printed most
   * often was that the calendar entry had nothing to compare. Two things changed: the API now reads
   * the athlete's OWN authored workouts, which carry real targets, and the answer gets a card —
   * an explicit adherence figure, a row per target with the plan beside what was actually held, and
   * what to do differently next time.
   *
   * Everything here is display. The matching, the scoring and the guidance were all decided by
   * `activity-plan.ts` and arrived on the payload; this file only formats and translates them. It
   * renders NOTHING when no plan matched — the absence of a section is the statement.
   */
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import ProgressBar from '$lib/ui/ProgressBar.svelte';
  import Table from '$lib/ui/Table.svelte';
  import { getI18n } from '$lib/i18n';
  import { DASH, fmtDuration, fmtKm, fmtNum, fmtPace } from './activity-format';
  import type { PlannedStepComparison, PlannedStepKey, TrainingComparison } from './activity-detail.types';

  const i18n = getI18n();

  let { comparison }: { comparison: TrainingComparison | null } = $props();

  const plan = $derived(comparison?.plannedWorkout ?? null);
  const takeaways = $derived(comparison?.plannedTakeaways ?? []);

  /**
   * The percentage's own colour. Adherence is the point of the card, so it carries a tone; the rows
   * below already say which target caused it, and repeating that in four more colours would be noise.
   */
  const accent = $derived.by(() => {
    const pct = plan?.compliancePct ?? null;
    if (pct === null) return 'var(--color-text-muted)';
    if (pct >= 90) return 'var(--color-success)';
    if (pct >= 70) return 'var(--color-warning)';
    return 'var(--color-danger)';
  });

  /** One formatter per metric — the unit is part of what the number means. */
  function fmtValue(key: PlannedStepKey, value: number | null): string {
    if (value === null) return DASH;
    if (key === 'duration') return fmtDuration(value);
    if (key === 'distance') return `${fmtKm(value, 2)} km`;
    if (key === 'pace') return `${fmtPace(value)} min/km`;
    if (key === 'power') return `${fmtNum(value)} W`;
    if (key === 'hr') return `${fmtNum(value)} bpm`;
    return fmtNum(value);
  }

  /**
   * What the plan asked for. An intensity target is a BAND, and an open-ended one ("at least 250 W")
   * has to read as such rather than silently becoming its own midpoint.
   */
  function fmtTarget(step: PlannedStepComparison): string {
    const { targetLow: low, targetHigh: high } = step;
    if (low === null && high === null) return fmtValue(step.key, step.target);
    if (low !== null && high !== null) return `${fmtValue(step.key, low)} – ${fmtValue(step.key, high)}`;
    if (low !== null) return i18n.t('plan.rangeFrom', { value: fmtValue(step.key, low) });
    return i18n.t('plan.rangeTo', { value: fmtValue(step.key, high) });
  }

  function metTone(met: boolean | null): 'success' | 'warning' | 'neutral' {
    if (met === null) return 'neutral';
    return met ? 'success' : 'warning';
  }

  function metLabel(met: boolean | null): string {
    if (met === null) return i18n.t('plan.met.unknown');
    return met ? i18n.t('plan.met.yes') : i18n.t('plan.met.no');
  }

  const originLabel = $derived(
    plan === null
      ? ''
      : plan.origin === 'authored'
        ? i18n.t('plan.origin.authored')
        : i18n.t('plan.origin.garmin')
  );
</script>

{#if plan}
  <Card title={i18n.t('plan.title')} subtitle={i18n.t('plan.subtitle')}>
    <div class="head">
      <div class="identity">
        <Badge tone={plan.origin === 'authored' ? 'success' : 'info'} dot={false}>{originLabel}</Badge>
        {#if plan.kind !== 'workout'}
          <Badge tone="neutral" dot={false}>
            {plan.kind === 'race' ? i18n.t('plan.kind.race') : i18n.t('plan.kind.note')}
          </Badge>
        {/if}
        <strong class="name">{plan.name}</strong>
      </div>
      {#if plan.compliancePct !== null}
        <p class="score" style="--tone: {accent}">
          <span class="score-value">{plan.compliancePct}%</span>
          <span class="score-label">{i18n.t('plan.compliance')}</span>
        </p>
      {/if}
    </div>

    {#if plan.compliancePct !== null}
      <ProgressBar
        value={plan.compliancePct / 100}
        showPct={false}
        {accent}
        label={i18n.t('plan.complianceAriaLabel')}
      />
    {/if}

    {#if plan.description}
      <p class="desc">{plan.description}</p>
    {/if}

    {#if plan.steps.length > 0}
      <div class="targets">
        <Table caption={i18n.t('plan.tableCaption')}>
          {#snippet head()}
            <th scope="col">{i18n.t('plan.col.metric')}</th>
            <th scope="col">{i18n.t('plan.col.target')}</th>
            <th scope="col">{i18n.t('plan.col.actual')}</th>
            <th scope="col">{i18n.t('plan.col.met')}</th>
          {/snippet}
          {#each plan.steps as step (step.key)}
            <tr>
              <th scope="row">{i18n.t(`plan.step.${step.key}`)}</th>
              <td class="num">{fmtTarget(step)}</td>
              <td class="num strong">{fmtValue(step.key, step.actual)}</td>
              <td><Badge tone={metTone(step.met)}>{metLabel(step.met)}</Badge></td>
            </tr>
          {/each}
        </Table>
      </div>
    {:else}
      <p class="desc">{i18n.t('plan.noTargets')}</p>
    {/if}

    {#if takeaways.length > 0}
      <section class="takeaways">
        <h4 class="takeaways-title">{i18n.t('plan.takeawaysTitle')}</h4>
        <ul>
          {#each takeaways as takeaway (takeaway.key + takeaway.metric)}
            <li>
              {i18n.t(takeaway.key, {
                metric: i18n.t(`plan.step.${takeaway.metric}`),
                pct: takeaway.pct
              })}
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  </Card>
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
    margin-bottom: var(--space-4);
  }

  .identity {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
    flex-wrap: wrap;
  }

  .name {
    font-size: var(--text-md);
    font-weight: var(--font-bold);
    color: var(--color-text);
  }

  .score {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    margin: 0;
  }

  .score-value {
    font-size: var(--readout-xl);
    font-weight: var(--font-black);
    letter-spacing: var(--tracking-tighter);
    line-height: var(--leading-tight);
    color: var(--tone);
    font-feature-settings: var(--numeric);
  }

  .score-label {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .desc {
    margin: var(--space-4) 0 0;
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
    color: var(--color-text-muted);
    max-width: 72ch;
    white-space: pre-line;
  }

  .targets {
    margin-top: var(--space-4);
  }

  .num {
    font-feature-settings: var(--numeric);
    white-space: nowrap;
  }

  .strong {
    font-weight: var(--font-bold);
    color: var(--color-text);
  }

  .takeaways {
    margin-top: var(--space-5);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .takeaways-title {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
  }

  .takeaways ul {
    margin: 0;
    padding-left: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .takeaways li {
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
    color: var(--color-text-on-surface);
    max-width: 78ch;
  }
</style>
