<script lang="ts">
  import { Button, Badge } from '$lib/ui';
  import { formatInstant } from '$lib/date';
  import type { ConsentFeatureView } from './consent.types';

  interface Props {
    feature: ConsentFeatureView;
    /** Called with the updated feature after accept/revoke succeeds. */
    onUpdated?: (feature: ConsentFeatureView) => void;
  }

  let { feature, onUpdated }: Props = $props();

  let busy = $state(false);
  let error = $state<string | null>(null);
  let showTerms = $state(false);

  async function submit(accept: boolean): Promise<void> {
    busy = true;
    error = null;
    try {
      const res = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ featureId: feature.id, termsVersion: feature.termsVersion, accept })
      });
      const body = (await res.json().catch(() => null)) as
        { feature: ConsentFeatureView } | { error: string } | null;
      if (!res.ok || !body || !('feature' in body)) {
        error = (body && 'error' in body && body.error) || 'Coś poszło nie tak. Spróbuj ponownie.';
        return;
      }
      onUpdated?.(body.feature);
    } catch {
      error = 'Nie udało się połączyć z serwerem. Spróbuj ponownie.';
    } finally {
      busy = false;
    }
  }

  // Fixed app timezone so SSR and the browser render the same text (spec 018).
  const acceptedLabel = $derived(feature.acceptedAt ? formatInstant(feature.acceptedAt, 'numeric') : null);
</script>

<div class="consent" class:granted={feature.enabled}>
  <div class="head">
    <div class="title-wrap">
      <h3 class="title">{feature.title}</h3>
      <p class="summary">{feature.summary}</p>
    </div>
    {#if feature.enabled}
      <Badge tone={feature.requiresConsent ? 'success' : 'info'}>
        {feature.requiresConsent ? 'Zaakceptowano' : 'Domyślnie włączone'}
      </Badge>
    {:else}
      <Badge tone="warning">Wymaga zgody</Badge>
    {/if}
  </div>

  {#if feature.requiresConsent}
    <div class="terms">
      <button
        type="button"
        class="disclose"
        aria-expanded={showTerms}
        onclick={() => (showTerms = !showTerms)}
      >
        {showTerms ? 'Ukryj warunki' : 'Pokaż warunki'} · v{feature.termsVersion}
      </button>
      {#if showTerms}
        <p class="terms-text">{feature.termsText}</p>
      {/if}
    </div>
  {/if}

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  <div class="actions">
    {#if feature.enabled && feature.requiresConsent}
      {#if acceptedLabel}<span class="meta">Zaakceptowano {acceptedLabel}</span>{/if}
      <Button variant="ghost" size="sm" loading={busy} onclick={() => submit(false)}>Wycofaj</Button>
    {:else if !feature.enabled && feature.requiresConsent}
      <Button variant="primary" size="sm" loading={busy} onclick={() => submit(true)}>
        Zaakceptuj i włącz
      </Button>
    {/if}
  </div>
</div>

<style>
  .consent {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .title {
    margin: 0;
    font-size: var(--text-md);
    font-weight: var(--font-semibold);
    color: var(--color-text);
    letter-spacing: var(--tracking-tight);
  }

  .summary {
    margin: var(--space-1) 0 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
  }

  .disclose {
    appearance: none;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    letter-spacing: var(--tracking-wide);
    color: var(--color-accent);
    cursor: pointer;
  }
  .disclose:hover {
    text-decoration: underline;
  }
  .disclose:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
    border-radius: var(--radius-sm);
  }

  .terms-text {
    margin: var(--space-2) 0 0;
    padding: var(--space-3);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--color-text-on-surface);
    line-height: var(--leading-normal);
  }

  .error {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-danger);
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
  }

  .meta {
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    letter-spacing: var(--tracking-wide);
  }
</style>
