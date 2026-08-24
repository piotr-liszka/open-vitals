<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  interface Props extends HTMLInputAttributes {
    /** Two-way bound text value. */
    value?: string;
    /** Renders the error styling + sets aria-invalid. */
    invalid?: boolean;
  }

  let {
    value = $bindable(''),
    invalid = false,
    type = 'text',
    class: className = '',
    ...rest
  }: Props = $props();

  const classes = $derived(['input', className].filter((c) => c).join(' '));
</script>

<input
  class={classes}
  class:invalid
  {type}
  bind:value
  aria-invalid={invalid ? 'true' : undefined}
  {...rest}
/>

<style>
  .input {
    width: 100%;
    height: var(--space-10);
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    line-height: var(--leading-normal);
    transition:
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .input::placeholder {
    color: var(--color-text-subtle);
  }

  .input:hover:not(:disabled):not(:focus) {
    border-color: var(--color-text-subtle);
  }

  .input:focus-visible {
    border-color: var(--color-accent);
    box-shadow: var(--focus-ring);
    outline: none;
  }

  .input:disabled {
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    cursor: not-allowed;
  }

  .input.invalid {
    border-color: var(--color-danger);
  }

  .input.invalid:focus-visible {
    box-shadow: 0 0 0 3px var(--color-danger-soft);
  }
</style>
