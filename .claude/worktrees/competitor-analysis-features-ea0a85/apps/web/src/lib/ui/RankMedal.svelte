<script lang="ts">
  /**
   * Rank indicator for a leaderboard row (spec 054) — the podium hierarchy in one small badge.
   *
   * Shared rather than inlined because ranking is not a one-page idea: any "best N ever" list wants
   * the same three-step read — the top result loud, second and third clearly behind it, everything
   * below plainly numbered. Colour alone never carries the meaning: the rank (or its label) is always
   * printed, so the order survives greyscale, low contrast and a screen reader.
   */

  interface Props {
    /** 1-based position. 1 is the record. */
    rank: number;
    /**
     * Text shown instead of the number — "PR" for a personal record. Keep it 2–3 characters; the
     * badge is a fixed circle so anything longer reads as a pill of noise.
     */
    label?: string | undefined;
    /** Screen-reader text; defaults to the Polish ordinal ("2. miejsce"). */
    ariaLabel?: string | undefined;
  }

  let { rank, label, ariaLabel }: Props = $props();

  const tone = $derived(rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'plain');
  const text = $derived(label ?? String(rank));
</script>

<span class="medal {tone}" class:wide={text.length > 1} aria-label={ariaLabel ?? `${rank}. miejsce`}>
  {text}
</span>

<style>
  .medal {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--space-6);
    height: var(--space-6);
    padding: 0 var(--space-1);
    border-radius: var(--radius-full);
    border: 1px solid transparent;
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    line-height: var(--leading-tight);
    font-feature-settings: var(--numeric);
    white-space: nowrap;
  }

  /* A label like "PR" needs room the bare ordinal does not. */
  .wide {
    padding: 0 var(--space-2);
    letter-spacing: var(--tracking-wide);
  }

  /* The record. Warm + filled, the only step with a visible ring. */
  .gold {
    background: var(--color-warning-soft);
    color: var(--color-warning);
    border-color: color-mix(in srgb, var(--color-warning) 45%, transparent);
  }

  .silver {
    background: var(--color-surface-2);
    color: var(--color-text-on-surface);
    border-color: var(--color-border-strong);
  }

  .bronze {
    background: color-mix(in srgb, var(--lane-orange) 14%, transparent);
    color: var(--lane-orange);
    border-color: color-mix(in srgb, var(--lane-orange) 32%, transparent);
  }

  /* Fourth and beyond: numbered, present, deliberately quiet. */
  .plain {
    background: transparent;
    color: var(--color-text-subtle);
    border-color: var(--color-border);
  }
</style>
