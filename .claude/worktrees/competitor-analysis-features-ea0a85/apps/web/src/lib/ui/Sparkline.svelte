<script lang="ts">
  interface Props {
    /** Ordered series, oldest → newest. */
    values: number[];
    /**
     * Any CSS color for the line/area. Callers pass a lane token,
     * e.g. `var(--lane-cyan)`. Defaults to the signal accent.
     */
    color?: string;
    /** Rendered height in px; width fills the container. */
    height?: number;
    /** Short metric name used to build the aria summary, e.g. "steps". */
    label?: string;
    /** Soft translucent fill under the line. */
    showArea?: boolean;
    /** Optional reference value drawn as a faint dashed line. */
    baseline?: number;
  }

  let {
    values,
    color = 'var(--color-accent)',
    height = 40,
    label,
    showArea = false,
    baseline
  }: Props = $props();

  // Fixed internal x-domain; the viewBox + non-scaling stroke keep it crisp at any width.
  const W = 100;

  // Own id for the reveal clip path: two sparklines on a page must not share one.
  const uid = $props.id();
  const revealId = `spark-reveal-${uid}`;

  const clean = $derived(values.filter((v) => Number.isFinite(v)));
  const n = $derived(clean.length);
  const latest = $derived(n > 0 ? clean[n - 1] : undefined);

  // Vertical breathing room so peaks/troughs never touch the edges.
  const padTop = $derived(height * 0.14);
  const padBottom = $derived(height * 0.14);
  const plotH = $derived(Math.max(0, height - padTop - padBottom));

  // Domain includes the baseline so a reference line stays on-canvas.
  const domain = $derived.by(() => {
    const pool = baseline === undefined ? clean : [...clean, baseline];
    const min = Math.min(...pool);
    const max = Math.max(...pool);
    return { min, max, flat: max === min };
  });

  function x(i: number): number {
    return n <= 1 ? W / 2 : (i / (n - 1)) * W;
  }

  function y(v: number): number {
    if (domain.flat) return padTop + plotH / 2;
    const t = (v - domain.min) / (domain.max - domain.min);
    return padTop + (1 - t) * plotH;
  }

  const points = $derived(clean.map((v, i) => ({ x: x(i), y: y(v) })));

  const linePath = $derived(
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
  );

  const first = $derived(points[0] ?? { x: 0, y: height / 2 });
  const last = $derived(points[points.length - 1] ?? { x: W / 2, y: height / 2 });

  const areaPath = $derived(
    points.length > 1 ? `${linePath} L${last.x.toFixed(2)},${height} L${first.x.toFixed(2)},${height} Z` : ''
  );

  const baselineY = $derived(baseline === undefined ? undefined : y(baseline));

  // A zero-length, round-capped subpath renders as a perfect circle in screen
  // space — immune to the non-uniform x-scaling that would flatten a <circle>.
  const dotPath = $derived(
    `M${last.x.toFixed(2)},${last.y.toFixed(2)} L${last.x.toFixed(2)},${last.y.toFixed(2)}`
  );

  const summary = $derived.by(() => {
    const prefix = label ? `${label} trend` : 'trend';
    if (n === 0) return `${prefix}, no data`;
    return `${prefix}, ${n} point${n === 1 ? '' : 's'}, latest ${latest!.toLocaleString()}`;
  });
</script>

{#if n === 0}
  <!-- Placeholder keeps layout stable and stays announceable. -->
  <svg
    class="spark"
    style="--spark-color: {color}; height: {height}px;"
    viewBox="0 0 {W} {height}"
    preserveAspectRatio="none"
    role="img"
    aria-label={summary}
  >
    <line
      class="placeholder"
      x1="0"
      y1={height / 2}
      x2={W}
      y2={height / 2}
      vector-effect="non-scaling-stroke"
    />
  </svg>
{:else}
  <svg
    class="spark"
    style="--spark-color: {color}; height: {height}px;"
    viewBox="0 0 {W} {height}"
    preserveAspectRatio="none"
    role="img"
    aria-label={summary}
  >
    {#if baselineY !== undefined}
      <line class="baseline" x1="0" y1={baselineY} x2={W} y2={baselineY} vector-effect="non-scaling-stroke" />
    {/if}

    {#if showArea && areaPath}
      <path class="area" d={areaPath} />
    {/if}

    {#if points.length > 1}
      <!-- Wipe-based draw-in; see `.reveal` in the styles. -->
      <defs>
        <clipPath id={revealId} clipPathUnits="userSpaceOnUse">
          <rect class="reveal" x="0" y="0" width={W} {height} />
        </clipPath>
      </defs>
      <g clip-path="url(#{revealId})">
        <path class="line" d={linePath} vector-effect="non-scaling-stroke" />
      </g>
    {/if}

    <!-- Emphasise the latest reading; also the whole shape for a single point. -->
    <path class="dot" d={dotPath} vector-effect="non-scaling-stroke" fill="none" />
  </svg>
{/if}

<style>
  .spark {
    display: block;
    width: 100%;
    overflow: visible;
  }

  .line {
    fill: none;
    stroke: var(--spark-color);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /*
    Draw-in on mount, as a left-to-right wipe of the clip rect — never a dash animation. A dash is
    measured along the stroke, and `non-scaling-stroke` measures the stroke in device space while
    `pathLength` normalises user space; WebKit resolves that disagreement by dropping the tail of
    the line for good (see the longer note in TrendChart). The rect rests fully open, so a browser
    that skips the animation still shows the whole line.
  */
  .reveal {
    animation: spark-reveal var(--duration-slow) var(--ease-out) forwards;
    /* A length pair, not a keyword: x=0 is the left edge under either `transform-box`. */
    transform-origin: 0 0;
  }

  @keyframes spark-reveal {
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

  .area {
    stroke: none;
    fill: color-mix(in srgb, var(--spark-color) 18%, transparent);
  }

  .dot {
    fill: none;
    stroke: var(--spark-color);
    stroke-width: 5;
    stroke-linecap: round;
  }

  .baseline {
    stroke: color-mix(in srgb, var(--spark-color) 45%, transparent);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }

  .placeholder {
    stroke: var(--color-grid);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
</style>
