<script lang="ts">
  import type { ToastTone } from './toast';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  interface Props {
    tone?: ToastTone;
    message: string;
    /** Called when the dismiss button is pressed. */
    ondismiss?: () => void;
  }

  let { tone = 'info', message, ondismiss }: Props = $props();

  const icons: Record<ToastTone, IconName> = {
    success: 'check',
    error: 'x',
    info: 'info'
  };
</script>

<div class="toast {tone}" role="status" aria-live="polite">
  <span class="glyph">
    <Icon name={icons[tone]} size={12} strokeWidth={3} />
  </span>
  <span class="message">{message}</span>
  {#if ondismiss}
    <button type="button" class="dismiss" aria-label="Dismiss notification" onclick={ondismiss}>
      <Icon name="x" size={14} strokeWidth={2} />
    </button>
  {/if}
</div>

<style>
  .toast {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-left-width: 3px;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    font-size: var(--text-sm);
    color: var(--color-text);
    min-width: 240px;
    max-width: 360px;
  }

  .glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--space-5);
    height: var(--space-5);
    border-radius: var(--radius-full);
    flex-shrink: 0;
  }

  .message {
    flex: 1;
    min-width: 0;
  }

  .dismiss {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-1);
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition:
      color var(--transition-fast),
      background var(--transition-fast);
  }
  .dismiss:hover {
    color: var(--color-text);
    background: var(--color-surface-hover);
  }

  /* The badge takes the deep, theme-stable *fill* step and a hue-tinted white mark; the left rule
     keeps the *text* step, which is what makes it legible as a thin line. See tokens.css. */
  .success {
    border-left-color: var(--color-success);
  }
  .success .glyph {
    background: var(--color-success-fill);
    color: var(--color-on-success);
  }

  .error {
    border-left-color: var(--color-danger);
  }
  .error .glyph {
    background: var(--color-danger-fill);
    color: var(--color-on-danger);
  }

  /* Magenta is the one bright fill in the set, so it keeps its ink label (tokens.css). */
  .info {
    border-left-color: var(--color-accent);
  }
  .info .glyph {
    background: var(--color-accent-fill);
    color: var(--color-on-accent);
  }
</style>
