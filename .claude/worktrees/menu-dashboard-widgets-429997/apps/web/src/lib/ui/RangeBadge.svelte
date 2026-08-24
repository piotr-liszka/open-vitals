<script lang="ts">
  /**
   * RangeBadge (spec 047) — the mark that says "this card follows the global range".
   *
   * With one switch driving cards across seven pages, a number on screen is ambiguous: is it today,
   * or the whole window? Every card whose content moves with the switch carries this chip; cards that
   * deliberately ignore it (today's snapshot, condition, coverage) carry nothing. Absence is as
   * meaningful as presence, so this must never be decorative.
   *
   * Presentational: takes the resolved label, renders a chip. `Card` exposes it through its `range`
   * prop, so a ranged card is one prop away.
   */
  import Icon from './Icon.svelte';

  interface Props {
    /** Active range label, e.g. "30 dni" or "cały czas (od 2021-03-04)". */
    label: string;
    /**
     * What one point/row of this card covers once a long range buckets the data ("tydzień",
     * "miesiąc"). Appended to the tooltip when the card is no longer day-by-day.
     */
    bucketNoun?: string | undefined;
    /** `sm` for dense headers (widgets, tile grids); `md` for full card headers. */
    size?: 'sm' | 'md';
  }

  let { label, bucketNoun, size = 'md' }: Props = $props();

  const tooltip = $derived(
    `Ta karta pokazuje dane z wybranego zakresu: ${label}. Zakres zmienisz przełącznikiem na górze strony.` +
      (bucketNoun ? ` Jeden punkt to ${bucketNoun}.` : '')
  );
</script>

<!-- `title` carries the explanation; the label itself is visible text, so the meaning never depends
     on hover alone (or on colour). Not interactive: it reports state, it does not change it. -->
<span class="range-badge {size}" title={tooltip}>
  <Icon name="clock" size={size === 'sm' ? 12 : 14} />
  <span class="text">{label}</span>
</span>

<style>
  .range-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    max-width: 100%;
    padding: 0 var(--space-2);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    color: var(--color-text-muted);
    font-weight: var(--font-medium);
    letter-spacing: var(--tracking-wide);
    line-height: var(--leading-tight);
    font-feature-settings: var(--numeric);
    white-space: nowrap;
    /* Long "cały czas (od …)" labels truncate rather than push a card header wider (spec 034). */
    overflow: hidden;
    cursor: help;
  }

  .text {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sm {
    height: var(--space-5);
    font-size: var(--text-xs);
  }

  .md {
    height: var(--space-6);
    font-size: var(--text-xs);
  }
</style>
