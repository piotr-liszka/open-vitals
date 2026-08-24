<script lang="ts">
  /**
   * A dedicated on/off switch for the Advanced tier (spec 014). Advanced mode IS the single
   * `detailed_analytics` consent, so this is a friendlier framing over the same `/api/consent`
   * path as ConsentPanel:
   *   - flipping ON opens the terms gate — consent is only recorded after an explicit accept;
   *   - flipping OFF asks for confirmation, then revokes and drops the user back to Base.
   * The switch always reflects the real backing state; a pending flow expands inline below it.
   */
  import { Toggle, Button, Badge } from '$lib/ui';
  import { formatInstant } from '$lib/date';
  import type { ConsentFeatureView } from './consent.types';

  interface Props {
    feature: ConsentFeatureView;
    /** Called with the updated feature after accept/revoke succeeds. */
    onUpdated?: (feature: ConsentFeatureView) => void;
  }

  let { feature, onUpdated }: Props = $props();

  type Pending = 'enabling' | 'disabling' | null;
  let pending = $state<Pending>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);

  function onToggle(next: boolean): void {
    error = null;
    // Open the matching confirm flow; the actual state change happens on confirm.
    pending = next ? 'enabling' : 'disabling';
  }

  function cancel(): void {
    pending = null;
    error = null;
  }

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
      pending = null;
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

<div class="adv" class:on={feature.enabled}>
  <div class="head">
    <div class="copy">
      <div class="title-row">
        <h3 class="title">{feature.title}</h3>
        <Badge tone={feature.enabled ? 'success' : 'neutral'}>
          {feature.enabled ? 'Włączony' : 'Wyłączony'}
        </Badge>
      </div>
      <p class="summary">{feature.summary}</p>
      {#if feature.enabled && acceptedLabel}
        <p class="meta">Zaakceptowano {acceptedLabel} · warunki v{feature.termsVersion}</p>
      {/if}
    </div>
    <Toggle checked={feature.enabled} loading={busy} label="Przełącz tryb zaawansowany" onchange={onToggle} />
  </div>

  {#if pending === 'enabling'}
    <div class="panel">
      <p class="panel-title">Włącz tryb zaawansowany</p>
      <p class="terms-text">{feature.termsText}</p>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <div class="actions">
        <Button variant="ghost" size="sm" onclick={cancel} disabled={busy}>Anuluj</Button>
        <Button variant="primary" size="sm" loading={busy} onclick={() => submit(true)}>
          Zaakceptuj i włącz
        </Button>
      </div>
    </div>
  {:else if pending === 'disabling'}
    <div class="panel">
      <p class="panel-title">Wyłączyć tryb zaawansowany?</p>
      <p class="panel-body">
        Wrócisz do trybu podstawowego — zostaje samo połączenie z Garminem i Twój adres MCP. Pulpit, analityka
        i wnioski zostaną ukryte, a pobieranie zakresów danych zatrzymane. Możesz włączyć tryb zaawansowany
        ponownie w każdej chwili.
      </p>
      {#if error}<p class="error" role="alert">{error}</p>{/if}
      <div class="actions">
        <Button variant="ghost" size="sm" onclick={cancel} disabled={busy}>Anuluj</Button>
        <Button variant="danger" size="sm" loading={busy} onclick={() => submit(false)}>
          Wyłącz tryb zaawansowany
        </Button>
      </div>
    </div>
  {/if}
</div>

<style>
  .adv {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .copy {
    min-width: 0;
  }

  .title-row {
    display: flex;
    align-items: center;
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

  .meta {
    margin: var(--space-2) 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    letter-spacing: var(--tracking-wide);
  }

  .panel {
    padding: var(--space-4);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .panel-title {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }

  .panel-body,
  .terms-text {
    margin: 0;
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
</style>
