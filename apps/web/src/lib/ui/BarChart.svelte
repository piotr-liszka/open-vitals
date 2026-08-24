<script lang="ts">
  import { getI18n } from '$lib/i18n';

  const i18n = getI18n();

  import ChartTooltip, { type ChartTooltipRow } from './ChartTooltip.svelte';
  import ChartLegend, { type ChartLegendItem } from './ChartLegend.svelte';
  import {
    AXIS_GAP,
    TICK_GAP,
    axisLabelIndices,
    definedMask,
    formatTickValue,
    maxTextWidth,
    niceTicks,
    resolveSeries,
    seriesLength,
    textAnchorAt,
    type ChartSeries
  } from './chart-axis';
  import {
    activeIndex,
    bandIndex,
    edgeDefinedIndex,
    localX,
    nearestDefinedIndex,
    stepDefinedIndex
  } from './chart-interaction';

  interface Props {
    /** Single series, oldest → newest. Ignored when `series` is given. */
    values?: number[];
    /** Two or more named series, drawn as grouped bars sharing one band per index. */
    series?: ChartSeries[];
    /**
     * Per-bar labels (usually dates), aligned index-for-index with `values`. Drawn as x ticks
     * (thinned to fit) and used as the read-out heading + aria summary.
     */
    labels?: string[];
    /**
     * Any CSS color for the single-series bars. Callers pass a lane token,
     * e.g. `var(--lane-orange)`. Defaults to the signal accent.
     */
    color?: string;
    /** Rendered height in px, axes included; width fills the container. */
    height?: number;
    /** Formats a value for the read-out and the aria summary (e.g. thousands separators). */
    formatValue?: (n: number) => string;
    /** Formats a y-axis tick. Defaults to a compact form (12000 → "12k") so the gutter stays thin. */
    formatTick?: (n: number, step: number) => string;
    /** Optional reference value drawn as a faint dashed line (e.g. a goal). */
    baseline?: number;
    /** Short metric name used to build the aria summary, e.g. "steps". */
    label?: string;
    /** Unit printed once above the y axis (never repeated on every tick), e.g. "kroki". */
    unit?: string;
    /** Draw x tick labels. Defaults to on whenever `labels` are supplied. */
    xAxis?: boolean;
    /** Draw the labelled y scale + gridlines. Turn off for micro/decorative uses. */
    yAxis?: boolean;
    /** Show the series key. Defaults to on for multi-series charts. */
    legend?: boolean;
    /**
     * Pinned read-out index — bindable, so a caller's headline number can follow the clicked bar.
     * `null` when nothing is pinned.
     */
    selectedIndex?: number | null;
    /** Fired when a click/tap/Enter pins an index. */
    onSelect?: (index: number) => void;
  }

  let {
    values = [],
    series,
    labels,
    color = 'var(--color-accent)',
    height = 140,
    formatValue = (n) => n.toLocaleString(),
    formatTick,
    baseline,
    label,
    unit,
    xAxis,
    yAxis = true,
    legend,
    selectedIndex = $bindable(null),
    onSelect
  }: Props = $props();

  // Measured width gives a 1:1 pixel coordinate system, so rounded bar tops, ticks and
  // the hairline grid stay crisp (no non-uniform viewBox stretching). Falls back
  // to a sane width during SSR / before the first measure.
  let cw = $state(0);
  let wrapperEl: HTMLDivElement | undefined = $state();
  let svgEl: SVGSVGElement | undefined = $state();
  // Corner radius + axis type size resolved from tokens so the geometry stays token-driven.
  let radiusPx = $state(4);
  let axisFont = $state(12);

  // Track container width for a 1:1 coordinate system. Guarded so jsdom/SSR
  // (no ResizeObserver) fall back to the default width instead of throwing.
  $effect(() => {
    const el = wrapperEl;
    if (!el) return;
    cw = el.clientWidth;
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) cw = w;
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  $effect(() => {
    if (!svgEl) return;
    const cs = getComputedStyle(svgEl);
    const r = parseFloat(cs.borderTopLeftRadius);
    if (Number.isFinite(r) && r > 0) radiusPx = r;
    const f = parseFloat(cs.fontSize);
    if (Number.isFinite(f) && f > 0) axisFont = f;
  });

  const W = $derived(cw > 0 ? cw : 640);

  // ---- series ----
  const resolved = $derived(resolveSeries(series, { values, name: label ?? '', color }));
  const multi = $derived(resolved.length > 1);
  // Indices toggled off from the legend. An array (not a Set) so Svelte's proxy tracks it.
  let hiddenSeries = $state<number[]>([]);
  const visible = $derived(resolved.filter((_, i) => !hiddenSeries.includes(i)));

  function toggleSeries(i: number): void {
    if (hiddenSeries.includes(i)) {
      hiddenSeries = hiddenSeries.filter((h) => h !== i);
      return;
    }
    // Never let the legend empty the chart — the last visible series stays on.
    if (resolved.length - hiddenSeries.length <= 1) return;
    hiddenSeries = [...hiddenSeries, i];
  }

  const n = $derived(seriesLength(resolved));
  const defined = $derived(definedMask(visible, n));
  const hasData = $derived(n > 0 && defined.some(Boolean));

  // Domain always spans zero so bars have a base; a dead-flat/all-zero series
  // gets a span of 1 to dodge divide-by-zero.
  const domain = $derived.by(() => {
    const pool: number[] = [0];
    if (baseline !== undefined && Number.isFinite(baseline)) pool.push(baseline);
    for (const s of visible) for (const v of s.values) if (Number.isFinite(v)) pool.push(v);
    const lo = Math.min(...pool);
    const hi = Math.max(...pool);
    return { lo, hi, span: hi - lo || 1 };
  });

  // ---- axes ----
  const showX = $derived(xAxis ?? (labels !== undefined && labels.length > 0));
  const showY = $derived(yAxis);

  const yTicks = $derived(showY && hasData ? niceTicks(domain.lo, domain.hi, 4) : []);
  const yStep = $derived(yTicks.length > 1 ? (yTicks[1] ?? 0) - (yTicks[0] ?? 0) : 1);
  const tickText = $derived((v: number) => (formatTick ?? formatTickValue)(v, yStep));
  const yTickTexts = $derived(yTicks.map(tickText));

  const plotL = $derived(showY && yTicks.length > 0 ? maxTextWidth(yTickTexts, axisFont) + AXIS_GAP * 2 : 0);
  const padR = $derived(showY ? AXIS_GAP : 0);
  const plotR = $derived(Math.max(plotL, W - padR));
  const plotW = $derived(Math.max(0, plotR - plotL));

  // Headroom above (bars may touch it), a line for the x labels below.
  const topPad = $derived(unit && showY ? axisFont * 2 : axisFont * 1.2);
  const bottomPad = $derived(showX ? axisFont * 2 : axisFont * 0.9);
  const plotTop = $derived(topPad);
  const plotBottom = $derived(Math.max(topPad, height - bottomPad));
  const plotH = $derived(Math.max(0, plotBottom - plotTop));

  function yOf(v: number): number {
    return plotTop + (1 - (v - domain.lo) / domain.span) * plotH;
  }

  const zeroY = $derived(yOf(0));
  const baselineY = $derived(baseline === undefined ? undefined : yOf(baseline));

  const bandW = $derived(n > 0 ? plotW / n : plotW);
  // One series gets a comfortable single bar; grouped series share a slightly wider cluster.
  const groupW = $derived(bandW * (visible.length > 1 ? 0.78 : 0.6));
  const slotW = $derived(visible.length > 0 ? groupW / visible.length : groupW);
  const barW = $derived(Math.max(1, slotW * (visible.length > 1 ? 0.86 : 1)));

  function bandLeft(i: number): number {
    return plotL + i * bandW;
  }

  function bandCenter(i: number): number {
    return bandLeft(i) + bandW / 2;
  }

  interface Bar {
    key: string;
    x: number;
    y: number;
    w: number;
    h: number;
    up: boolean;
    i: number;
    color: string;
  }

  const bars = $derived.by<Bar[]>(() =>
    visible.flatMap((s, si) =>
      s.values.flatMap((v, i) => {
        if (!Number.isFinite(v)) return [];
        const vy = yOf(v);
        const up = v >= 0;
        const x = bandLeft(i) + (bandW - groupW) / 2 + si * slotW + (slotW - barW) / 2;
        return [
          {
            key: `${si}:${i}`,
            x,
            y: up ? vy : zeroY,
            w: barW,
            h: Math.abs(vy - zeroY),
            up,
            i,
            color: s.color
          }
        ];
      })
    )
  );

  // Rounded-corner path; the end away from the baseline is rounded. Radius is
  // clamped so thin/short bars never invert their own geometry.
  function barPath(b: Bar): string {
    if (b.h <= 0) return '';
    const r = Math.max(0, Math.min(radiusPx, b.w / 2, b.h));
    const { x, y, w, h } = b;
    if (b.up) {
      return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
    }
    return `M${x},${y} L${x},${y + h - r} Q${x},${y + h} ${x + r},${y + h} L${x + w - r},${y + h} Q${x + w},${y + h} ${x + w},${y + h - r} L${x + w},${y} Z`;
  }

  const xLabelW = $derived(maxTextWidth(labels ?? [], axisFont));
  const xTicks = $derived.by(() => {
    if (!showX || !labels || n === 0) return [];
    return axisLabelIndices(labels, n, bandCenter, xLabelW + TICK_GAP, W).flatMap((i) => {
      const text = labels[i];
      if (text === undefined || text === '') return [];
      const x = bandCenter(i);
      return [{ i, x, text, anchor: textAnchorAt(x, W, xLabelW) }];
    });
  });
  const xLabelY = $derived(plotBottom + AXIS_GAP + axisFont * 0.8);

  const stats = $derived.by(() => {
    let maxV = -Infinity;
    let minV = Infinity;
    let maxI = -1;
    let minI = -1;
    for (const s of visible) {
      s.values.forEach((v, i) => {
        if (!Number.isFinite(v)) return;
        if (v > maxV) {
          maxV = v;
          maxI = i;
        }
        if (v < minV) {
          minV = v;
          minI = i;
        }
      });
    }
    if (maxI < 0) return undefined;
    return { max: maxV, min: minV, maxLabel: labels?.[maxI], minLabel: labels?.[minI] };
  });

  // ---- hover / pin / keyboard read-out (specs 016 + 017) ----
  let hoverI = $state<number | null>(null);

  // A live hover wins; otherwise the pinned selection keeps the read-out open after pointerleave.
  const activeI = $derived.by(() => {
    const i = activeIndex(hoverI, selectedIndex, n);
    if (i === null) return null;
    const j = nearestDefinedIndex(i, defined);
    return j < 0 ? null : j;
  });
  const activeX = $derived(activeI === null ? 0 : bandCenter(activeI));
  const activeLabel = $derived(activeI === null ? undefined : labels?.[activeI]);
  const pinned = $derived(hoverI === null && activeI !== null);

  interface ActiveValue {
    name: string;
    color: string;
    value: number;
  }

  const activeValues = $derived.by<ActiveValue[]>(() => {
    if (activeI === null) return [];
    return visible.flatMap((s) => {
      const v = s.values[activeI];
      if (v === undefined || !Number.isFinite(v)) return [];
      return [{ name: s.name, color: s.color, value: v }];
    });
  });

  const tooltipRows = $derived<ChartTooltipRow[]>(
    activeValues.map((a) => ({
      label: multi ? a.name : undefined,
      value: formatValue(a.value),
      color: a.color
    }))
  );

  function pick(e: PointerEvent): void {
    const el = wrapperEl;
    if (!el || !hasData) return;
    const x = localX(e.clientX, el.getBoundingClientRect(), W) - plotL;
    const i = bandIndex(x, { n, width: plotW });
    const j = nearestDefinedIndex(i, defined);
    hoverI = j < 0 ? null : j;
  }

  /** Pin the read-out where it currently sits, so a caller's headline can follow it. */
  function commit(): void {
    if (activeI === null) return;
    selectedIndex = activeI;
    onSelect?.(activeI);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (!hasData) return;
    switch (e.key) {
      case 'ArrowRight':
        hoverI = stepDefinedIndex(activeI, 1, defined);
        break;
      case 'ArrowLeft':
        hoverI = stepDefinedIndex(activeI, -1, defined);
        break;
      case 'Home':
        hoverI = edgeDefinedIndex(defined, 'first');
        break;
      case 'End':
        hoverI = edgeDefinedIndex(defined, 'last');
        break;
      case 'Enter':
      case ' ':
        commit();
        break;
      case 'Escape':
        hoverI = null;
        selectedIndex = null;
        return;
      default:
        return;
    }
    // Only swallow the keys we handled, so Tab and scrolling keys still work.
    e.preventDefault();
  }

  const readout = $derived.by(() => {
    if (activeI === null || activeValues.length === 0) return '';
    const head = activeLabel ? `${activeLabel}: ` : '';
    const body = activeValues
      .map((a) => (multi && a.name ? `${a.name} ${formatValue(a.value)}` : formatValue(a.value)))
      .join(', ');
    return `${head}${body}`;
  });

  const legendItems = $derived<ChartLegendItem[]>(
    resolved.map((s, i) => {
      const hidden = hiddenSeries.includes(i);
      const v = activeI === null || hidden ? undefined : s.values[activeI];
      return {
        name: s.name,
        color: s.color,
        hidden,
        value: v !== undefined && Number.isFinite(v) ? formatValue(v) : undefined
      };
    })
  );
  const showLegend = $derived((legend ?? multi) && resolved.some((s) => s.name !== ''));

  const summary = $derived.by(() => {
    if (n === 0) return 'bar chart, no data';
    const days = `${n} day${n === 1 ? '' : 's'}`;
    if (!stats) return `bar chart, ${days}`;
    const hi = `high ${formatValue(stats.max)}${stats.maxLabel ? ` on ${stats.maxLabel}` : ''}`;
    const lo = `low ${formatValue(stats.min)}${stats.minLabel ? ` on ${stats.minLabel}` : ''}`;
    const who = multi
      ? `bar chart, ${resolved.length} series: ${resolved.map((s) => s.name).join(', ')}`
      : 'bar chart';
    return `${who}, ${days}, ${hi}, ${lo}`;
  });
</script>

<div class="chart-block">
  {#if showLegend}
    <ChartLegend
      items={legendItems}
      onToggle={multi ? toggleSeries : undefined}
      ariaLabel={label ? `${label} series` : 'Chart series'}
    />
  {/if}

  <!-- The single-series ornaments (the baseline rule) follow whichever colour that series carries,
       whether it came from `color` or from a one-entry `series`. -->
  <div
    class="chart"
    style="--chart-color: {visible.length === 1 ? (visible[0]?.color ?? color) : color}; height: {height}px;"
    bind:this={wrapperEl}
  >
    <!-- Focusable so the read-out is reachable without a pointer; the svg keeps role="img" so
         assistive tech still gets the whole-series summary rather than a bag of shapes. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <svg
      bind:this={svgEl}
      class="chart-svg"
      width="100%"
      {height}
      viewBox="0 0 {W} {height}"
      role="img"
      aria-label={summary}
      tabindex={hasData ? 0 : undefined}
      onkeydown={onKeyDown}
      onblur={() => (hoverI = null)}
    >
      {#if !hasData}
        <line class="grid" x1="0" y1={plotBottom} x2={W} y2={plotBottom} vector-effect="non-scaling-stroke" />
        <text class="empty" x={W / 2} y={height / 2} text-anchor="middle">{i18n.t('ui.chartNoData')}</text>
      {:else}
        {#if showY}
          {#each yTicks as t, k (t)}
            <line
              class="grid"
              x1={plotL}
              y1={yOf(t)}
              x2={plotR}
              y2={yOf(t)}
              vector-effect="non-scaling-stroke"
            />
            <text class="axis-tick y" x={plotL - AXIS_GAP} y={yOf(t)} text-anchor="end">
              {yTickTexts[k]}
            </text>
          {/each}
          {#if unit}
            <text class="axis-unit" x="0" y={plotTop - AXIS_GAP} text-anchor="start">{unit}</text>
          {/if}
        {/if}

        <!-- The value axis' zero: the line every bar is measured from. -->
        <line
          class="grid zero"
          x1={plotL}
          y1={zeroY}
          x2={plotR}
          y2={zeroY}
          vector-effect="non-scaling-stroke"
        />

        {#if baselineY !== undefined}
          <line
            class="baseline"
            x1={plotL}
            y1={baselineY}
            x2={plotR}
            y2={baselineY}
            vector-effect="non-scaling-stroke"
          />
        {/if}

        {#if activeI !== null}
          <!-- Band highlight, painted under the bars so a grouped read-out reads as one day. -->
          <rect class="band" class:pinned x={bandLeft(activeI)} y={plotTop} width={bandW} height={plotH} />
        {/if}

        {#each bars as b (b.key)}
          {#if b.h > 0}
            <path
              class="bar"
              class:down={!b.up}
              class:active={activeI === b.i}
              class:dim={activeI !== null && activeI !== b.i}
              style="--i: {b.i}; --series: {b.color};"
              d={barPath(b)}
            />
          {/if}
        {/each}

        {#if showX}
          {#each xTicks as t (t.i)}
            <text class="axis-tick x" x={t.x} y={xLabelY} text-anchor={t.anchor}>{t.text}</text>
          {/each}
        {/if}

        <!-- Transparent hit layer: hover or drag anywhere over the chart to read a bar, click or
             tap to pin it. `touch-action: pan-y` keeps a vertical swipe scrolling the page. -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <rect
          class="hit"
          role="presentation"
          x="0"
          y="0"
          width={W}
          {height}
          onpointerdown={pick}
          onpointermove={pick}
          onpointerup={commit}
          onpointerleave={() => (hoverI = null)}
          onpointercancel={() => (hoverI = null)}
        />
      {/if}
    </svg>

    {#if activeI !== null && tooltipRows.length > 0}
      <ChartTooltip x={activeX} width={W} title={activeLabel} rows={tooltipRows} />
    {/if}
    {#if hasData}<span class="sr-only" aria-live="polite">{readout}</span>{/if}
  </div>
</div>

<style>
  .chart-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
  }

  .chart {
    position: relative;
    width: 100%;
  }

  .chart-svg {
    display: block;
    overflow: visible;
    /* Source of the token-driven corner radius + axis type size, read back via getComputedStyle. */
    border-top-left-radius: var(--radius-sm);
    font-size: var(--text-xs);
  }

  .chart-svg:focus {
    outline: none;
  }

  .chart-svg:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
    border-radius: var(--radius-sm);
  }

  .bar {
    fill: var(--series, var(--chart-color));
    transform-box: fill-box;
    transform-origin: bottom;
    transition: opacity var(--transition-fast);
  }

  .bar.down {
    transform-origin: top;
  }

  /* Read-out open: the picked bar keeps full strength, its neighbours step back. */
  .bar.dim {
    opacity: 0.4;
  }

  .bar.active {
    opacity: 1;
  }

  .band {
    fill: var(--color-surface-hover);
    pointer-events: none;
  }

  /* Pinned: a tinted slot reads as "this stays" where the neutral slot reads as "passing through". */
  .band.pinned {
    fill: var(--color-accent-soft);
  }

  .hit {
    fill: transparent;
    cursor: crosshair;
    touch-action: pan-y;
  }

  @media (prefers-reduced-motion: no-preference) {
    .bar {
      animation: bar-grow var(--duration-slow) var(--ease-out) backwards;
      /* Gentle left-to-right sweep; a quarter of the base stagger keeps long series short. */
      animation-delay: calc(var(--i) * (var(--motion-stagger) / 4));
    }
  }

  @keyframes bar-grow {
    from {
      transform: scaleY(0);
    }
  }

  .grid {
    stroke: var(--color-grid);
    stroke-width: 1;
  }

  .grid.zero {
    stroke: var(--color-border);
  }

  .axis-tick {
    fill: var(--color-text-muted);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    font-feature-settings: var(--numeric);
    dominant-baseline: middle;
  }

  .axis-unit {
    fill: var(--color-text-muted);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-wide);
    dominant-baseline: middle;
  }

  .baseline {
    stroke: color-mix(in srgb, var(--chart-color) 55%, transparent);
    stroke-width: 1;
    stroke-dasharray: 4 4;
  }

  .empty {
    fill: var(--color-text-subtle);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    dominant-baseline: middle;
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
</style>
