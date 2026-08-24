<script lang="ts">
  import type { ToastTone } from './toast';
  import { getI18n } from '$lib/i18n';

  const i18n = getI18n();

  interface Props {
    tone?: ToastTone;
    message: string;
    /** Called when the dismiss button is pressed. */
    ondismiss?: () => void;
  }

  let { tone = 'info', message, ondismiss }: Props = $props();

  const icons: Record<ToastTone, string> = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };
</script>

<div class="toast {tone}" role="status" aria-live="polite">
  <span class="glyph" aria-hidden="true">{icons[tone]}</span>
  <span class="message">{message}</span>
  {#if ondismiss}
    <button type="button" class="dismiss" aria-label={i18n.t('ui.dismissNotification')} onclick={ondismiss}>
      ✕
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
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    flex-shrink: 0;
    color: var(--color-on-accent);
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

  .success {
    border-left-color: var(--color-success);
  }
  .success .glyph {
    background: var(--color-success);
  }

  .error {
    border-left-color: var(--color-danger);
  }
  .error .glyph {
    background: var(--color-danger);
  }

  .info {
    border-left-color: var(--color-accent);
  }
  .info .glyph {
    background: var(--color-accent-fill);
  }
</style>
