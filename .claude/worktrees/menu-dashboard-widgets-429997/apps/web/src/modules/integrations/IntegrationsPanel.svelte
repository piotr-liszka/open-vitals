<script lang="ts">
  /**
   * Connect / sync / disconnect Strava + Withings (spec 017). Presentational — status comes from the
   * loader; actions hit the `/api/integrations/*` routes and refresh. Connect is a full navigation
   * (OAuth redirect); sync/disconnect are fetches.
   */
  import { invalidateAll } from '$app/navigation';
  import Card from '$lib/ui/Card.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import type { IntegrationsStatus } from './integrations.types';

  let { status }: { status: IntegrationsStatus } = $props();

  let busy = $state<string | null>(null);
  let message = $state<string | null>(null);

  async function sync(provider: 'strava' | 'withings'): Promise<void> {
    busy = `${provider}:sync`;
    message = null;
    try {
      const res = await fetch(`/api/integrations/${provider}/sync`, { method: 'POST' });
      const data = await res.json();
      if (provider === 'withings') message = `Zaimportowano ${data.imported ?? 0} pomiarów wagi.`;
      else message = `Przeskanowano ${data.scanned ?? 0}, powiązano ${data.matched ?? 0} aktywności.`;
      await invalidateAll();
    } catch {
      message = 'Synchronizacja nie powiodła się.';
    } finally {
      busy = null;
    }
  }

  async function disconnect(provider: 'strava' | 'withings'): Promise<void> {
    busy = `${provider}:disc`;
    try {
      await fetch(`/api/integrations/${provider}/disconnect`, { method: 'POST' });
      await invalidateAll();
    } finally {
      busy = null;
    }
  }
</script>

<div class="stack">
  {#if message}<p class="msg">{message}</p>{/if}

  <Card title="Strava" subtitle="Powiąż swoje aktywności Garmin z ich odpowiednikami w Strava.">
    <div class="row">
      <div class="status">
        {#if status.strava.connected}
          <Badge tone="success">Połączono</Badge>
          <span class="detail">Powiązane aktywności: {status.strava.linkedCount}</span>
        {:else}
          <Badge tone="neutral">Nie połączono</Badge>
        {/if}
      </div>
      <div class="actions">
        {#if status.strava.connected}
          <Button
            size="sm"
            variant="secondary"
            loading={busy === 'strava:sync'}
            onclick={() => sync('strava')}>Powiąż aktywności</Button
          >
          <Button
            size="sm"
            variant="ghost"
            loading={busy === 'strava:disc'}
            onclick={() => disconnect('strava')}>Rozłącz</Button
          >
        {:else}
          <a class="connect" href="/api/integrations/strava/connect">Połącz ze Strava</a>
        {/if}
      </div>
    </div>
  </Card>

  <Card title="Withings" subtitle="Importuj pomiary wagi z konta Withings do lokalnego magazynu.">
    <div class="row">
      <div class="status">
        {#if status.withings.connected}
          <Badge tone="success">Połączono</Badge>
          <span class="detail">
            Pomiary wagi: {status.withings.weightCount}
            {#if status.withings.firstDay}· {status.withings.firstDay}–{status.withings.lastDay}{/if}
          </span>
        {:else}
          <Badge tone="neutral">Nie połączono</Badge>
        {/if}
      </div>
      <div class="actions">
        {#if status.withings.connected}
          <Button
            size="sm"
            variant="secondary"
            loading={busy === 'withings:sync'}
            onclick={() => sync('withings')}>Importuj wagę</Button
          >
          <Button
            size="sm"
            variant="ghost"
            loading={busy === 'withings:disc'}
            onclick={() => disconnect('withings')}>Rozłącz</Button
          >
        {:else}
          <a class="connect" href="/api/integrations/withings/connect">Połącz z Withings</a>
        {/if}
      </div>
    </div>
  </Card>

  <p class="note">
    Integracje działają teraz na danych demonstracyjnych. Po dodaniu kluczy API (Strava, Withings) do
    konfiguracji serwera połączą się z prawdziwymi kontami — bez zmian w kodzie.
  </p>
</div>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    max-width: 720px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-4);
    flex-wrap: wrap;
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
  }
  .detail {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }
  .actions {
    display: inline-flex;
    gap: var(--space-2);
    align-items: center;
    flex-wrap: wrap;
  }
  .connect {
    display: inline-flex;
    align-items: center;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--color-accent);
    color: var(--color-text-on-accent, #fff);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    text-decoration: none;
  }
  .connect:hover {
    filter: brightness(1.05);
  }
  .msg {
    font-size: var(--text-sm);
    color: var(--color-accent);
  }
  .note {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
</style>
