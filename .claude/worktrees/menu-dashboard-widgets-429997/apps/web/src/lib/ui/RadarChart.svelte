<script lang="ts" module>
  /** One spoke of a radar. `value` is already normalised — the chart knows nothing about domains. */
  export interface RadarAxis {
    /** Stable key, used as the `{#each}` key. */
    key: string;
    /** Short label drawn outside the spoke. */
    label: string;
    /**
     * Position along the spoke, `0..1` (clamped). **`null` means "brak danych"** — the axis is drawn
     * dashed and left out of the polygon, never plotted as a zero.
     */
    value: number | null;
  }
</script>

<script lang="ts">
  /**
   * RadarChart — the app's one N-spoke profile shape (spec 033), extracted from the cycling
   * rider-type pentagon so running (and anything after it) draws the *same* instrument rather than a
   * second inline copy.
   *
   * Presentational and domain-free: callers normalise their own units (W/kg against a Coggan
   * reference, pace against a scale) to `0..1` and hand over labels. That keeps reference scales in
   * the module that owns them and keeps `lib/ui` free of sport knowledge.
   *
   * HONESTY IS THE POINT. A missing axis is `null`, not `0`: it draws a dashed spoke and drops out of
   * the polygon, and under three defined axes no polygon is drawn at all — a two-point "shape" would
   * read as a profile while carrying none.
   */
  interface Props {
    axes: readonly RadarAxis[];
    /** Accessible name for the whole figure. */
    ariaLabel: string;
    /** Radius of the outer ring, in SVG units. The box grows around it to fit the labels. */
    radius?: number;
    /**
     * Horizontal room reserved for the outside labels. Left unset, the chart measures its own
     * labels and reserves what the longest one actually needs (see `autoLabelSpace`) — pass a
     * number only to force a specific gutter.
     */
    labelSpace?: number;
    /** Any CSS colour for the plotted shape — pass a token, e.g. `var(--lane-orange)`. */
    color?: string;
    /** Ring fractions, outermost last. */
    levels?: readonly number[];
  }

  let {
    axes,
    ariaLabel,
    radius = 90,
    labelSpace,
    color = 'var(--color-accent)',
    levels = [0.25, 0.5, 0.75, 1]
  }: Props = $props();

  /** The vertical labels sit closer than the horizontal ones, so the box is taller than 2R by less. */
  const PAD_Y = 26;

  /** Where a label sits along its spoke, as a fraction of the radius. */
  const LABEL_R = 1.14;
  /**
   * Upper-bound advance width of one character of `.label` (10px, uppercase, `--tracking-wide`), in
   * SVG user units — measured against the widest real label in the app, Polish diacritics included.
   */
  const LABEL_CH = 7;
  /** Never draw a gutter tighter than this, however short the labels are. */
  const MIN_LABEL_SPACE = 96;

  /**
   * How much horizontal room the labels actually need (spec 034). Callers used to have to know:
   * cycling's labels carry their duration ("WYTRZYMAŁOŚĆ (60 MIN)") and ran off the left edge of a
   * gutter sized for a bare "WYTRZYMAŁOŚĆ". A label on spoke i is anchored at
   * `cx ± LABEL_R·r·cos θ` and grows outward, so the gutter it needs is its own width minus the
   * part of the radius the anchor already spends going that way.
   */
  const autoLabelSpace = $derived(
    Math.max(
      MIN_LABEL_SPACE,
      ...axes.map((axis, i) => {
        const angle = -Math.PI / 2 + (i / Math.max(1, axes.length)) * Math.PI * 2;
        const width = axis.label.length * LABEL_CH;
        // Middle-anchored (top/bottom) labels spread both ways from the spoke, so only half counts.
        const reach = Math.abs(Math.cos(angle)) < 0.05 ? width / 2 : width;
        return reach + LABEL_R * radius * Math.abs(Math.cos(angle)) - radius + 4;
      })
    )
  );

  const gutter = $derived(labelSpace ?? autoLabelSpace);

  const cx = $derived(gutter + radius);
  const cy = $derived(PAD_Y + radius);
  const boxW = $derived(2 * (gutter + radius));
  const boxH = $derived(2 * (PAD_Y + radius));

  const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

  /** Spoke `i` at `frac` of the radius. Spoke 0 points straight up; the rest go clockwise. */
  function point(i: number, frac: number): { x: number; y: number } {
    const angle = -Math.PI / 2 + (i / Math.max(1, axes.length)) * Math.PI * 2;
    return { x: cx + Math.cos(angle) * radius * frac, y: cy + Math.sin(angle) * radius * frac };
  }

  const fmt = (p: { x: number; y: number }): string => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;

  function ringPoints(level: number): string {
    return axes.map((_, i) => fmt(point(i, level))).join(' ');
  }

  const plotted = $derived(
    axes
      .map((a, i) => (a.value == null ? null : point(i, clamp01(a.value))))
      .filter((p): p is { x: number; y: number } => p !== null)
  );

  /** Under three points there is no shape worth drawing — only a misleading sliver. */
  const polygon = $derived(plotted.length >= 3 ? plotted.map(fmt).join(' ') : '');

  function labelPos(i: number): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
    const p = point(i, 1.14);
    return {
      x: p.x,
      y: p.y,
      anchor: p.x < cx - 4 ? 'end' : p.x > cx + 4 ? 'start' : 'middle'
    };
  }
</script>

<svg
  class="radar"
  viewBox="0 0 {boxW} {boxH}"
  style={`--radar-color: ${color}; --radar-max: ${boxW}px`}
  role="img"
  aria-label={ariaLabel}
>
  {#each levels as level (level)}
    <polygon class="ring" points={ringPoints(level)} />
  {/each}

  {#each axes as axis, i (axis.key)}
    {@const end = point(i, 1)}
    <line class="spoke" class:missing={axis.value == null} x1={cx} y1={cy} x2={end.x} y2={end.y} />
    {@const label = labelPos(i)}
    <text class="label" class:missing={axis.value == null} x={label.x} y={label.y} text-anchor={label.anchor}
      >{axis.label}</text
    >
  {/each}

  {#if polygon}
    <polygon class="shape" points={polygon} />
    {#each plotted as p, i (i)}
      <circle class="vertex" cx={p.x} cy={p.y} r="2.6" />
    {/each}
  {/if}
</svg>

<style>
  .radar {
    display: block;
    width: 100%;
    max-width: var(--radar-max);
    height: auto;
    margin: 0 auto;
  }

  .ring {
    fill: none;
    stroke: var(--color-grid);
    stroke-width: 1;
  }

  .spoke {
    stroke: var(--color-border);
    stroke-width: 1;
  }

  /* An axis we could not compute: dashed spoke, muted label — visibly not a zero. */
  .spoke.missing {
    stroke-dasharray: 2 3;
  }

  .label {
    font-size: 10px;
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-wide);
    fill: var(--color-text-muted);
    text-transform: uppercase;
    dominant-baseline: middle;
  }

  .label.missing {
    fill: var(--color-text-subtle);
  }

  .shape {
    fill: color-mix(in srgb, var(--radar-color) 22%, transparent);
    stroke: var(--radar-color);
    stroke-width: 1.6;
    stroke-linejoin: round;
  }

  .vertex {
    fill: var(--radar-color);
  }
</style>
