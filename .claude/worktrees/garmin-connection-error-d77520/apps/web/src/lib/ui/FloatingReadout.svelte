<script lang="ts">
  /**
   * A read-out bar that floats above the page instead of sitting in it (spec 052).
   *
   * It exists because a crosshair read-out that lives in the document flow *moves the thing you are
   * pointing at*: the moment the pointer touches a chart the strip fills with values, grows by a
   * couple of lines and shoves the chart stack down. So this bar is `position: fixed`, pinned to the
   * bottom of the viewport — the page underneath measures exactly the same whether it is open or not.
   *
   * It is deliberately inert: `pointer-events: none` all the way down, so it can never steal the
   * hover that is feeding it, and `aria-hidden` because the owner keeps a persistent `aria-live`
   * region (a live region has to be in the DOM *before* its content changes to be announced, and
   * this element mounts and unmounts with the hover).
   */

  export interface FloatingReadoutItem {
    /** Stable key for the keyed each — usually the source chart's key. */
    key: string;
    label: string;
    /** Pre-formatted value; the caller owns its number formatting. */
    value: string;
    /** Suffix printed small after the value, e.g. `bpm`. */
    unit?: string | undefined;
    /** Swatch colour, e.g. `var(--lane-cyan)`. Omit for no swatch. */
    color?: string | undefined;
  }

  interface Props {
    /** Mounts (and animates in) the bar. Keep it false whenever nothing is active. */
    open: boolean;
    /** The headline — the moment being read out, e.g. an elapsed clock. */
    lead: string;
    /** Optional second headline, e.g. the distance at that moment. */
    secondary?: string | undefined;
    items: FloatingReadoutItem[];
  }

  let { open, lead, secondary, items }: Props = $props();
</script>

{#if open}
  <div class="readout-float" aria-hidden="true">
    <div class="bar">
      <p class="at">
        <span class="at-time">{lead}</span>
        {#if secondary}
          <span class="at-sep">·</span>
          <span class="at-dist">{secondary}</span>
        {/if}
      </p>
      {#if items.length > 0}
        <ul class="values">
          {#each items as item (item.key)}
            <li>
              <span class="v-label" style="--lane: {item.color ?? 'var(--color-accent)'}">{item.label}</span>
              <span class="v-value"
                >{item.value}{#if item.unit}<small>{item.unit}</small>{/if}</span
              >
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
{/if}

<style>
  .readout-float {
    position: fixed;
    bottom: var(--space-6);
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-toast);
    /* Never wider than the viewport, never wider than a readable bar. */
    max-width: min(var(--container-max), calc(100vw - var(--space-8)));
    /* The whole layer is inert: it hovers over the very charts that drive it. */
    pointer-events: none;
    animation: readout-in var(--duration-base) var(--ease-out) both;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-3) var(--space-5);
    padding: var(--space-2) var(--space-4);
    /* Slightly translucent + blurred, the same elevated-chrome recipe as the top bar. */
    background: color-mix(in srgb, var(--color-surface) 92%, transparent);
    backdrop-filter: blur(8px);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    /* One strip, never a panel: overflow scrolls sideways rather than stacking rows. */
    max-width: 100%;
    overflow: hidden;
  }

  .at {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    margin: 0;
    flex-shrink: 0;
    font-size: var(--text-md);
    font-weight: var(--font-bold);
    color: var(--color-text);
    font-feature-settings: var(--numeric);
    letter-spacing: var(--tracking-tight);
    white-space: nowrap;
  }

  .at-sep,
  .at-dist {
    color: var(--color-text-muted);
    font-weight: var(--font-semibold);
  }

  .values {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: nowrap;
    gap: var(--space-5);
    min-width: 0;
    overflow-x: auto;
    /* Nothing here is clickable, so a scrollbar would only be chrome over the charts. */
    scrollbar-width: none;
    border-left: 1px solid var(--color-border);
    padding-left: var(--space-4);
  }
  .values::-webkit-scrollbar {
    display: none;
  }

  .values li {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    line-height: var(--leading-snug);
  }

  .v-label {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .v-label::before {
    content: '';
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: var(--lane, var(--color-accent));
    flex-shrink: 0;
  }

  .v-value {
    font-size: var(--text-sm);
    font-weight: var(--font-bold);
    color: var(--color-text);
    font-feature-settings: var(--numeric);
    white-space: nowrap;
  }

  .v-value small {
    margin-left: 0.25ch;
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text-muted);
  }

  @keyframes readout-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(var(--space-3));
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  /* Phones: a near-full-width strip above the home indicator, no centring transform to fight. */
  /* NOTE: no breakpoint token exists yet (custom properties can't be used in @media) — raw 768px,
     the same breakpoint AppShell uses (spec 034). */
  @media (max-width: 768px) {
    .readout-float {
      left: var(--space-4);
      right: var(--space-4);
      max-width: none;
      transform: none;
      bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
      animation-name: readout-in-mobile;
    }
    .bar {
      gap: var(--space-2) var(--space-3);
      padding: var(--space-2) var(--space-3);
    }
    .values {
      gap: var(--space-4);
      padding-left: var(--space-3);
    }
  }

  @keyframes readout-in-mobile {
    from {
      opacity: 0;
      transform: translateY(var(--space-3));
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .readout-float {
      animation: none;
    }
  }
</style>
