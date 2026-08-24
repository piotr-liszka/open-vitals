<script lang="ts">
  import type { Snippet } from 'svelte';
  import { labelFitScale, readoutFitScale, readoutStep } from './readout-fit';

  type Direction = 'up' | 'down' | 'flat';
  type Lane = 'orange' | 'red' | 'indigo' | 'cyan' | 'green' | 'amber' | 'sky' | 'teal' | 'violet' | 'lime';

  interface Props {
    label: string;
    value: string | number;
    /** Unit suffixed to the readout, e.g. 'bpm' or '%'. */
    unit?: string;
    /** Metric lane colour — tints the label marker and the readout accent. */
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
  const step = $derived(readoutStep(value, muted ? undefined : unit));

  /*
    …and the step is capped again by the tile's own width (spec 031). The tile is an inline-size
    container, so these two scales let the CSS ask "how big can this string be here?" — the readout
    tokens follow the viewport, which says nothing about a 118px column in an `auto-fit` grid.
  */
  const readoutScale = $derived(readoutFitScale(value, muted ? undefined : unit));
  const labelScale = $derived(labelFitScale(label));

  const tileStyle = $derived(
    [
      laneVar ? `--tile-accent: ${laneVar}` : '',
      `--readout-scale: ${readoutScale}`,
      `--label-scale: ${labelScale}`
    ]
      .filter(Boolean)
      .join('; ')
  );
</script>

<div class="tile" class:has-accent={Boolean(accent)} class:has-icon={Boolean(icon)} style={tileStyle}>
  <div class="top">
    <span class="label">
      {#if accent}<span class="marker" aria-hidden="true"></span>{/if}
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
    --tile-accent: var(--color-accent);
    /*
      The tile measures itself (spec 031). Its inline size comes from the page's grid and never from
      its contents, so `inline-size` containment is free here — and it gives the readout and the label
      the one number the tokens cannot know: how much room this particular tile has.
    */
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-5);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
  }

  .top {
    display: flex;
    /* The label owns two lines; the icon rides its first one rather than the block's middle. */
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-2);
    min-width: 0;
  }

  /* What the label's own line loses to the accent dot and the optional trailing icon. */
  .tile.has-accent {
    --label-reserve: calc(var(--space-2) * 2);
  }
  .tile.has-icon {
    --label-reserve: var(--space-6);
  }
  .tile.has-accent.has-icon {
    --label-reserve: calc(var(--space-6) + var(--space-2) * 2);
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
      Measured against the TOKEN rather than `1em`, so the container-query fit below — which can
      shrink one tile's label and not the next one's — cannot reintroduce the mismatch.
    */
    min-height: calc(var(--text-xs) * var(--leading-snug) * 2);
    /* Last-resort guard under the fit below: a word too long even at the floor breaks instead of escaping. */
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

  .marker {
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--tile-accent);
    flex-shrink: 0;
    /* Optically centred on the label's first line, not on the whole block. */
    margin-top: calc((var(--text-xs) * var(--leading-snug) - var(--space-2)) / 2);
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
    Container-relative fit (spec 031) — everything above sizes off tokens alone, this narrows it to the
    tile. Gated on `@supports`, and placed after the base rules so it wins where it applies: a custom
    property holding a unit the browser does not know computes to *inherit*, not to the declaration above
    it, so without the gate a pre-container-query browser would render the hero readout at body size.
    Inside the gate the token still caps every size — the tile's width can only ever shrink type that
    would otherwise spill past the border.
  */
  @supports (container-type: inline-size) {
    .readout {
      /* `--space-2` pays for the gap between the value and its unit. */
      --readout-fit: calc((100cqw - var(--space-2)) * var(--readout-scale, 1));
      --readout-size: min(var(--tile-readout, var(--readout-xl)), var(--readout-fit));
    }

    .value {
      font-size: var(--readout-size);
    }

    /* Follows the value down whichever way it shrank — by step token, or by tile width. */
    .unit {
      font-size: min(var(--tile-readout-unit, var(--readout-unit)), calc(var(--readout-size) * 0.45));
    }

    /*
      Micro-caps shrink to fit before they break: a single long word ("PRZEWYŻSZENIE") has no wrap
      opportunity, so in a narrow column it used to run past the tile border. Floored at 0.72 of the
      token — below that the word wraps instead, which reads better than illegible caps.
    */
    .label {
      font-size: max(
        calc(var(--text-xs) * 0.72),
        min(var(--text-xs), calc((100cqw - var(--label-reserve, 0px)) * var(--label-scale, 1)))
      );
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
