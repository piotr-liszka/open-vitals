<script lang="ts">
  import type { Snippet } from 'svelte';
  import { readoutStep } from './readout-fit';

  type Direction = 'up' | 'down' | 'flat';
  type Lane = 'orange' | 'red' | 'indigo' | 'cyan' | 'green' | 'amber' | 'sky' | 'teal' | 'violet' | 'lime';

  interface Props {
    label: string;
    value: string | number;
    /** Unit suffixed to the readout, e.g. 'bpm' or '%'. */
    unit?: string;
    /** Metric lane colour — tints the tile's border/glow and the icon (spec 040). */
    accent?: Lane;
    /** Signed change; sign drives the trend direction/colour. */
    delta?: number | undefined;
    /** Unit appended to the delta, e.g. '%' or ' bpm'. */
    deltaSuffix?: string;
    /** Force a direction instead of deriving it from `delta`. */
    trend?: Direction;
    /**
     * Which direction is "good" for this metric. When set, the delta is coloured by whether the
     * actual move is good (success) or bad (danger) — e.g. a falling resting HR is good. The arrow
     * still shows the true direction. Omit to colour purely by sign (up = success, down = danger).
     */
    goodWhen?: 'up' | 'down' | undefined;
    /** Optional leading icon. */
    icon?: Snippet;
    /** Optional trend chart rendered along the bottom (usually a Sparkline). */
    sparkline?: Snippet;
    /** Renders the readout as an intentional "no data" state (muted, not broken). */
    muted?: boolean;
  }

  let {
    label,
    value,
    unit,
    accent,
    delta,
    deltaSuffix = '',
    trend,
    goodWhen,
    icon,
    sparkline,
    muted = false
  }: Props = $props();

  const direction = $derived<Direction | undefined>(
    trend ?? (delta === undefined ? undefined : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat')
  );

  // Colour class: by health meaning when `goodWhen` is set (reusing up=good/down=bad palette),
  // otherwise by raw sign. Arrow always follows `direction`.
  const toneClass = $derived<Direction | undefined>(
    direction === undefined || goodWhen === undefined || direction === 'flat'
      ? direction
      : direction === goodWhen
        ? 'up'
        : 'down'
  );

  const deltaText = $derived(delta === undefined ? '' : `${delta > 0 ? '+' : ''}${delta}${deltaSuffix}`);

  const arrow = $derived(direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→');

  const laneVar = $derived(accent ? `var(--lane-${accent})` : undefined);

  // Long readouts ("6 h 52 min") step down a size instead of spilling past the tile border (spec 029).
  // The step is a function of the rendered string's LENGTH only, never of the tile's own width or the
  // exact glyphs in a particular value — so two tiles carrying values of the same length always render
  // at the same size in the same grid (spec 040 — a per-value, per-width continuous scale used to make
  // e.g. "30:26" and "4.94" render at visibly different sizes side by side, which read as broken, not
  // "fitted"). A tile narrower than the token needs still gets a size-safe fallback, but that fallback
  // is a fixed per-width step (below, in CSS), not a per-value one.
  const step = $derived(readoutStep(value, muted ? undefined : unit));

  const tileStyle = $derived(laneVar ? `--tile-accent: ${laneVar}` : '');
</script>

<div class="tile" class:has-accent={Boolean(accent)} style={tileStyle}>
  <div class="top">
    <span class="label">
      <span class="label-text">{label}</span>
    </span>
    {#if icon}<span class="icon" aria-hidden="true">{@render icon()}</span>{/if}
  </div>

  <div class="readout step-{step}">
    <span class="value" class:muted>{value}</span>
    {#if unit && !muted}<span class="unit">{unit}</span>{/if}
    {#if muted}<span class="sr-only">No data yet</span>{/if}
  </div>

  {#if direction !== undefined && delta !== undefined}
    <div class="delta {toneClass}">
      <span class="arrow" aria-hidden="true">{arrow}</span>
      <span>{deltaText}</span>
    </div>
  {/if}

  {#if sparkline}
    <div class="spark">{@render sparkline()}</div>
  {/if}
</div>

<style>
  .tile {
    /* Neutral by default; an `accent` prop overrides this inline (see `tileStyle` above) so the
       card itself carries the metric's lane colour — a coloured border + glow, not a dot next to
       the label (spec 040). */
    --tile-accent: var(--color-border);
    /*
      The tile measures itself (spec 031). Its inline size comes from the page's grid and never from
      its contents, so `inline-size` containment is free here — it backs the readout's narrow-column
      fallback below.
    */
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-5);
    background: var(--color-surface);
    border: 1px solid var(--tile-accent);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    transition: box-shadow var(--transition-base);
  }

  /* The accent lives on the card, not on a marker dot next to the label (spec 040): a coloured
     border plus a soft accent-tinted glow around it. */
  .tile.has-accent {
    box-shadow:
      var(--shadow-sm),
      0 0 0 3px color-mix(in srgb, var(--tile-accent) 14%, transparent);
  }

  .top {
    display: flex;
    /* The label owns two lines; the icon rides its first one rather than the block's middle. */
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-2);
    min-width: 0;
  }

  .label {
    display: inline-flex;
    align-items: flex-start;
    gap: var(--space-2);
    min-width: 0;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    line-height: var(--leading-snug);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
    /*
      Two lines' worth of room, always. Tiles sit side by side in a grid, so a label that wraps must
      not make its own tile taller than its neighbours or push its readout off the row (spec 049).
    */
    min-height: calc(var(--text-xs) * var(--leading-snug) * 2);
    /* Last-resort guard: a word too long even at the floor breaks instead of escaping the tile. */
    overflow-wrap: anywhere;
  }

  /* Clamped to the two lines the tile reserves: a third line would grow the tile again. */
  .label-text {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    min-width: 0;
  }

  .icon {
    display: inline-flex;
    color: var(--tile-accent);
    line-height: 0;
  }

  .readout {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
    /* The tile border is a hard boundary: an absurd value clips here rather than escaping (spec 029). */
    overflow: hidden;
  }

  /*
    Readout step (spec 029). The size follows the length of what is actually rendered, so a duration
    ("6 h 52 min") shrinks instead of overflowing while a step count keeps the hero size. The unit
    follows the value down so the pairing stays balanced.
  */
  .readout.step-xl {
    --tile-readout: var(--readout-xl);
    --tile-readout-unit: var(--readout-unit);
  }
  .readout.step-lg {
    --tile-readout: var(--readout-lg);
    --tile-readout-unit: var(--readout-unit);
  }
  .readout.step-md {
    --tile-readout: var(--readout-md);
    --tile-readout-unit: var(--text-md);
  }
  .readout.step-sm {
    --tile-readout: var(--readout-sm);
    --tile-readout-unit: var(--text-base);
  }

  .value {
    font-size: var(--tile-readout, var(--readout-xl));
    font-weight: var(--font-black);
    line-height: var(--leading-tight);
    letter-spacing: var(--tracking-tight);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
    /* Long readouts ("12h 05m", "11 238") shrink with the viewport rather than wrapping mid-number. */
    min-width: 0;
    white-space: nowrap;
  }

  .value.muted {
    color: var(--color-text-subtle);
    font-weight: var(--font-bold);
  }

  .unit {
    font-size: var(--tile-readout-unit, var(--readout-unit));
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  /*
    Narrow-column fallback (spec 031, revised spec 040). Every tile in a grid shares the same column
    width, so this steps `--tile-readout`/`--tile-readout-unit` down by CONTAINER WIDTH ALONE — never by
    the value's own characters. Two tiles at the same width and the same readout step (above) therefore
    always render identically, whatever the value's content is; only a tile whose column is genuinely too
    narrow for its step (not "genuinely too narrow for this exact string") shrinks, and it shrinks to the
    next fixed token rather than a continuous, per-value scale. `overflow: hidden` on `.readout` remains
    the hard backstop for anything still too long at the floor.

    (The previous mechanism computed a per-value scale from the string's own glyphs — which is why
    "30:26" and "4.94" could render at visibly different sizes side by side in the same grid: same step,
    different glyph mix, different scale. That was the bug; this section is the fix.)
  */
  @container (max-width: 200px) {
    .readout.step-xl {
      --tile-readout: var(--readout-lg);
      --tile-readout-unit: var(--readout-unit);
    }
    .readout.step-lg {
      --tile-readout: var(--readout-md);
      --tile-readout-unit: var(--text-md);
    }
    .readout.step-md {
      --tile-readout: var(--readout-sm);
      --tile-readout-unit: var(--text-base);
    }
  }

  @container (max-width: 140px) {
    .readout.step-xl {
      --tile-readout: var(--readout-md);
      --tile-readout-unit: var(--text-md);
    }
    .readout.step-lg {
      --tile-readout: var(--readout-sm);
      --tile-readout-unit: var(--text-base);
    }
    /* Micro-caps get a little more room back once the readout itself has already stepped down. */
    .label {
      font-size: calc(var(--text-xs) * 0.85);
    }
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

  .delta {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    font-feature-settings: var(--numeric);
    width: fit-content;
  }

  .delta.up {
    color: var(--color-success);
  }
  .delta.down {
    color: var(--color-danger);
  }
  .delta.flat {
    color: var(--color-text-muted);
  }

  .arrow {
    line-height: 1;
  }

  .spark {
    margin-top: var(--space-1);
  }
</style>
