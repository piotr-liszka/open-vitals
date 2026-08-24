<script lang="ts">
  /**
   * Tier indicator (spec 014). Makes the Base vs Advanced distinction unmistakable in the app chrome.
   * - base:     "standby" instrument — muted, hairline, a hollow dot.
   * - advanced: "live" instrument — signal-accent, a solid pulsing dot.
   * Tokens only; light + dark via tokens.
   */
  interface Props {
    tier: 'base' | 'advanced';
    /** Compact form for tight spots (topbar). */
    size?: 'sm' | 'md';
  }
  let { tier, size = 'md' }: Props = $props();

  const label = $derived(tier === 'advanced' ? 'Zaawansowany' : 'Podstawowy');
</script>

<span
  class="tier tier-{tier} size-{size}"
  title={tier === 'advanced'
    ? 'Tryb zaawansowany — przetwarzanie danych włączone'
    : 'Tryb podstawowy — tylko połączenie i adres MCP'}
>
  <span class="dot" aria-hidden="true"></span>
  <span class="txt">{label}</span>
</span>

<style>
  .tier {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    border-radius: var(--radius-full);
    border: 1px solid var(--color-border);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-wide);
    text-transform: uppercase;
    white-space: nowrap;
    user-select: none;
  }
  .size-md {
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-xs);
  }
  .size-sm {
    padding: 2px var(--space-2);
    font-size: 0.6875rem;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: var(--radius-full);
    flex-shrink: 0;
  }

  /* Base — standby: quiet, hollow. */
  .tier-base {
    background: var(--color-surface-2);
    color: var(--color-text-muted);
  }
  .tier-base .dot {
    border: 1.5px solid var(--color-text-subtle, var(--color-text-muted));
    background: transparent;
  }

  /* Advanced — live: signal accent, pulsing. */
  .tier-advanced {
    background: var(--color-accent-soft);
    border-color: color-mix(in srgb, var(--color-accent) 40%, transparent);
    color: var(--color-accent);
  }
  .tier-advanced .dot {
    background: var(--color-accent);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent) 60%, transparent);
    animation: tier-pulse 2.4s var(--ease-out, ease-out) infinite;
  }

  @keyframes tier-pulse {
    0% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent) 55%, transparent);
    }
    70% {
      box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-accent) 0%, transparent);
    }
    100% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-accent) 0%, transparent);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tier-advanced .dot {
      animation: none;
    }
  }
</style>
