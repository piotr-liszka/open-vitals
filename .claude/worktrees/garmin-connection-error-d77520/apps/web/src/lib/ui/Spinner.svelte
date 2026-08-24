<script lang="ts">
  type Size = 'sm' | 'md';

  interface Props {
    /** Diameter preset. */
    size?: Size;
    /** Accessible label; announced via role="status". */
    label?: string;
  }

  let { size = 'md', label = 'Ładowanie' }: Props = $props();
</script>

<span class="spinner {size}" role="status" aria-live="polite">
  <span class="ring" aria-hidden="true"></span>
  <span class="sr-only">{label}</span>
</span>

<style>
  .spinner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
  }

  .ring {
    display: inline-block;
    border-radius: var(--radius-full);
    border: 2px solid var(--color-border-strong);
    border-top-color: var(--color-accent);
    animation: spin 0.6s linear infinite;
  }

  .sm .ring {
    width: var(--space-4);
    height: var(--space-4);
  }

  .md .ring {
    width: var(--space-6);
    height: var(--space-6);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ring {
      animation-duration: 1.4s;
    }
  }
</style>
