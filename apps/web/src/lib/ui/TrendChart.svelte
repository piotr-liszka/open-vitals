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
    markerLabelY,
    maxTextWidth,
    niceTicks,
    resolveSeries,
    seriesLength,
    textAnchorAt,
    type ChartSeries
  } from './chart-axis';
  import {
    activeIndex,
    edgeDefinedIndex,
    localX,
    nearestDefinedIndex,
    nearestPointIndex,
    stepDefinedIndex
  } from './chart-interaction';

  interface Props {
    /** Single series, oldest → newest. Ignored when `series` is given. */
    values?: number[];
    /**
     * Two or more named series sharing one x lattice. Values are indexed 1:1 with `labels`;
     * shorter series are padded with gaps. Colours default to the shared series palette.
     */
    series?: ChartSeries[];
    /**
     * X-axis labels (usually dates), aligned index-for-index with `values`. Drawn as ticks
     * (thinned to fit) and used as the read-out heading. Gaps keep their slot, so a label always
     * belongs to the day it came from.
     */
    labels?: string[];
    /**
     * Any CSS color for the single-series line/area/markers. Callers pass a lane token,
     * e.g. `var(--lane-cyan)`. Defaults to the signal accent.
     */
    color?: string;
    /** Rendered height in px, axes included; width fills the container. */
    height?: number;
    /** Soft translucent fill under the line. Single-series only. */
    showArea?: boolean;
    /** Draw a dashed line at the series mean. Single-series only. */
    showAvg?: boolean;
    /** Formats a value for the read-out, aria summary and point labels. */
    formatValue?: (n: number) => string;
    /** Formats a y-axis tick. Defaults to a compact form (12000 → "12k") so the gutter stays thin. */
    formatTick?: (n: number, step: number) => string;
    /** Short metric name used to build the aria summary, e.g. "steps". */
    label?: string;
    /** Unit printed once above the y axis (never repeated on every tick), e.g. "bpm". */
    unit?: string;
    /** Draw x tick labels. Defaults to on whenever `labels` are supplied. */
    xAxis?: boolean;
    /** Draw the labelled y scale. Turn off for micro/decorative uses. */
    yAxis?: boolean;
    /** Show the series key. Defaults to on for multi-series charts. */
    legend?: boolean;
    /**
     * Pinned read-out index — bindable, so a caller's headline number can follow the clicked point.
     * `null` when nothing is pinned.
     */
    selectedIndex?: number | null;
    /** Fired when a click/tap/Enter pins an index. */
    onSelect?: (index: number) => void;
    /**
     * Live hover index — bindable (spec 035). Several charts drawn on ONE x lattice can share this
     * to get a single crosshair through the whole stack, the way Garmin does. Left unbound it is
     * ordinary local state and this chart behaves exactly as it did before.
     */
    hoverIndex?: number | null;
    /**
     * Floating read-out box. Turn it off when the caller renders its own shared read-out for a
     * stack of charts — the crosshair, dots, legend values and aria live region all keep working.
     */
    tooltip?: boolean;
    /**
     * Index of ONE point drawn as visually significant (spec 056): a filled dot with a halo, plus a
     * vertical rule down to the axis. Purely DECORATIVE — it opens no read-out, fires no callback and
     * never touches `selectedIndex`/`hoverIndex`, which remain the interactive pinning mechanism.
     * Use it for "this is the point the card is about" (the week in progress, today's value).
     */
    emphasisIndex?: number | null;
    /**
     * What the emphasis MEANS, in the caller's language — appended to the chart's accessible summary
     * with the point's label and value, so the highlight is never conveyed by colour alone.
     */
    emphasisLabel?: string;
    /**
     * Minimum left plot inset in px. A caller aligning a stack of charts feeds back the widest
     * inset any of them needs, so their plots — and therefore their crosshairs — line up.
     */
    gutterLeft?: number;
    /** Reports the inset THIS chart's own y ticks need, so a caller can compute that maximum. */
    onGutter?: (px: number) => void;
  }

  let {
    values = [],
    series,
    labels,
    color = 'var(--color-accent)',
    height = 200,
    showArea = true,
    showAvg = false,
    formatValue = (n) => n.toLocaleString(),
    formatTick,
    label,
    unit,
    xAxis,
    yAxis = true,
    legend,
    selectedIndex = $bindable(null),
    onSelect,
    hoverIndex = $bindable(null),
    tooltip = true,
    emphasisIndex = null,
    emphasisLabel = 'highlighted',
    gutterLeft = 0,
    onGutter
  }: Props = $props();

  // Measured width → 1:1 pixel coordinate system so point labels, ticks and markers
  // render crisp and undistorted (no non-uniform viewBox stretching).
  let cw = $state(0);
  let wrapperEl: HTMLDivElement | undefined = $state();
  let svgEl: SVGSVGElement | undefined = $state();
  // Axis type size resolved from the token, so tick geometry follows `--text-xs` instead of a
  // hardcoded px. Falls back to a sane 12 wherever computed styles are unavailable (SSR/jsdom).
  let axisFont = $state(12);
  const W = $derived(cw > 0 ? cw : 640);

  // Own id for the reveal clip path: two charts on a page must not share one.
  const uid = $props.id();
  const revealId = `trend-reveal-${uid}`;

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
    const px = parseFloat(getComputedStyle(svgEl).fontSize);
    if (Number.isFinite(px) && px > 0) axisFont = px;
  });

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
  const definedCount = $derived(defined.reduce((c, d) => (d ? c + 1 : c), 0));
  const hasData = $derived(definedCount > 0);

  const stats = $derived.by(() => {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let count = 0;
    for (const s of visible) {
      for (const v of s.values) {
        if (!Number.isFinite(v)) continue;
        if (v < min) min = v;
        if (v > max) max = v;
        sum += v;
        count++;
      }
    }
    return count === 0 ? undefined : { min, max, avg: sum / count, count };
  });

  const flat = $derived(!!stats && stats.min === stats.max);

  // A little headroom above and below so peaks/troughs never touch the frame; a dead-flat series
  // gets a ±1 band so the scale never collapses to zero span.
  const domain = $derived.by(() => {
    if (!stats) return { min: 0, max: 1, span: 1 };
    if (flat) return { min: stats.min - 1, max: stats.max + 1, span: 2 };
    const pad = (stats.max - stats.min) * 0.15;
    const min = stats.min - pad;
    const max = stats.max + pad;
    return { min, max, span: max - min };
  });

  // ---- axes ----
  const showX = $derived(xAxis ?? (labels !== undefined && labels.length > 0));
  const showY = $derived(yAxis);

  const yTicks = $derived(showY && hasData ? niceTicks(domain.min, domain.max, 4) : []);
  const yStep = $derived(yTicks.length > 1 ? (yTicks[1] ?? 0) - (yTicks[0] ?? 0) : 1);
  const tickText = $derived((v: number) => (formatTick ?? formatTickValue)(v, yStep));
  const yTickTexts = $derived(yTicks.map(tickText));

  // Reserved gutters: the y labels get exactly the room their widest tick needs, the x labels a
  // line of their own under the plot.
  //
  // `naturalPlotL` is what THIS chart's own ticks ask for; it never reads `gutterLeft`, so a caller
  // may safely feed the maximum across a stack back in as `gutterLeft` without the two chasing each
  // other (spec 035).
  const naturalPlotL = $derived(
    showY && yTicks.length > 0 ? maxTextWidth(yTickTexts, axisFont) + AXIS_GAP * 2 : W * 0.04
  );
  const plotL = $derived(Math.max(naturalPlotL, gutterLeft > 0 ? gutterLeft : 0));

  $effect(() => {
    onGutter?.(naturalPlotL);
  });
  const padR = $derived(showY ? AXIS_GAP : W * 0.04);
  const plotR = $derived(Math.max(plotL, W - padR));
  const plotW = $derived(Math.max(0, plotR - plotL));

  const topPad = $derived(unit && showY ? axisFont * 2.4 : axisFont * 1.5);
  const bottomPad = $derived(showX ? axisFont * 2 : axisFont * 0.9);
  const plotTop = $derived(topPad);
  const plotBottom = $derived(Math.max(topPad, height - bottomPad));
  const plotH = $derived(Math.max(0, plotBottom - plotTop));

  function xOf(i: number): number {
    return n <= 1 ? plotL + plotW / 2 : plotL + (i / (n - 1)) * plotW;
  }

  function yOf(v: number): number {
    return plotTop + (1 - (v - domain.min) / domain.span) * plotH;
  }

  // Evenly spaced hairlines when the labelled scale is off — the pre-017 look, kept for
  // micro/decorative uses.
  const plainGrid = $derived([0, 1, 2, 3].map((k) => plotTop + (k / 3) * plotH));

  const xLabelW = $derived(maxTextWidth(labels ?? [], axisFont));
  const xTicks = $derived.by(() => {
    if (!showX || !labels || n === 0) return [];
    return axisLabelIndices(labels, n, xOf, xLabelW + TICK_GAP, W).flatMap((i) => {
      const text = labels[i];
      if (text === undefined || text === '') return [];
      const x = xOf(i);
      return [{ i, x, text, anchor: textAnchorAt(x, W, xLabelW) }];
    });
  });
  const xLabelY = $derived(plotBottom + AXIS_GAP + axisFont * 0.8);

  // ---- geometry ----
  interface Pt {
    x: number;
    y: number;
    v: number;
    i: number;
  }

  function finitePoints(s: { values: number[] }): Pt[] {
    return s.values.flatMap((v, i) => (Number.isFinite(v) ? [{ x: xOf(i), y: yOf(v), v, i }] : []));
  }

  /** Line path that lifts the pen over gaps, so a missing day is a break and not a straight lie. */
  function linePathOf(s: { values: number[] }): string {
    let d = '';
    let pen = false;
    s.values.forEach((v, i) => {
      if (!Number.isFinite(v)) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${xOf(i).toFixed(2)},${yOf(v).toFixed(2)} `;
      pen = true;
    });
    return d.trim();
  }

  /** Area fill, one closed run per unbroken stretch of the line. */
  function areaPathOf(s: { values: number[] }): string {
    let d = '';
    let run: Pt[] = [];
    const flush = (): void => {
      const first = run[0];
      const last = run[run.length - 1];
      if (run.length > 1 && first && last) {
        d += `M${first.x.toFixed(2)},${plotBottom.toFixed(2)} `;
        d += run.map((p) => `L${p.x.toFixed(2)},${p.y.toFixed(2)} `).join('');
        d += `L${last.x.toFixed(2)},${plotBottom.toFixed(2)} Z `;
      }
      run = [];
    };
    s.values.forEach((v, i) => {
      if (!Number.isFinite(v)) {
        flush();
        return;
      }
      run.push({ x: xOf(i), y: yOf(v), v, i });
    });
    flush();
    return d.trim();
  }

  interface Drawn {
    key: string;
    color: string;
    line: string;
    area: string;
    count: number;
  }

  const drawn = $derived.by<Drawn[]>(() =>
    visible.map((s, k) => {
      const pts = finitePoints(s);
      return {
        key: s.name || `s${k}`,
        color: s.color,
        line: pts.length > 1 ? linePathOf(s) : '',
        area: showArea && !multi && pts.length > 1 ? areaPathOf(s) : '',
        count: pts.length
      };
    })
  );

  const solo = $derived(visible.length === 1 ? visible[0] : undefined);

  // Min & max markers — single-series only, and suppressed for flat/short series where they'd
  // coincide or fight the read-out for attention.
  const markers = $derived.by(() => {
    if (!solo || flat || definedCount <= 1) return undefined;
    const pts = finitePoints(solo);
    if (pts.length < 2) return undefined;
    let hi = pts[0]!;
    let lo = pts[0]!;
    for (const p of pts) {
      if (p.v > hi.v) hi = p;
      if (p.v < lo.v) lo = p;
    }
    return { hi, lo };
  });

  // A single reading renders as a lone dot.
  const single = $derived.by(() => {
    if (!solo || definedCount !== 1) return undefined;
    return finitePoints(solo)[0];
  });

  /*
    The decorative emphasis (spec 056). Deliberately derived from nothing but `emphasisIndex`: it must
    not react to hover or selection, because a card that says "this point is the week you are in" is
    making a statement about the DATA, not about what the pointer is doing.

    An index outside the lattice, or one whose series has a gap there, yields nothing — an emphasis
    ring floating over a missing sample would be a claim about a value that does not exist.
  */
  const emphasis = $derived.by(() => {
    if (emphasisIndex === null || !Number.isInteger(emphasisIndex)) return undefined;
    if (emphasisIndex < 0 || emphasisIndex >= n) return undefined;
    const points = visible.flatMap((s) => {
      const v = s.values[emphasisIndex];
      return v !== undefined && Number.isFinite(v)
        ? [{ key: s.name || 'series', color: s.color, y: yOf(v), v }]
        : [];
    });
    if (points.length === 0) return undefined;
    return { x: xOf(emphasisIndex), points, label: labels?.[emphasisIndex] ?? '' };
  });

  const avgY = $derived(stats ? yOf(stats.avg) : 0);
  const showAvgLine = $derived(showAvg && !!stats && !!solo && !flat && definedCount > 1);

  /*
    Vertical room a marker label may use: down to the axis line and no further, because the x tick labels
    live under it (spec 031). The top edge is the svg's own, so a peak label keeps using the top padding.
  */
  const markerBand = $derived({ top: 0, bottom: plotBottom });

  // Keep marker labels inside the frame: anchor by horizontal position.
  function anchor(x: number): 'start' | 'middle' | 'end' {
    if (x < W * 0.14) return 'start';
    if (x > W * 0.86) return 'end';
    return 'middle';
  }

  // ---- hover / pin / keyboard read-out (specs 016 + 017; shared hover 035) ----

  // A live hover wins; otherwise the pinned selection keeps the read-out open after pointerleave.
  // The index is snapped to this chart's own nearest DEFINED sample, so a shared hover still reads a
  // real value here even when this particular sensor has a gap at that instant.
  const activeI = $derived.by(() => {
    const i = activeIndex(hoverIndex, selectedIndex, n);
    if (i === null) return null;
    const j = nearestDefinedIndex(i, defined);
    return j < 0 ? null : j;
  });
  const activeX = $derived(activeI === null ? 0 : xOf(activeI));
  const activeLabel = $derived(activeI === null ? undefined : labels?.[activeI]);
  const pinned = $derived(hoverIndex === null && activeI !== null);

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

  const activePoints = $derived(
    activeI === null ? [] : activeValues.map((a) => ({ key: a.name, color: a.color, y: yOf(a.value) }))
  );

  function pick(e: PointerEvent): void {
    const el = wrapperEl;
    if (!el || !hasData) return;
    const x = localX(e.clientX, el.getBoundingClientRect(), W);
    const i = nearestPointIndex(x, { n, padX: plotL, plotW });
    const j = nearestDefinedIndex(i, defined);
    hoverIndex = j < 0 ? null : j;
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
        hoverIndex = stepDefinedIndex(activeI, 1, defined);
        break;
      case 'ArrowLeft':
        hoverIndex = stepDefinedIndex(activeI, -1, defined);
        break;
      case 'Home':
        hoverIndex = edgeDefinedIndex(defined, 'first');
        break;
      case 'End':
        hoverIndex = edgeDefinedIndex(defined, 'last');
        break;
      case 'Enter':
      case ' ':
        commit();
        break;
      case 'Escape':
        hoverIndex = null;
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

  /**
   * The emphasised point spelled out for assistive tech, so the highlight is carried by text and not
   * only by a coloured ring. Appended to the summary below.
   */
  const emphasisSummary = $derived.by(() => {
    if (!emphasis) return '';
    const head = emphasis.label ? `${emphasisLabel} ${emphasis.label}` : emphasisLabel;
    return `, ${head}: ${emphasis.points.map((p) => formatValue(p.v)).join(', ')}`;
  });

  const summary = $derived.by(() => {
    const prefix = label ? `${label} trend` : 'trend';
    if (!hasData || !stats) return `${prefix}, no data`;
    if (multi) {
      const names = resolved.map((s) => s.name).join(', ');
      return `${prefix}, ${resolved.length} series: ${names}, ${definedCount} points, low ${formatValue(stats.min)}, high ${formatValue(stats.max)}${emphasisSummary}`;
    }
    if (definedCount === 1) return `${prefix}, 1 point, value ${formatValue(stats.min)}${emphasisSummary}`;
    const base = `${prefix}, ${definedCount} points, low ${formatValue(stats.min)}, high ${formatValue(stats.max)}`;
    return `${showAvg ? `${base}, avg ${formatValue(stats.avg)}` : base}${emphasisSummary}`;
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

  <!-- The single-series ornaments (markers, avg rule) follow whichever colour that series carries,
       whether it came from `color` or from a one-entry `series`. -->
  <div class="chart" style="--chart-color: {solo?.color ?? color}; height: {height}px;" bind:this={wrapperEl}>
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
      onblur={() => (hoverIndex = null)}
    >
      {#if !hasData}
        <line
          class="placeholder"
          x1={plotL}
          y1={height / 2}
          x2={W - padR}
          y2={height / 2}
          vector-effect="non-scaling-stroke"
        />
        <text class="empty" x={W / 2} y={height / 2} text-anchor="middle">{i18n.t('ui.chartNoData')}</text>
      {:else}
        {#if showY && yTicks.length > 0}
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
        {:else}
          {#each plainGrid as gy (gy)}
            <line class="grid" x1="0" y1={gy} x2={W} y2={gy} vector-effect="non-scaling-stroke" />
          {/each}
        {/if}

        {#if showX}
          <line
            class="axis-line"
            x1={plotL}
            y1={plotBottom}
            x2={plotR}
            y2={plotBottom}
            vector-effect="non-scaling-stroke"
          />
          {#each xTicks as t (t.i)}
            <text class="axis-tick x" x={t.x} y={xLabelY} text-anchor={t.anchor}>{t.text}</text>
          {/each}
        {/if}

        {#if showAvgLine && stats}
          <line class="avg" x1={plotL} y1={avgY} x2={plotR} y2={avgY} vector-effect="non-scaling-stroke" />
          <text class="avg-label" x={plotR} y={avgY - 6} text-anchor="end">
            avg {formatValue(stats.avg)}
          </text>
        {/if}

        {#each drawn as s (s.key)}
          {#if s.area}
            <path class="area" style="--series: {s.color}" d={s.area} />
          {/if}
        {/each}

        <!--
          The lines live inside a wipe: a clip rect that scales open from the left edge. See
          `.reveal` in the styles for why the draw-in is a clip and not a dash animation.
        -->
        <defs>
          <clipPath id={revealId} clipPathUnits="userSpaceOnUse">
            <rect class="reveal" x="0" y="0" width={W} {height} />
          </clipPath>
        </defs>
        <g clip-path="url(#{revealId})">
          {#each drawn as s (s.key)}
            {#if s.line}
              <path class="line" style="--series: {s.color}" d={s.line} vector-effect="non-scaling-stroke" />
            {/if}
          {/each}
        </g>

        {#if single}
          <!-- Single reading: just its point, drawn as a crisp round dot. -->
          <circle class="marker" cx={single.x} cy={single.y} r="4" />
        {/if}

        {#if markers}
          <!-- Max marker + label above, flipping under the point if the top is too tight. The labels
               step back while a read-out is open. -->
          <circle class="marker" cx={markers.hi.x} cy={markers.hi.y} r="4" />
          <text
            class="point-label"
            class:faded={activeI !== null}
            x={markers.hi.x}
            y={markerLabelY(markers.hi.y, 'above', markerBand, axisFont)}
            text-anchor={anchor(markers.hi.x)}
          >
            {formatValue(markers.hi.v)}
          </text>

          <!-- Min marker + label below, flipping above the point rather than onto the date row. -->
          <circle class="marker" cx={markers.lo.x} cy={markers.lo.y} r="4" />
          <text
            class="point-label"
            class:faded={activeI !== null}
            x={markers.lo.x}
            y={markerLabelY(markers.lo.y, 'below', markerBand, axisFont)}
            text-anchor={anchor(markers.lo.x)}
          >
            {formatValue(markers.lo.v)}
          </text>
        {/if}

        {#if emphasis}
          <!-- Decorative emphasis (spec 056): a rule to the axis plus a haloed dot. Drawn UNDER the
               cursor so an active read-out still wins the reader's eye. -->
          <line
            class="emphasis-rule"
            x1={emphasis.x}
            y1={plotTop}
            x2={emphasis.x}
            y2={plotBottom}
            vector-effect="non-scaling-stroke"
          />
          {#each emphasis.points as p (p.key)}
            <circle class="emphasis-halo" style="--series: {p.color}" cx={emphasis.x} cy={p.y} r="9" />
            <circle class="emphasis-dot" style="--series: {p.color}" cx={emphasis.x} cy={p.y} r="4.5" />
          {/each}
        {/if}

        {#if activeI !== null}
          <line
            class="cursor"
            class:pinned
            x1={activeX}
            y1={plotTop}
            x2={activeX}
            y2={plotBottom}
            vector-effect="non-scaling-stroke"
          />
          {#each activePoints as p (p.key)}
            <circle class="cursor-dot" style="--series: {p.color}" cx={activeX} cy={p.y} r="5" />
          {/each}
        {/if}

        <!-- Transparent hit layer: hover or drag anywhere over the chart to read a value, click or
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
          onpointerleave={() => (hoverIndex = null)}
          onpointercancel={() => (hoverIndex = null)}
        />
      {/if}
    </svg>

    {#if tooltip && activeI !== null && tooltipRows.length > 0}
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
    /* Axis type size — read back via getComputedStyle so tick geometry follows the token. */
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

  .grid {
    stroke: var(--color-grid);
    stroke-width: 1;
  }

  .axis-line {
    stroke: var(--color-border);
    stroke-width: 1;
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

  .area {
    stroke: none;
    fill: color-mix(in srgb, var(--series, var(--chart-color)) 16%, transparent);
  }

  .line {
    fill: none;
    stroke: var(--series, var(--chart-color));
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /*
    Draw-in on mount, as a left-to-right wipe of the clip rect.

    This used to be a dash animation (`pathLength="1"` + `stroke-dasharray: 1`), which is the
    idiomatic trick — but it is measured along the stroke, and `vector-effect: non-scaling-stroke`
    moves that measurement into device space while `pathLength` keeps normalising user space. On a
    2× display WebKit therefore ran out of dash halfway along every line and simply stopped drawing
    it, permanently: the tail of every chart was missing and no amount of waiting brought it back.
    A clip wipe carries no length arithmetic at all, so it cannot disagree with the stroke.

    Fail-safe by construction: the rect's resting state is fully open, so a browser that never runs
    the animation shows the whole line rather than half of one.
  */
  .reveal {
    animation: trend-reveal var(--duration-slow) var(--ease-out) forwards;
    /* A length pair, not a keyword: x=0 is the left edge under either `transform-box`. */
    transform-origin: 0 0;
  }

  @keyframes trend-reveal {
    from {
      transform: scaleX(0);
    }
    to {
      transform: scaleX(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .reveal {
      animation: none;
    }
  }

  .marker {
    fill: var(--chart-color);
    stroke: var(--color-surface);
    stroke-width: 2;
  }

  .avg {
    stroke: color-mix(in srgb, var(--chart-color) 60%, transparent);
    stroke-width: 1;
    stroke-dasharray: 5 4;
  }

  .avg-label {
    fill: var(--color-text-muted);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    font-feature-settings: var(--numeric);
  }

  .point-label {
    fill: var(--color-text);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    font-feature-settings: var(--numeric);
    transition: opacity var(--transition-fast);
  }

  .point-label.faded {
    opacity: 0.25;
  }

  /* Decorative emphasis: quieter than the pinned cursor, louder than the grid. */
  .emphasis-rule {
    stroke: var(--color-border-strong);
    stroke-width: 1;
  }

  .emphasis-halo {
    fill: color-mix(in srgb, var(--series, var(--chart-color)) 22%, transparent);
    stroke: none;
  }

  .emphasis-dot {
    fill: var(--series, var(--chart-color));
    stroke: var(--color-surface);
    stroke-width: 2;
  }

  .cursor {
    stroke: var(--color-border-strong);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  /* Pinned: a solid rule reads as "this stays" where the dashed hover rule reads as "passing through". */
  .cursor.pinned {
    stroke: var(--color-accent-line);
    stroke-dasharray: none;
  }

  .cursor-dot {
    fill: var(--series, var(--chart-color));
    stroke: var(--color-surface);
    stroke-width: 2;
  }

  .hit {
    fill: transparent;
    cursor: crosshair;
    touch-action: pan-y;
  }

  .placeholder {
    stroke: var(--color-grid);
    stroke-width: 1;
    stroke-dasharray: 3 3;
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
