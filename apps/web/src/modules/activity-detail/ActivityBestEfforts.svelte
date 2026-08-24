<script lang="ts">
  /**
   * Best efforts inside this session (spec 040) — the 5 km hidden in a 15 km long run.
   *
   * Presentational; the handler found the windows. Two things are deliberately on the page rather than
   * only in the engine's doc comment, because both change how a reader should treat the numbers:
   * the effort's window covers *at least* the target (so the covered distance is shown next to it), and
   * the numbers inherit the watch's sample interval.
   */
  import Card from '$lib/ui/Card.svelte';
  import InfoPopover from '$lib/ui/InfoPopover.svelte';
  import { getI18n } from '$lib/i18n';
  import { fmtClock, fmtNum, fmtPace } from './activity-format';
  import type { BestEffort } from './activity-detail.types';

  const i18n = getI18n();

  let { efforts }: { efforts: readonly BestEffort[] } = $props();

  /** True when any window had to overshoot its target by enough to be worth explaining. */
  const overshoots = $derived(efforts.some((e) => e.actualM > e.metres * 1.02));
</script>

{#if efforts.length > 0}
  <Card title={i18n.t('bestEfforts.title')} subtitle={i18n.t('bestEfforts.subtitle')}>
    {#snippet actions()}
      <InfoPopover label={i18n.t('bestEfforts.explainLabel')}>
        <p>{i18n.t('bestEfforts.explainWindow')}</p>
        {#if overshoots}<p>{i18n.t('bestEfforts.explainOvershoot')}</p>{/if}
        <p>{i18n.t('bestEfforts.explainStart')}</p>
      </InfoPopover>
    {/snippet}

    <div class="table-wrap">
      <table class="efforts">
        <thead>
          <tr>
            <th scope="col">{i18n.t('bestEfforts.col.distance')}</th>
            <th scope="col" class="num">{i18n.t('bestEfforts.col.time')}</th>
            <th scope="col" class="num">{i18n.t('bestEfforts.col.pace')}</th>
            <th scope="col" class="num">{i18n.t('bestEfforts.col.start')}</th>
            <th scope="col" class="num">{i18n.t('bestEfforts.col.measured')}</th>
          </tr>
        </thead>
        <tbody>
          {#each efforts as e (e.key)}
            <tr>
              <th scope="row">{e.label}</th>
              <td class="num strong">{fmtClock(e.durationS)}</td>
              <td class="num">{fmtPace(e.paceSecPerKm)}<small>min/km</small></td>
              <td class="num muted">{fmtClock(e.startS)}</td>
              <td class="num muted">{fmtNum(e.actualM, 0, i18n.locale)}<small>m</small></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Card>
{/if}

<style>
  /* A five-column table must scroll inside its own box, never push the page sideways. */
  .table-wrap {
    overflow-x: auto;
  }

  .efforts {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  .efforts th,
  .efforts td {
    padding: var(--space-2) var(--space-3);
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
  }

  .efforts thead th {
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }

  .efforts tbody th {
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }

  .num {
    text-align: right;
    font-feature-settings: var(--numeric);
  }

  .strong {
    font-weight: var(--font-bold);
    color: var(--color-text);
  }

  .muted {
    color: var(--color-text-muted);
  }

  .efforts small {
    margin-left: 0.35ch;
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text-muted);
  }
</style>
