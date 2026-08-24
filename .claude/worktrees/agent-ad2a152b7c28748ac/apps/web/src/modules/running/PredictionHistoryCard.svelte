<script lang="ts">
  /**
   * "Historia przewidywań" (spec 087) — the shape between the two endpoints spec 057's badge
   * compares.
   *
   * Two decisions live here because they are what the card MEANS:
   *
   *  - **One distance at a time.** Four race times on one axis puts a 20-minute 5 km and a 3½-hour
   *    marathon on the same scale, which flattens the 5 km line into a straight edge. Chips, not a
   *    multi-series chart. There is no "Wszystkie" chip for the same reason.
   *  - **The net change is stated in WORDS**, not left to the reader's eye. A line that drifts three
   *    pixels over a year and a line that drops two minutes look alike at chart resolution.
   *
   * Presentational: the payload already carries every distance, so a chip switch is local state and
   * costs no round-trip. Formatting helpers are inlined because the shared ones live under
   * `$lib/server`, which a component may not import.
   */
  import Card from '$lib/ui/Card.svelte';
  import DeltaBadge from '$lib/ui/DeltaBadge.svelte';
  import FilterChips, { type FilterChipOption } from '$lib/ui/FilterChips.svelte';
  import TrendChart from '$lib/ui/TrendChart.svelte';
  import { formatDay } from '$lib/date';
  import { getI18n } from '$lib/i18n';
  import type { PredictionHistory, PredictionHistoryDistance } from './running.types';

  const i18n = getI18n();

  let { history }: { history: PredictionHistory } = $props();

  /**
   * The distance with the most history is the default, because it is the line with something to
   * show. Derived rather than copied into state, so a reload that brings a different winner is still
   * right without an effect to re-sync it.
   */
  const byHistory = $derived([...history.distances].sort((a, b) => defined(b).length - defined(a).length));
  const fallback = $derived<PredictionHistoryDistance | undefined>(byHistory[0]);

  /** The chip the reader picked. `null` means "whatever has the most history". */
  let picked = $state<string | null>(null);

  const active = $derived<PredictionHistoryDistance | undefined>(
    history.distances.find((d) => d.key === picked) ?? fallback
  );

  const options = $derived<FilterChipOption[]>(
    history.distances.map((d) => ({ value: d.key, label: d.label }))
  );

  /** `null` is how a gap travels over JSON; `TrendChart` reads any non-finite entry as one. */
  const values = $derived(active ? active.values.map((v) => v ?? Number.NaN) : []);
  const labels = $derived(history.days.map((d) => formatDay(i18n.locale, d, 'shortYear')));

  /** `h:mm:ss` or `mm:ss` — a marathon needs the hour, a 5 km must not carry a leading zero. */
  const fmtDur = (totalS: number | null): string => {
    if (totalS == null || !Number.isFinite(totalS)) return '—';
    const s = Math.round(totalS);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  };

  /** Positive = faster now, the sign convention `RaceTrend.deltaS` already fixed. */
  const net = $derived(active?.netChangeS ?? null);

  const netSentence = $derived(
    net === null
      ? i18n.t('predHistory.netUnknown')
      : net > 0
        ? i18n.t('predHistory.netFaster', { value: fmtDur(net) })
        : net < 0
          ? i18n.t('predHistory.netSlower', { value: fmtDur(-net) })
          : i18n.t('predHistory.netFlat')
  );

  function defined(distance: PredictionHistoryDistance): (number | null)[] {
    return distance.values.filter((v) => v !== null);
  }
</script>

<Card title={i18n.t('predHistory.title')} subtitle={i18n.t('predHistory.subtitle')}>
  {#if active}
    <div class="chips">
      <FilterChips
        {options}
        value={active.key}
        onSelect={(value) => {
          if (value !== null) picked = value;
        }}
        ariaLabel={i18n.t('predHistory.filterLabel')}
        allLabel={null}
        maxVisible={4}
      />
    </div>

    <div class="net">
      <span class="net-heading">{i18n.t('predHistory.netHeading')}</span>
      {#if net !== null && net !== 0}
        <!-- A VISUAL restatement of the sentence beside it, so it is hidden from assistive tech
             rather than read twice. The sentence is the accessible source of the fact. -->
        <span aria-hidden="true">
          <DeltaBadge
            direction={net > 0 ? 'better' : 'worse'}
            arrow={net > 0 ? 'down' : 'up'}
            value={fmtDur(Math.abs(net))}
            label={netSentence}
          />
        </span>
      {/if}
      <p class="net-text">{netSentence}</p>
    </div>

    <TrendChart
      {values}
      {labels}
      color="var(--lane-orange)"
      height={240}
      label={i18n.t('predHistory.chartLabel')}
      formatValue={(v) => fmtDur(v)}
      formatTick={(v) => fmtDur(v)}
    />

    <p class="note">{i18n.t('predHistory.note')}</p>
  {/if}
</Card>

<style>
  .chips {
    margin-bottom: var(--space-4);
  }

  .net {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }

  .net-heading {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
  }

  .net-text {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text);
    text-wrap: pretty;
  }

  .note {
    margin: var(--space-4) 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    max-width: 78ch;
  }
</style>
