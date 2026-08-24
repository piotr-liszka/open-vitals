<script lang="ts" module>
  /**
   * Which way a change should be READ, not which way the number moved. "Better" is the caller's
   * judgement: for a race prediction a smaller number is better, for weekly mileage a bigger one is.
   */
  export type DeltaDirection = 'better' | 'worse' | 'same';
  /**
   * Which way the arrow points — deliberately independent of `direction`. A faster race time is an
   * improvement that points DOWN; a rising weekly volume is an improvement that points UP. Baking one
   * of those into the component would make it wrong for half its callers.
   */
  export type DeltaArrow = 'up' | 'down' | 'none';
</script>

<script lang="ts">
  /**
   * The change indicator (spec 057) — "1:40 faster than 90 days ago" in a pill.
   *
   * Shared rather than inlined because "this metric moved, and that is good/bad" is not a one-page
   * idea. Three rules the component enforces so no caller can get them wrong:
   *
   *  1. **Colour never carries meaning alone.** The arrow glyph shows the direction and `label` — a
   *     full sentence — is always rendered for assistive tech. Greyscale, colour-blindness and a
   *     screen reader all still get the whole fact.
   *  2. **Direction and arrow are separate props** (see the types above).
   *  3. **"No change" is a state, not a colour.** `same` is quiet and neutral; a caller with NOTHING
   *     to compare against should render no badge at all rather than a zero.
   */
  import Icon from './Icon.svelte';

  interface Props {
    /** How the change should be read. Drives the tone only. */
    direction: DeltaDirection;
    /** Arrow glyph. `none` for an unchanged value (or a metric with no natural direction). */
    arrow?: DeltaArrow;
    /** The magnitude, already formatted by the caller (`1:40`, `+2,3 km`, `12%`). */
    value: string;
    /** Full sentence for assistive tech, e.g. "szybciej o 1:40 niż 90 dni temu". Required. */
    label: string;
  }

  let { direction, arrow = 'none', value, label }: Props = $props();
</script>

<span class="delta {direction}">
  {#if arrow !== 'none'}
    <Icon name={arrow === 'down' ? 'arrow-down' : 'arrow-up'} size={14} />
  {/if}
  <span class="value" aria-hidden="true">{value}</span>
  <span class="sr-only">{label}</span>
</span>

<style>
  .delta {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-full);
    border: 1px solid transparent;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    line-height: var(--leading-tight);
    font-feature-settings: var(--numeric);
    white-space: nowrap;
  }

  .value {
    letter-spacing: var(--tracking-tight);
  }

  .better {
    background: var(--color-success-soft);
    color: var(--color-success);
    border-color: color-mix(in srgb, var(--color-success) 28%, transparent);
  }

  .worse {
    background: var(--color-danger-soft);
    color: var(--color-danger);
    border-color: color-mix(in srgb, var(--color-danger) 28%, transparent);
  }

  /* Unchanged is information too — present, legible, and deliberately not shouting. */
  .same {
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    border-color: var(--color-border);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
