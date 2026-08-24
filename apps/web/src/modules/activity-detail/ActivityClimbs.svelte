<script lang="ts">
  /**
   * What did I climb? (spec 046)
   *
   * Total elevation gain answers "how hilly was it". This answers a different question: 600 m of rolling
   * terrain and 600 m in one long ascent are the same number and nothing alike.
   *
   * VAM — metres of ascent per hour — is the column that makes climbs comparable to each other and to past
   * efforts, because unlike a time it does not care how long the climb was.
   *
   * Presentational; the handler found the climbs. The card says what fraction of the day's gain was actual
   * climbing, because that ratio is the honest summary of a hilly-looking ride that was really just rolling.
   */
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import InfoPopover from '$lib/ui/InfoPopover.svelte';
  import { formatNumber, getI18n } from '$lib/i18n';
  import { fmtClock, fmtKm, fmtNum } from './activity-format';
  import type { Climb } from './activity-detail.types';

  const i18n = getI18n();

  let { climbs, totalGainM }: { climbs: readonly Climb[]; totalGainM: number | null } = $props();

  const nf = (n: number): string => formatNumber(i18n.locale, n, { maximumFractionDigits: 0 });
  const nf1 = (n: number): string => formatNumber(i18n.locale, n, { maximumFractionDigits: 1 });

  const climbedM = $derived(climbs.reduce((sum, c) => sum + c.gainM, 0));
  /** Share of the day's ascent that happened inside a named climb. */
  const sharePct = $derived(
    totalGainM !== null && totalGainM > 0 ? Math.min(100, (climbedM / totalGainM) * 100) : null
  );
  const hardest = $derived(
    climbs.reduce<Climb | null>((best, c) => (best === null || c.score > best.score ? c : best), null)
  );
</script>

{#if climbs.length > 0}
  <Card title={i18n.t('climbs.title')} subtitle={i18n.t('climbs.subtitle')}>
    {#snippet actions()}
      {#if hardest && hardest.categoryKey !== 'uncat'}
        <Badge tone="info">{i18n.t('climbs.hardest', { label: hardest.categoryLabel })}</Badge>
      {/if}
      <InfoPopover label={i18n.t('climbs.explainLabel')}>
        <p>{i18n.t('climbs.explain')}</p>
      </InfoPopover>
    {/snippet}

    <p class="summary">
      <strong>{nf(climbs.length)}</strong>
      {i18n.t('climbs.count', { count: climbs.length })} ·
      <strong>{nf(climbedM)} m</strong>
      {i18n.t('climbs.summaryUnit')}
      {#if sharePct !== null}
        {i18n.t('climbs.summaryShare', { pct: nf1(sharePct) })}
      {/if}
    </p>

    <div class="table-wrap">
      <table class="climbs">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col" class="num">{i18n.t('climbs.col.gain')}</th>
            <th scope="col" class="num">{i18n.t('climbs.col.length')}</th>
            <th scope="col" class="num">{i18n.t('climbs.col.grade')}</th>
            <th scope="col" class="num">{i18n.t('climbs.col.time')}</th>
            <th scope="col" class="num">{i18n.t('climbs.col.vam')}</th>
            <th scope="col" class="num">{i18n.t('climbs.col.start')}</th>
            <th scope="col">{i18n.t('climbs.col.category')}</th>
          </tr>
        </thead>
        <tbody>
          {#each climbs as c (c.index)}
            <tr>
              <th scope="row">{c.index}</th>
              <td class="num strong">{fmtNum(c.gainM, 0, i18n.locale)}<small>m</small></td>
              <td class="num">{fmtKm(c.distanceM, 2, i18n.locale)}<small>km</small></td>
              <td class="num">{nf1(c.gradePct)}<small>%</small></td>
              <td class="num muted">{fmtClock(c.durationS)}</td>
              <td class="num strong">{nf(c.vam)}<small>m/h</small></td>
              <td class="num muted">{fmtClock(c.startS)}</td>
              <td class="cat">{c.categoryLabel}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </Card>
{/if}

<style>
  .summary {
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .summary strong {
    color: var(--color-text);
    font-feature-settings: var(--numeric);
  }

  /* An eight-column table must scroll inside its own box, never push the page sideways. */
  .table-wrap {
    overflow-x: auto;
  }

  .climbs {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  .climbs th,
  .climbs td {
    padding: var(--space-2) var(--space-3);
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
  }

  .climbs thead th {
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }

  .climbs tbody th {
    width: 3ch;
    font-weight: var(--font-semibold);
    color: var(--color-text-muted);
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

  .cat {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .climbs small {
    margin-left: 0.35ch;
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text-muted);
  }
</style>
