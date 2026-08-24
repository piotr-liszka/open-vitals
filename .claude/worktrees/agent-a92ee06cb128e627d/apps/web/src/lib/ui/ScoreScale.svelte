<script lang="ts">
  /**
   * ScoreScale — the 1–10 picker every subjective score in this app is entered on (spec 080).
   *
   * Design system, so there is ONE of these: the check-in's soreness and mood and an activity's RPE
   * were three hand-rolled button rows, and three rows meant three keyboard behaviours and three
   * ideas of what "10" means.
   *
   * The scale's whole job is to make the number mean something at the moment it is picked, which is
   * why `hints` and the two poles are first-class props rather than decoration. Soreness runs
   * worst-at-10 and mood runs best-at-10 — an unlabelled row of digits is how you get a series where
   * half the entries are on the wrong end.
   *
   * Presentational and controlled: `value` in, `onchange(next | null)` out.
   *
   * NOT standard radio behaviour, on purpose: re-selecting the current value clears it (and so does
   * Delete/Backspace). Every field here is voluntary, so "I did not say" has to stay reachable
   * without a reload — a radiogroup you cannot empty turns a stray tap into a data point.
   */
  interface Props {
    /** Visible instrument label above the track. */
    label: string;
    /** Currently selected score, or null for "did not say". */
    value: number | null;
    min?: number;
    max?: number;
    /**
     * What a score MEANS — shown as the live readout beside the label. Partial is fine: a scale with
     * anchors only (Borg-style RPE) shows a word on the anchored steps and just the number elsewhere.
     */
    hints?: Record<number, string> | undefined;
    /** The low pole, printed under the left end (e.g. "bez śladu"). */
    lowLabel?: string | undefined;
    /** The high pole, printed under the right end. */
    highLabel?: string | undefined;
    /** From this value up the selection takes the warning tone instead of the accent. */
    warnFrom?: number | undefined;
    /** What the readout says while nothing is picked. A dash keeps the component language-neutral. */
    unsetLabel?: string;
    disabled?: boolean;
    /** Accessible name for the group; defaults to `label`. */
    ariaLabel?: string | undefined;
    /** Called with the new score, or null when the athlete clears it. */
    onchange: (next: number | null) => void;
  }

  let {
    label,
    value,
    min = 1,
    max = 10,
    hints,
    lowLabel,
    highLabel,
    warnFrom,
    unsetLabel = '—',
    disabled = false,
    ariaLabel,
    onchange
  }: Props = $props();

  const scores = $derived(Array.from({ length: max - min + 1 }, (_, i) => min + i));
  const selectedIndex = $derived(value === null ? -1 : value - min);
  const warn = $derived(warnFrom !== undefined && value !== null && value >= warnFrom);
  const hint = $derived(value === null ? null : (hints?.[value] ?? null));

  // Roving tabindex: the group is ONE tab stop, so a form with two scales and a note costs three
  // tabs to cross instead of twenty-two.
  let buttons = $state<HTMLButtonElement[]>([]);
  let focusIndex = $state(0);
  const tabIndex = $derived(selectedIndex === -1 ? focusIndex : selectedIndex);

  function pick(index: number, focus = false): void {
    const score = scores[index];
    if (disabled || score === undefined) return;
    focusIndex = index;
    // Re-selecting clears — the documented exception above.
    onchange(score === value ? null : score);
    if (focus) buttons[index]?.focus();
  }

  /**
   * Move to an absolute step. Landing on the value that is already selected only moves focus: on this
   * control re-selecting is the CLEAR gesture, so an arrow press at either end would otherwise wipe
   * the score instead of doing nothing.
   */
  function move(index: number): void {
    const clamped = Math.max(0, Math.min(scores.length - 1, index));
    if (scores[clamped] === value) {
      focusIndex = clamped;
      buttons[clamped]?.focus();
      return;
    }
    pick(clamped, true);
  }

  function onkeydown(event: KeyboardEvent): void {
    if (disabled) return;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        // From "did not say", the first arrow commits the step focus is already on rather than
        // skipping past it.
        move(selectedIndex === -1 ? focusIndex : selectedIndex + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        move(selectedIndex === -1 ? focusIndex : selectedIndex - 1);
        break;
      case 'Home':
        move(0);
        break;
      case 'End':
        move(scores.length - 1);
        break;
      case 'Backspace':
      case 'Delete':
        if (value === null) return;
        onchange(null);
        break;
      default:
        return;
    }
    event.preventDefault();
  }
