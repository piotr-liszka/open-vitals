<script lang="ts">
  /**
   * Aerobic efficiency (spec 038): did this session hold together, and is the engine improving?
   *
   * Three numbers that are useless without their sentence, so each one carries it. Decoupling in
   * particular is a number people misread — it is meaningless for intervals and it punishes a long
   * warm-up — so the card says what it measures rather than leaving a bare percentage to be
   * over-interpreted.
   *
   * Presentational: the handler computed everything. Nothing here renders when the session carried no
   * heart rate at all, because all three numbers are HR-relative.
   */
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import { formatNumber, getI18n } from '$lib/i18n';
  import { fmtPace } from './activity-format';
  import { COUPLED_LIMIT_PCT } from '$lib/analytics/efficiency';
  import type { EfficiencyBlock, Pacing, PacingShape } from './activity-detail.types';

  const i18n = getI18n();

  let { efficiency, pacing }: { efficiency: EfficiencyBlock; pacing: Pacing | null } = $props();

  /** What each pace shape means. Variability is checked first, so an interval session is never "faded". */
  const SHAPE = $derived<
    Record<PacingShape, { label: string; tone: 'success' | 'info' | 'warning'; text: string }>
  >({
    even: {
      label: i18n.t('efficiency.shape.even.label'),
      tone: 'success',
      text: i18n.t('efficiency.shape.even.text')
    },
    'negative-split': {
      label: i18n.t('efficiency.shape.negativeSplit.label'),
      tone: 'success',
      text: i18n.t('efficiency.shape.negativeSplit.text')
    },
    faded: {
      label: i18n.t('efficiency.shape.faded.label'),
      tone: 'warning',
      text: i18n.t('efficiency.shape.faded.text')
    },
    variable: {
      label: i18n.t('efficiency.shape.variable.label'),
      tone: 'info',
      text: i18n.t('efficiency.shape.variable.text')
    }
  });

  const d = $derived(efficiency.decoupling);
  const has = $derived(
    d !== null ||
      pacing !== null ||
      efficiency.ef !== null ||
      efficiency.powerEf !== null ||
      efficiency.cardiacCost !== null
  );

  const nf = (n: number): string => formatNumber(i18n.locale, n, { maximumFractionDigits: 0 });
  const nf1 = (n: number): string =>
    formatNumber(i18n.locale, n, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const nf2 = (n: number): string =>
    formatNumber(i18n.locale, n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const signed = (v: number): string => `${v > 0 ? '+' : ''}${nf1(v)}`;

  /** What a decoupling figure actually means, in the direction it points. */
  const verdict = $derived.by(() => {
    if (!d) return null;
    if (d.coupled) {
      return {
        tone: 'success' as const,
        label: i18n.t('efficiency.decoupling.coupled.label'),
        text: i18n.t('efficiency.decoupling.coupled.text', { limit: COUPLED_LIMIT_PCT })
      };
    }
    if (d.pct > 0) {
      return {
        tone: 'warning' as const,
        label: i18n.t('efficiency.decoupling.drifted.label'),
        text: i18n.t('efficiency.decoupling.drifted.text')
      };
    }
    return {
      tone: 'info' as const,
      label: i18n.t('efficiency.decoupling.accelerated.label'),
      text: i18n.t('efficiency.decoupling.accelerated.text')
    };
  });
</script>

{#if has}
  <Card title={i18n.t('efficiency.title')} subtitle={i18n.t('efficiency.subtitle')}>
    <div class="grid">
      {#if d && verdict}
        <div class="item wide">
          <div class="head">
            <span class="label">
              {d.basis === 'power'
                ? i18n.t('efficiency.decouplingLabelPower')
                : i18n.t('efficiency.decouplingLabelPace')}
            </span>
            <Badge tone={verdict.tone}>{verdict.label}</Badge>
          </div>
          <p class="value">{signed(d.pct)}<span class="unit">%</span></p>
          <p class="text">{verdict.text}</p>
          <p class="meta">
            {i18n.t('efficiency.decoupling.meta', { samples: nf(d.samples) })}
          </p>
        </div>
      {/if}

      {#if pacing}
        <div class="item wide">
          <div class="head">
            <span class="label">{i18n.t('efficiency.paceLabel')}</span>
            <Badge tone={SHAPE[pacing.shape].tone}>{SHAPE[pacing.shape].label}</Badge>
          </div>
          <p class="value">
            {signed(pacing.splitPct)}<span class="unit">% {i18n.t('efficiency.secondHalfUnit')}</span>
          </p>
          <p class="text">{SHAPE[pacing.shape].text}</p>
          <p class="meta">
            {i18n.t('efficiency.pacing.meta', {
              first: fmtPace(pacing.firstHalfPaceSecPerKm),
              second: fmtPace(pacing.secondHalfPaceSecPerKm),
              chunks: nf(pacing.chunks),
              variability: nf1(pacing.variabilityPct)
            })}
          </p>
        </div>
      {/if}

      {#if efficiency.ef !== null}
        <div class="item">
          <span class="label">{i18n.t('efficiency.efLabel')}</span>
          <p class="value">{nf2(efficiency.ef)}</p>
          <p class="text">
            {i18n.t('efficiency.efText')}
          </p>
        </div>
      {/if}

      {#if efficiency.powerEf !== null}
        <div class="item">
          <span class="label">{i18n.t('efficiency.powerEfLabel')}</span>
          <p class="value">
            {nf2(efficiency.powerEf)}<span class="unit">{i18n.t('efficiency.powerEfUnit')}</span>
          </p>
          <p class="text">{i18n.t('efficiency.powerEfText')}</p>
        </div>
      {/if}

      {#if efficiency.cardiacCost !== null}
        <div class="item">
          <span class="label">{i18n.t('efficiency.cardiacCostLabel')}</span>
          <p class="value">
            {nf(efficiency.cardiacCost)}<span class="unit">{i18n.t('efficiency.cardiacCostUnit')}</span>
          </p>
          <p class="text">
            {i18n.t('efficiency.cardiacCostText')}
          </p>
        </div>
      {/if}
    </div>
  </Card>
{/if}

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-5);
  }

  /* The decoupling verdict carries a badge and two lines of explanation, so it gets the wide slot. */
  .wide {
    grid-column: 1 / -1;
  }

  .item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .label {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }

  .value {
    margin: 0;
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    color: var(--color-text);
    font-feature-settings: var(--numeric);
    letter-spacing: var(--tracking-tight);
  }

  .unit {
    margin-left: 0.35ch;
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text-muted);
  }

  .text {
    margin: 0;
    font-size: var(--text-sm);
    line-height: var(--leading-snug);
    color: var(--color-text);
    max-width: 68ch;
  }

  .meta {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    max-width: 68ch;
  }
</style>
