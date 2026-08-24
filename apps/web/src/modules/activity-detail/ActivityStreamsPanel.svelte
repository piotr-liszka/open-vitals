<script lang="ts">
  /**
   * The stacked stream charts (spec 026). Every chart on this panel is drawn on ONE shared sample
   * lattice, so index `k` is the same moment everywhere: hovering or clicking any chart marks that
   * moment in all of them and the read-out strip above resolves it to a time, a distance and a value
   * per metric.
   *
   * Spec 035 made the HOVER shared too, not just the pin — one dashed rule runs down the whole stack
   * the way Garmin's does. Two things make that work: `hovered` is owned here and bound into every
   * chart, and the charts negotiate ONE left gutter (`gutterLeft`) so their plots — and therefore
   * their rules — line up vertically instead of each sizing itself to its own widest y tick.
   *
   * The per-chart floating tooltips stay off here: the strip already reads out every metric at once,
   * which is more than eight tooltips could say and far less noise.
   *
   * Spec 052 took that strip OUT of the header's flow. In the header it grew by two or three lines
   * the instant a value appeared, which pushed the whole chart stack down and out from under the
   * pointer that had just asked for it. The active read-out now renders in `FloatingReadout` — a
   * fixed, inert bar at the bottom of the viewport — while the header keeps a constant-height slot
   * holding the idle hint, and, while a moment is active, a screen-reader-only sentence: the
   * `aria-live` region has to stay mounted to be announced, and the floating bar comes and goes.
   *
   * The axis switch re-lattices rather than relabels — picking "dystans" resamples the streams onto
   * evenly spaced metres, so a chart never spends horizontal space on standing still.
   *
   * Charts come from `buildActivityCharts`, which only emits a chart when the device recorded that
   * stream; nothing here renders an empty frame.
   */
  import TrendChart from '$lib/ui/TrendChart.svelte';
  import SegmentedControl from '$lib/ui/SegmentedControl.svelte';
  import FloatingReadout, { type FloatingReadoutItem } from '$lib/ui/FloatingReadout.svelte';
  import TimelineStrip, { type TimelineMarker, type TimelineSegment } from '$lib/ui/TimelineStrip.svelte';
  import { AXIS_GAP } from '$lib/ui/chart-axis';
  import { getI18n } from '$lib/i18n';
  import type { SportGroup } from '$lib/sport-labels';
  import {
    buildChartSet,
    chartGroupTitle,
    type ActivityChartSpec,
    type ChartAxisMode,
    type ChartGroupKey,
    type ChartValueKind
  } from './activity-charts';
  import { buildExecutedStrip, buildPlanStrip, type PlannedStepKind } from './activity-plan';
  import { DASH, fmtClock, fmtNum, fmtPace } from './activity-format';
  import type { ActivityStreams, PlannedStructureStep } from './activity-detail.types';

  const i18n = getI18n();

  interface Props {
    streams: ActivityStreams;
    sport: SportGroup;
    /**
     * The matched plan's flattened step sequence (spec 085). `null` — the normal case — draws no
     * strip at all rather than an empty frame.
     */
    plannedStructure?: readonly PlannedStructureStep[] | null;
  }

  let { streams, sport, plannedStructure = null }: Props = $props();

  let axis = $state<ChartAxisMode>('time');
  /** Shared pinned sample index — the solid rule every chart obeys until it is cleared. */
  let pinned = $state<number | null>(null);
  /** Shared live-hover sample index — the dashed rule that tracks the pointer across the stack. */
  let hovered = $state<number | null>(null);
  /**
   * Left plot inset each chart's own y ticks ask for, keyed by chart. The widest wins for all of
   * them; a chart only ever reports its NATURAL inset, so feeding the maximum back cannot oscillate.
   */
  let gutters = $state<Record<string, number>>({});
  const gutterLeft = $derived(Math.max(0, ...Object.values(gutters)));

  const set = $derived(buildChartSet(i18n.t, streams, sport, axis, undefined, i18n.locale));
  const groups = $derived(
    (['effort', 'terrain', 'physiology', 'dynamics'] as ChartGroupKey[])
      .map((key) => ({
        key,
        title: chartGroupTitle(i18n.t, key),
        charts: set.charts.filter((c) => c.group === key)
      }))
      .filter((g) => g.charts.length > 0)
  );

  /* --------------------------------------------------------------------------------------- *
   * The planned structure, laid over the same axis (spec 085)
   *
   * Only on the TIME axis. A plan is a sequence of durations; on a distance lattice those blocks
   * would land wherever the athlete happened to be, which is a different claim from the one the
   * plan makes. Hiding it there beats drawing a strip that quietly means nothing.
   * --------------------------------------------------------------------------------------- */
  const STEP_LANES: Readonly<Record<PlannedStepKind, string>> = {
    warmup: 'var(--lane-amber)',
    work: 'var(--lane-orange)',
    recovery: 'var(--lane-cyan)',
    rest: 'var(--lane-indigo)',
    cooldown: 'var(--lane-teal)'
  };

  const KIND_KEYS = {
    warmup: 'plan.stepKind.warmup',
    work: 'plan.stepKind.work',
    recovery: 'plan.stepKind.recovery',
    rest: 'plan.stepKind.rest',
    cooldown: 'plan.stepKind.cooldown'
  } as const;

  function kindLabel(kind: PlannedStepKind, index: number | null, total: number | null): string {
    const name = i18n.t(KIND_KEYS[kind]);
    return index === null || total === null ? name : i18n.t('plan.stepRepeat', { kind: name, index, total });
  }

  const strip = $derived(plannedStructure ? buildPlanStrip(plannedStructure) : null);
  /**
   * The strip is scaled to the CHART's elapsed span, not to the plan's own total, because lining the
   * two up is the entire point. A plan longer than the session simply runs off the right edge —
   * which is the honest picture of a session cut short.
   */
  const elapsedSpanS = $derived(
    set.elapsedS.length < 2 ? 0 : (set.elapsedS[set.elapsedS.length - 1] ?? 0) - (set.elapsedS[0] ?? 0)
  );
  const showStrip = $derived(axis === 'time' && strip !== null && elapsedSpanS > 0);
  const stripSegments = $derived<TimelineSegment[]>(
    strip === null || elapsedSpanS <= 0
      ? []
      : strip.blocks.map((block) => ({
          key: `b${block.index}`,
          start: block.startS / elapsedSpanS,
          end: block.endS / elapsedSpanS,
          color: STEP_LANES[block.kind],
          label: kindLabel(block.kind, block.repeatIndex, block.repeatTotal)
        }))
  );
  const stripMarkers = $derived<TimelineMarker[]>(
    strip === null || elapsedSpanS <= 0
      ? []
      : strip.markers.map((marker) => ({
          key: `m${marker.index}`,
          at: marker.atS / elapsedSpanS,
          color: STEP_LANES[marker.kind],
          label: i18n.t(
            marker.durationType === 'calories' ? 'plan.stepMarkerCalories' : 'plan.stepMarkerLap',
            { kind: i18n.t(KIND_KEYS[marker.kind]) }
          )
        }))
  );

  /*
   * The EXECUTED extent of each planned block (spec 091), as a second row under the planned one.
   *
   * This exists so the aligner can be checked rather than trusted: a rep that started late or ran
   * long is visible as a shift between the two rows, and a step the aligner could not place leaves a
   * gap instead of a confident block. Absent — no row at all — whenever the laps could not be
   * reconciled with the plan, which is what `alignment: null` on every step means.
   */
  const executed = $derived(plannedStructure ? buildExecutedStrip(plannedStructure) : []);
  const executedSegments = $derived<TimelineSegment[]>(
    elapsedSpanS <= 0
      ? []
      : executed.map((block) => ({
          key: `e${block.index}`,
          start: block.startS / elapsedSpanS,
          end: block.endS / elapsedSpanS,
          color: STEP_LANES[block.kind],
          label: kindLabel(block.kind, block.repeatIndex, block.repeatTotal)
        }))
  );
  const showExecuted = $derived(showStrip && executedSegments.length > 0);

  const axisOptions = $derived([
    { value: 'time', label: i18n.t('streams.axis.time') },
    { value: 'distance', label: i18n.t('streams.axis.distance') }
  ]);

  function onAxisChange(value: string): void {
    // The lattice changes under us, so a pinned or hovered index would point at a different moment.
    pinned = null;
    hovered = null;
    // Re-lattising can drop charts; a stale entry here would keep inflating the shared gutter.
    gutters = {};
    axis = value === 'distance' ? 'distance' : 'time';
  }

  function formatter(kind: ChartValueKind): (n: number) => string {
    if (kind === 'pace') return (n) => fmtPace(n);
    if (kind === 'decimal') return (n) => fmtNum(n, 1, i18n.locale);
    return (n) => fmtNum(Math.round(n), 0, i18n.locale);
  }

  /** Value(s) of one chart at the pinned index, for the read-out strip. */
  function readoutOf(chart: ActivityChartSpec, index: number): string {
    const fmt = formatter(chart.kind);
    if (chart.series) {
      const parts = chart.series
        .map((s) => {
          const v = s.values[index];
          return v !== undefined && Number.isFinite(v) ? `${s.name} ${fmt(v)}` : null;
        })
        .filter((p): p is string => p !== null);
      return parts.length > 0 ? parts.join(' · ') : DASH;
    }
    const v = chart.values[index];
    return v !== undefined && Number.isFinite(v) ? fmt(v) : DASH;
  }

  /** The moment the strip reports: a live hover wins, else whatever is pinned. */
  const active = $derived(hovered ?? pinned);
  const activeTime = $derived(active === null ? null : (set.elapsedS[active] ?? null));
  const activeDistance = $derived(active === null || !set.distanceM ? null : (set.distanceM[active] ?? null));
  const activeLead = $derived(fmtClock(activeTime));
  const activeSecondary = $derived(
    activeDistance === null ? undefined : `${fmtNum(activeDistance / 1000, 2, i18n.locale)} km`
  );
  const activeItems = $derived<FloatingReadoutItem[]>(
    active === null
      ? []
      : set.charts.map((chart) => ({
          key: chart.key,
          label: chart.title,
          value: readoutOf(chart, active),
          unit: chart.unit,
          color: chart.color
        }))
  );
  /** What the (always-mounted) live region says once a moment is active. */
  const announcement = $derived(
    active === null
      ? ''
      : [
          activeLead,
          activeSecondary,
          ...activeItems.map((i) => [i.label, i.value, i.unit].filter(Boolean).join(' '))
        ]
          .filter((part): part is string => Boolean(part))
          .join(' · ')
  );
