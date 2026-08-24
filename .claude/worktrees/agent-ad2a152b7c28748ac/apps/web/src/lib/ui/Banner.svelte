<script lang="ts">
  import type { Snippet } from 'svelte';

  type Tone = 'info' | 'success' | 'warning' | 'danger';

  interface Props {
    /** Colour + semantics. `danger`/`warning` announce assertively. */
    tone?: Tone;
    /** Short bold headline. */
    title?: string;
    /** Body copy / detail. */
    children?: Snippet;
    /** Optional trailing controls (e.g. a retry Button). */
    actions?: Snippet;
  }

  let { tone = 'info', title, children, actions }: Props = $props();

  // Warnings/errors interrupt; info/success are polite.
  const live = $derived(tone === 'danger' || tone === 'warning' ? 'assertive' : 'polite');
  const role = $derived(tone === 'danger' || tone === 'warning' ? 'alert' : 'status');
</script>

<div class="banner {tone}" {role} aria-live={live}>
  <span class="dot" aria-hidden="true"></span>
  <div class="content">
    {#if title}<p class="title">{title}</p>{/if}
    {#if children}<div class="message">{@render children()}</div>{/if}
  </div>
  {#if actions}
    <div class="actions">{@render actions()}</div>
  {/if}
</div>

<style>
  .banner {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    border: 1px solid transparent;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
  }

  .dot {
    width: var(--space-2);
    height: var(--space-2);
    margin-top: var(--space-1);
    border-radius: var(--radius-full);
    background: currentColor;
    flex-shrink: 0;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
    flex: 1;
  }

  .title {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
  }

  .message {
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
    color: var(--color-text-on-surface);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .info {
    background: var(--color-info-soft);
    border-color: color-mix(in srgb, var(--color-info) 30%, transparent);
    color: var(--color-info);
  }
  .success {
    background: var(--color-success-soft);
    border-color: color-mix(in srgb, var(--color-success) 30%, transparent);
    color: var(--color-success);
  }
  .warning {
    background: var(--color-warning-soft);
    border-color: color-mix(in srgb, var(--color-warning) 30%, transparent);
    color: var(--color-warning);
  }
  .danger {
    background: var(--color-danger-soft);
    border-color: color-mix(in srgb, var(--color-danger) 30%, transparent);
    color: var(--color-danger);
  }
</style>