</script>

<div class="scale" class:disabled>
  <div class="head">
    <span class="label">{label}</span>
    <span class="readout" class:warn aria-live="polite">
      {#if value === null}
        <span class="unset">{unsetLabel}</span>
      {:else}
        <span class="picked">{value}</span>{#if hint}<span class="hint">{hint}</span>{/if}
      {/if}
    </span>
  </div>

  <div
    class="track"
    class:warn
    role="radiogroup"
    aria-label={ariaLabel ?? label}
    style:--score-count={scores.length}
  >
    {#if selectedIndex !== -1}
      <span class="thumb" style:--score-index={selectedIndex} aria-hidden="true"></span>
    {/if}
    {#each scores as score, index (score)}
      <button
        bind:this={buttons[index]}
        type="button"
        class="score"
        class:on={score === value}
        role="radio"
        aria-checked={score === value}
        aria-label={hints?.[score] ? `${score} — ${hints[score]}` : String(score)}
        tabindex={index === tabIndex ? 0 : -1}
        {disabled}
        onclick={() => pick(index)}
        {onkeydown}
      >
        {score}
      </button>
    {/each}
  </div>

  {#if lowLabel || highLabel}
    <div class="poles">
      <span>{lowLabel ? `${min} · ${lowLabel}` : ''}</span>
      <span>{highLabel ? `${max} · ${highLabel}` : ''}</span>
    </div>
  {/if}
</div>

<style>
  .scale {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
  }

  /* Instrument caps — the label vocabulary the rest of the app reads numbers under. */
  .label {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-widest);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .readout {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
    font-size: var(--text-sm);
  }

  .picked {
    font-size: var(--text-md);
    font-weight: var(--font-bold);
    font-feature-settings: var(--numeric);
    letter-spacing: var(--tracking-tight);
    color: var(--color-accent);
  }
  .readout.warn .picked {
    color: var(--color-warning);
  }

  .hint {
    color: var(--color-text-on-surface);
  }

  .unset {
    color: var(--color-text-subtle);
    font-size: var(--text-xs);
  }

  .track {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--score-count), minmax(0, 1fr));
    gap: 0;
    padding: 2px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
  }

  .track:focus-within {
    border-color: var(--color-accent);
    box-shadow: var(--focus-ring);
  }

  /* Hairline rules between the steps, so the track reads as a measured scale and not ten buttons. */
  .score + .score {
    box-shadow: inset 1px 0 0 var(--color-grid);
  }

  .score {
    position: relative;
    z-index: var(--z-content);
    /* Ten steps in a card's width are narrow by definition, so the target buys its size in height —
       and on a touch screen it takes the full 44px, where the miss lands on a neighbouring score. */
    min-height: 36px;
    padding: var(--space-2) 0;
    border: 0;
    border-radius: calc(var(--radius-md) - 3px);
    background: transparent;
    color: var(--color-text-muted);
    font: inherit;
    font-size: var(--text-sm);
    font-feature-settings: var(--numeric);
    line-height: var(--leading-tight);
    cursor: pointer;
    transition: color var(--transition-fast);
  }

  @media (pointer: coarse) {
    .score {
      min-height: 44px;
    }
  }

  .score:hover:not(:disabled):not(.on) {
    color: var(--color-text);
    background: var(--color-surface-hover);
  }

  .score:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }

  .score.on {
    /* The value sits on the moving fill, so it takes the ink grade, never the text grade. */
    color: var(--color-on-accent);
    font-weight: var(--font-bold);
  }

  /*
   * The one authored moment: a single fill that SLIDES to the picked step. It carries the state
   * change (and the direction of it) that ten independently tinted buttons cannot.
   */
  .thumb {
    position: absolute;
    top: 2px;
    bottom: 2px;
    left: 2px;
    width: calc((100% - 4px) / var(--score-count));
    border-radius: calc(var(--radius-md) - 3px);
    background: var(--color-accent-fill);
    box-shadow: var(--shadow-sm);
    transform: translateX(calc(var(--score-index) * 100%));
    transition:
      transform var(--transition-base),
      background var(--transition-fast);
  }
  .track.warn .thumb {
    background: var(--color-warning);
  }

  .poles {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
  }

  .scale.disabled .label,
  .scale.disabled .readout {
    opacity: 0.6;
  }
  .score:disabled {
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .thumb,
    .score {
      transition: none;
    }
  }
</style>
