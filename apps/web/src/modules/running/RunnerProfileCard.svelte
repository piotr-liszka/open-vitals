<script lang="ts">
  /**
   * "Jakim biegaczem jesteś" (spec 033) — the running counterpart to the cycling rider-type
   * pentagon: five spokes, one glance, plus the archetype they add up to and the axis readouts behind
   * them.
   *
   * Presentational. Every number arrives normalised and pre-formatted from
   * `lib/server/analytics/runner-profile`; the card draws the shared `RadarChart` and the readouts,
   * and does no maths of its own.
   *
   * The two honest notes are part of the design, not fine print:
   *  · an axis with no data is drawn dashed and says "brak danych" — it is not a zero,
   *  · the pace axes come from all-time bests while objętość/regularność come from a trailing window,
   *    so the card labels both instead of implying one time base.
   */
  import Badge from '$lib/ui/Badge.svelte';
  import Card from '$lib/ui/Card.svelte';
  import InfoPopover from '$lib/ui/InfoPopover.svelte';
  import RadarChart from '$lib/ui/RadarChart.svelte';
  import type { RadarAxis } from '$lib/ui/RadarChart.svelte';
  import { getI18n } from '$lib/i18n';
  import type { RunnerAxisKey, RunnerProfile } from './running.types';

  const i18n = getI18n();

  let { profile }: { profile: RunnerProfile } = $props();

  const radarAxes = $derived<RadarAxis[]>(
    profile.axes.map((a) => ({ key: a.key, label: a.label, value: a.score }))
  );

  const labelOf = (key: RunnerAxisKey | null): string =>
    key === null ? '' : (profile.axes.find((a) => a.key === key)?.label ?? '');

  const asScore = (score: number | null): string => (score === null ? '—' : String(Math.round(score * 100)));

  /** Reads as a clause, so the sentence stays grammatical in the no-history case too. */
  const windowNote = $derived(
    profile.window.weeks > 0
      ? i18n.t('running.profile.windowWeeks', { weeks: profile.window.weeks })
      : i18n.t('running.profile.windowPending')
  );
</script>

<Card title={i18n.t('running.profile.title')} overflowVisible>
  {#snippet actions()}
    <InfoPopover
      label={i18n.t('running.profile.explainLabel')}
      title={i18n.t('running.profile.explainTitle')}
      align="end"
    >
      <p>{i18n.t('running.profile.explainBody')}</p>
    </InfoPopover>
  {/snippet}
  <div class="profile">
    <div class="plot">
      <RadarChart
        axes={radarAxes}
        ariaLabel={i18n.t('running.profile.radarAriaLabel')}
        color="var(--lane-orange)"
      />
    </div>

    <div class="read">
      <div class="verdict">
        <span class="kicker">{i18n.t('running.profile.yourType')}</span>
        <h4 class="type">{profile.archetype.label}</h4>
        <p class="summary">{profile.archetype.summary}</p>
        {#if profile.strength || profile.weakness}
          <div class="marks">
            {#if profile.strength}
              <Badge tone="success"
                >{i18n.t('running.profile.strengthLabel')} {labelOf(profile.strength)}</Badge
              >
            {/if}
            {#if profile.weakness}
              <Badge tone="neutral"
                >{i18n.t('running.profile.weaknessLabel')} {labelOf(profile.weakness)}</Badge
              >
            {/if}
          </div>
        {/if}
      </div>

      <dl class="axes">
        {#each profile.axes as axis (axis.key)}
          <div class="axis" class:missing={axis.score === null}>
            <dt>
              <span class="name">{axis.label}</span>
              <span class="basis">{axis.basis}</span>
            </dt>
            <dd>
              <span class="readout">{axis.readout ?? i18n.t('running.profile.noData')}</span>
              <span class="score">{asScore(axis.score)}<span class="of">/100</span></span>
            </dd>
          </div>
        {/each}
      </dl>
    </div>
  </div>

  <p class="scale">
    {i18n.t('running.profile.scale', { window: windowNote })}
  </p>
</Card>

<style>
  .profile {
    display: grid;
    grid-template-columns: minmax(0, 22rem) minmax(0, 1fr);
    gap: var(--space-6);
    align-items: start;
  }

  @media (max-width: 60rem) {
    .profile {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .plot {
    min-width: 0;
  }

  .read {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    min-width: 0;
  }

  .verdict {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .kicker {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-subtle);
  }

  .type {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
  }

  .summary {
    margin: 0;
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
    color: var(--color-text-muted);
    max-width: 60ch;
  }

  .marks {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }

  .axes {
    display: flex;
    flex-direction: column;
    margin: 0;
  }

  .axis {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-2) 0;
    border-top: 1px solid var(--color-border);
  }

  .axis dt {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .name {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }

  .basis {
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
  }

  .axis dd {
    display: flex;
    align-items: baseline;
    gap: var(--space-4);
    margin: 0;
    white-space: nowrap;
  }

  .readout {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
  }

  .score {
    font-size: var(--text-sm);
    font-weight: var(--font-bold);
    font-feature-settings: var(--numeric);
    color: var(--lane-orange);
    min-width: 4.5ch;
    text-align: right;
  }

  .of {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text-subtle);
  }

  /* An axis without data is stated, not hidden — and never styled like a low score. */
  .axis.missing .readout,
  .axis.missing .score {
    color: var(--color-text-subtle);
    font-weight: var(--font-medium);
  }

  .scale {
    margin: var(--space-5) 0 0;
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
    font-size: var(--text-xs);
    line-height: var(--leading-normal);
    color: var(--color-text-subtle);
    max-width: 92ch;
  }
</style>
