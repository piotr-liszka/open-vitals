<script lang="ts">
  /**
   * The Garmin integration card (spec 021, re-scoped in spec 071). It shows the live status beacon,
   * reachability, account name and session validity, owns the connect / disconnect affordances, and
   * carries Garmin's own switches in the `settings` slot — so everything about this one integration
   * is answerable from one card. Presentational: all data is passed in, all actions delegated.
   */
  import type { Snippet } from 'svelte';
  import { Card, Badge, Button } from '$lib/ui';
  import type { HealthStatus } from './health.types';

  interface Props {
    status: HealthStatus;
    /** Called when the user asks for a fresh status read. Omit to hide the button. */
    onRefresh?: () => void;
    refreshing?: boolean;
    /** Called once the user confirms disconnecting. Omit to hide the button. */
    onDisconnect?: () => void;
    disconnecting?: boolean;
    /** Rendered while the account is not connected — e.g. the Garmin setup form. */
    connect?: Snippet;
    /** This integration's own switches, rendered under the status (spec 071). */
    settings?: Snippet;
  }
  let {
    status,
    onRefresh,
    refreshing = false,
    onDisconnect,
    disconnecting = false,
    connect,
    settings
  }: Props = $props();

  let confirming = $state(false);

  const tone = $derived(!status.reachable ? 'warning' : status.connected ? 'success' : 'danger');
  const label = $derived(
    !status.reachable ? 'Niedostępny' : status.connected ? 'Połączono' : 'Nie połączono'
  );
</script>

<Card
  title="Garmin"
  subtitle="Źródło wszystkich danych w tej aplikacji. Nie przechowujemy Twojego loginu — tylko zaszyfrowane tokeny, które zwraca Garmin."
>
  {#snippet actions()}
    {#if onRefresh}
      <Button size="sm" variant="ghost" loading={refreshing} onclick={onRefresh}>Odśwież</Button>
    {/if}
  {/snippet}

  <div class="body">
    <div class="status">
      <span class="beacon {tone}" aria-hidden="true"></span>
      <Badge {tone}>{label}</Badge>
      {#if status.displayName}<span class="who">{status.displayName}</span>{/if}
    </div>

    <dl class="meta">
      {#if status.expiresAt}
        <div>
          <dt>Sesja ważna do</dt>
          <dd>{new Date(status.expiresAt).toLocaleString('pl-PL')}</dd>
        </div>
      {/if}
      {#if !status.reachable}
        <div>
          <dt>Szczegóły</dt>
          <dd>Nie udało się połączyć z usługą Garmin. Spróbujemy ponownie automatycznie.</dd>
        </div>
      {/if}
    </dl>

    {#if status.connected}
      {#if onDisconnect}
        <div class="row">
          {#if confirming}
            <span class="confirm-q">Rozłączyć i usunąć zapisane tokeny?</span>
            <div class="confirm-actions">
              <Button size="sm" variant="ghost" onclick={() => (confirming = false)}>Anuluj</Button>
              <Button size="sm" variant="danger" loading={disconnecting} onclick={onDisconnect}>
                Rozłącz
              </Button>
            </div>
          {:else}
            <Button size="sm" variant="secondary" onclick={() => (confirming = true)}>Rozłącz Garmina</Button>
          {/if}
        </div>
      {/if}
    {:else if connect}
      <div class="connect">
        {@render connect()}
      </div>
    {/if}

    {#if settings}
      <hr class="rule" />
      <div class="settings">{@render settings()}</div>
    {/if}
  </div>
</Card>

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .status {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .who {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text);
  }
  .beacon {
    width: 10px;
    height: 10px;
    border-radius: var(--radius-full);
    flex-shrink: 0;
  }
  .beacon.success {
    background: var(--color-success);
    box-shadow: 0 0 0 4px var(--color-success-soft);
  }
  .beacon.danger {
    background: var(--color-danger);
    box-shadow: 0 0 0 4px var(--color-danger-soft);
  }
  .beacon.warning {
    background: var(--color-warning);
    box-shadow: 0 0 0 4px var(--color-warning-soft);
  }
  .meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
  }
  .meta div {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    font-size: var(--text-sm);
  }
  .meta dt {
    color: var(--color-text-muted);
  }
  .meta dd {
    margin: 0;
    color: var(--color-text);
    font-weight: var(--font-medium);
    text-align: right;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-4);
    flex-wrap: wrap;
  }
  .confirm-q {
    font-size: var(--text-sm);
    color: var(--color-text-on-surface);
  }
  .confirm-actions {
    display: inline-flex;
    gap: var(--space-2);
  }
  .connect {
    padding-top: var(--space-1);
  }
  .rule {
    border: none;
    border-top: 1px solid var(--color-border);
    margin: 0;
    width: 100%;
  }
  .settings {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
</style>
