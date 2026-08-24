<script lang="ts">
  import { toasts } from './toast';
  import Toast from './Toast.svelte';
</script>

<div class="toast-container" aria-live="polite">
  {#each $toasts as toast (toast.id)}
    <Toast tone={toast.tone} message={toast.message} ondismiss={() => toasts.dismiss(toast.id)} />
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: var(--space-4);
    right: var(--space-4);
    z-index: var(--z-toast);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    pointer-events: none;
  }

  .toast-container > :global(*) {
    pointer-events: auto;
  }
</style>
