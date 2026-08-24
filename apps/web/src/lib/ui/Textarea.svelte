<script lang="ts">
  /**
   * Textarea — `Input`'s multi-line sibling (spec 080), same border/focus/invalid vocabulary.
   *
   * It exists because a field that accepts a thousand characters was being collected in a
   * single-line `<input>`: everything past the first line was typed blind.
   *
   * The counter is deliberately LATE. A live "0/1000" on an optional note reads as a quota; it only
   * earns its space once the limit is actually in reach, so it appears inside `counterFrom` of the max.
   */
  import type { HTMLTextareaAttributes } from 'svelte/elements';

  interface Props extends HTMLTextareaAttributes {
    value?: string;
    /** Renders the error styling + sets aria-invalid. */
    invalid?: boolean;
    rows?: number;
    /** Show the remaining-characters counter once this many are left. Needs `maxlength`. */
    counterFrom?: number;
  }

  let {
    value = $bindable(''),
    invalid = false,
    rows = 3,
    counterFrom = 100,
    maxlength,
    class: className = '',
    ...rest
  }: Props = $props();

  const classes = $derived(['textarea', className].filter((c) => c).join(' '));
  const left = $derived(typeof maxlength === 'number' ? maxlength - value.length : null);
  const showCounter = $derived(left !== null && left <= counterFrom);
</script>

<div class="wrap">
  <textarea
    class={classes}
    class:invalid
    {rows}
    {maxlength}
    bind:value
    aria-invalid={invalid ? 'true' : undefined}
    {...rest}
  ></textarea>
  {#if showCounter}
    <!-- Digits, not a sentence: "zostało 1 znaków" is the kind of copy a counter has no business
         getting wrong, and `n/max` is language-neutral in a component the whole app shares. -->
    <p class="counter" class:tight={left !== null && left <= 0} aria-live="polite">
      {value.length}/{maxlength}
    </p>
  {/if}
</div>

<style>
  .wrap {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .textarea {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font: inherit;
    font-size: var(--text-base);
    line-height: var(--leading-normal);
    resize: vertical;
    transition:
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .textarea::placeholder {
    color: var(--color-text-subtle);
  }

  .textarea:hover:not(:disabled):not(:focus) {
    border-color: var(--color-text-subtle);
  }

  .textarea:focus-visible {
    border-color: var(--color-accent);
    box-shadow: var(--focus-ring);
    outline: none;
  }

  .textarea:disabled {
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    cursor: not-allowed;
    resize: none;
  }

  .textarea.invalid {
    border-color: var(--color-danger);
  }

  .textarea.invalid:focus-visible {
    box-shadow: 0 0 0 3px var(--color-danger-soft);
  }

  .counter {
    margin: 0;
    align-self: flex-end;
    font-size: var(--text-xs);
    font-feature-settings: var(--numeric);
    color: var(--color-text-subtle);
  }
  .counter.tight {
    color: var(--color-warning);
  }
</style>