</script>

<div class="panel">
  <header class="head">
    <!-- Constant-height slot: the hint idle, a screen-reader sentence while a moment is active. The
         visible values live in the floating bar below, so this never changes the header's height. -->
    <div class="readout" aria-live="polite">
      {#if active === null}
        <p class="hint">
          {i18n.t('streams.hint')}
        </p>
      {:else}
        <p class="sr-only">{announcement}</p>
      {/if}
    </div>
    {#if set.canUseDistance}
      <SegmentedControl
        options={axisOptions}
        value={axis}
        onChange={onAxisChange}
        ariaLabel={i18n.t('streams.axisAriaLabel')}
        size="sm"
      />
    {/if}
  </header>

  {#if showStrip}
    <section class="plan-strip">
      <div class="plan-head">
        <h4 class="group-title">{i18n.t('plan.strip.title')}</h4>
        <p class="plan-note">{i18n.t('plan.strip.note')}</p>
      </div>
      <TimelineStrip
        segments={stripSegments}
        markers={stripMarkers}
        insetLeft={gutterLeft}
        insetRight={AXIS_GAP}
        ariaLabel={i18n.t('plan.strip.ariaLabel')}
      />
      {#if showExecuted}
        <p class="plan-note strip-label">{i18n.t('plan.strip.executedLabel')}</p>
        <TimelineStrip
          segments={executedSegments}
          insetLeft={gutterLeft}
          insetRight={AXIS_GAP}
          ariaLabel={i18n.t('plan.strip.executedAriaLabel')}
        />
      {/if}
    </section>
  {/if}

  {#each groups as group (group.key)}
    <section class="group">
      <h4 class="group-title">{group.title}</h4>
      {#each group.charts as chart (chart.key)}
        <div class="chart-row">
          <div class="chart-head">
            <span class="chart-title" style="--lane: {chart.color}">{chart.title}</span>
            {#if chart.note}<span class="chart-note">{chart.note}</span>{/if}
          </div>
          <!-- `series` and `formatTick` are spread in only when they apply: under
               `exactOptionalPropertyTypes` an explicit `undefined` is not the same as absent. -->
          <TrendChart
            {...chart.series ? { series: chart.series.map((s) => ({ ...s })) } : { values: chart.values }}
            {...chart.kind === 'pace' ? { formatTick: (n: number) => fmtPace(n) } : {}}
            labels={[...set.labels]}
            color={chart.color}
            unit={chart.unit}
            label={chart.title}
            height={chart.series ? 170 : 150}
            showArea={chart.area}
            formatValue={formatter(chart.kind)}
            bind:selectedIndex={pinned}
            bind:hoverIndex={hovered}
            tooltip={false}
            {gutterLeft}
            onGutter={(px) => (gutters[chart.key] = px)}
          />
        </div>
      {/each}
    </section>
  {/each}
</div>

<FloatingReadout open={active !== null} lead={activeLead} secondary={activeSecondary} items={activeItems} />

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  /* A fixed slot, not a growing one: whatever it holds, the header measures the same, so nothing
     under it can move when a value appears (spec 052). */
  .readout {
    flex: 1;
    min-width: 240px;
    min-height: var(--space-10);
    display: flex;
    align-items: center;
  }

  .hint {
    margin: 0;
    font-size: var(--text-xs);
    line-height: var(--leading-normal);
    color: var(--color-text-muted);
    max-width: 52ch;
    /* Two lines of --text-xs (36px) still fit the 40px slot, so even the narrowest phone cannot make
       the hint taller than the slot it shares with the (zero-height) active announcement. */
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .plan-strip {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .plan-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .plan-note {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  /* Names the second row so the two strips are never mistaken for one two-line diagram. */
  .strip-label {
    margin-top: var(--space-1);
    font-weight: var(--font-semibold);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .group-title {
    margin: 0;
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--color-border);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
  }

  .chart-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .chart-head {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .chart-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }

  .chart-title::before {
    content: '';
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--lane, var(--color-accent));
  }

  .chart-note {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
</style>
