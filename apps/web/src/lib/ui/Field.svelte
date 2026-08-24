<script module lang="ts">
  /** Payload handed to the control snippet so wiring is automatic. */
  export interface FieldControl {
    /** Use as the control's `id` — the label's `for` points here. */
    id: string;
    /** Use as the control's `aria-describedby` (undefined when no help/error). */
    describedBy: string | undefined;
    /** True when an error is present — pass to the control's `invalid`. */
    invalid: boolean;
  }

  // Monotonic per-instance counter — SSR and client render fields in the same
  // order, so generated ids match and hydration stays clean.
  let uidSeq = 0;
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    /** Explicit id; auto-generated when omitted. */
    id?: string;
    /** Error message — takes precedence over help text and marks the field invalid. */
    error?: string | undefined;
    /** Assistive help text shown below the control. */
    help?: string | undefined;
    required?: boolean;
    children: Snippet<[FieldControl]>;
  }

  let { label, id, error, help, required = false, children }: Props = $props();

  const fallbackId = `gb-field-${(uidSeq += 1)}`;
  const controlId = $derived(id ?? fallbackId);
  const errorId = $derived(`${controlId}-error`);
  const helpId = $derived(`${controlId}-help`);
  const describedBy = $derived(error ? errorId : help ? helpId : undefined);
  const control = $derived<FieldControl>({
    id: controlId,
    describedBy,
    invalid: Boolean(error)
  });
</script>

<div class="field">
  <label class="label" for={controlId}>
    {label}
    {#if required}<span class="req" aria-hidden="true">*</span>{/if}
  </label>

  {@render children(control)}

  {#if error}
    <p class="error" id={errorId} role="alert">{error}</p>
  {:else if help}
    <p class="help" id={helpId}>{help}</p>
  {/if}
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-on-surface);
  }

  .req {
    color: var(--color-danger);
    margin-left: var(--space-1);
  }

  .help {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .error {
    font-size: var(--text-xs);
    color: var(--color-danger);
  }
</style>
