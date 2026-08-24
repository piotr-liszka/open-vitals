<script lang="ts">
  import type { Snippet } from 'svelte';

  type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

  interface Props {
    tone?: Tone;
    /** Show the leading solid status dot. */
    dot?: boolean;
    children?: Snippet;
  }

  let { tone = 'neutral', dot = true, children }: Props = $props();
</script>

<span class="badge {tone}">
  {#if dot}<span class="dot" aria-hidden="true"></span>{/if}
  {@render children?.()}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
    border: 1px solid transparent;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-wide);
    line-height: var(--leading-tight);
    white-space: nowrap;
  }

  .dot {
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
    background: currentColor;
    flex-shrink: 0;
  }

  .neutral {
    background: var(--color-surface-2);
    color: var(--color-text-muted);
    border-color: var(--color-border);
  }

  .success {
    background: var(--color-success-soft);
    color: var(--color-success);
  }

  .warning {
    background: var(--color-warning-soft);
    color: var(--color-warning);
  }

  .danger {
    background: var(--color-danger-soft);
    color: var(--color-danger);
  }

  .info {
    background: var(--color-info-soft);
    color: var(--color-info);
  }
</style>
