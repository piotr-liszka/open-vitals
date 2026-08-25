<script lang="ts">
  /**
   * A horizontal band of proportional segments with optional point markers (spec 085).
   *
   * Presentational and unit-free: every position is a fraction of the strip's own width, so the
   * caller owns the axis — seconds, metres, whatever it is measuring — and this only draws. That is
   * what lets it sit above a chart stack and line up with it: pass the chart's plot insets as
   * `insetLeft`/`insetRight` and a segment at 0.5 lands under the chart's midpoint.
   *
   * It is deliberately NOT a chart: no scale, no ticks, no interaction. A strip answers "what came
   * after what, and for how long", which is a question about structure, not about values.
   */
  export interface TimelineSegment {
    /** Stable key for the keyed `{#each}`. */
    key: string;
    /** Start and end as fractions of the strip, 0–1. Values outside are clamped, not dropped. */
    start: number;
    end: number;
    /** Any CSS colour — callers pass a lane token, e.g. `var(--lane-orange)`. */
    color: string;
    /** Drawn inside the segment when it is wide enough, and always exposed to assistive tech. */
    label: string;
  }

  export interface TimelineMarker {
    key: string;
    /** Position as a fraction of the strip, 0–1. */
    at: number;
    color: string;
    label: string;
  }

  interface Props {
    segments: readonly TimelineSegment[];
    markers?: readonly TimelineMarker[];
    /** Left inset in px, so the strip's 0 sits where an aligned chart's plot starts. */
    insetLeft?: number;
    /** Right inset in px, mirroring the chart's own right pad. */
    insetRight?: number;
    ariaLabel: string;
    /**
     * The chart stack's shared active moment, as a fraction of the strip, 0–1. `null`/absent draws no
     * line — kept in the same units as `segments` so a caller can hand it the identical fraction it
     * already computed for those, and the strip reads as one more lane under the same rule the charts
     * draw, rather than a diagram that stops tracking the pointer at the chart's own edge.
     */
    cursor?: number | null;
    /** Solid for a pinned moment, dashed for a live hover passing through — mirrors `TrendChart`'s cursor. */
    cursorPinned?: boolean;
  }

  let {
    segments,
    markers = [],
    insetLeft = 0,
    insetRight = 0,
    ariaLabel,
    cursor = null,
    cursorPinned = false
  }: Props = $props();

  const clamp = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

  /**
   * A fraction as a percentage string, rounded. Unrounded it writes `19.999999999999996%` into the
   * DOM — the same picture, an unreadable attribute, and a diff that churns on every re-render.
   */
  const pct = (n: number): string => `${Math.round(clamp(n) * 1e8) / 1e6}%`;

  function widthOf(segment: TimelineSegment): string {
    return pct(Math.max(0, clamp(segment.end) - clamp(segment.start)));
  }
</script>

<div class="strip" style="--inset-left: {insetLeft}px; --inset-right: {insetRight}px">
  <ul class="track" aria-label={ariaLabel}>
    {#each segments as segment (segment.key)}
      <li
        class="timeline-segment"
        style="--lane: {segment.color}; left: {pct(segment.start)}; width: {widthOf(segment)}"
        title={segment.label}
      >
        <span class="timeline-segment-label">{segment.label}</span>
      </li>
    {/each}
    {#each markers as marker (marker.key)}
      <li class="timeline-marker" style="--lane: {marker.color}; left: {pct(marker.at)}" title={marker.label}>
        <span class="sr-only">{marker.label}</span>
      </li>
    {/each}
    {#if cursor !== null}
      <li class="cursor-line" class:pinned={cursorPinned} style="left: {pct(cursor)}" aria-hidden="true"></li>
    {/if}
  </ul>
</div>

<style>
  .strip {
    width: 100%;
    padding-left: var(--inset-left);
    padding-right: var(--inset-right);
  }

  .track {
    position: relative;
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;
    height: var(--space-6);
    border-radius: var(--radius-sm);
    background: var(--color-surface-2);
    overflow: hidden;
  }

  .timeline-segment {
    position: absolute;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 1px;
    padding: 0 var(--space-1);
    /* A tint, not the raw lane colour: the strip sits above the charts and must not out-shout the
       lines it is there to be read against. */
    background: color-mix(in srgb, var(--lane) 34%, transparent);
    border-left: 1px solid var(--lane);
    overflow: hidden;
  }

  .timeline-segment-label {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    line-height: var(--leading-tight);
    color: var(--color-text-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: clip;
  }

  /* A step with no time extent gets a rule, never a block: it has no width anyone could know. */
  .timeline-marker {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: var(--lane);
  }

  /* The chart stack's shared active moment, carried down onto the strip (spec 085 follow-up). Dashed
     while a live hover passes through, solid once pinned — the same distinction `TrendChart` draws. */
  .cursor-line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 0;
    border-left: 1px dashed var(--color-border-strong);
    pointer-events: none;
  }

  .cursor-line.pinned {
    border-left: 1px solid var(--color-accent-line);
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
