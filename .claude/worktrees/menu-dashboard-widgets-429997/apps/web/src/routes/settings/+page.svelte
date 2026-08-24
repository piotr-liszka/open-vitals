<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { AppShell, Card } from '$lib/ui';
  import SyncFooter from '$modules/sync/SyncFooter.svelte';
  import ConsentPanel from '$modules/consent/ConsentPanel.svelte';
  import AdvancedModeToggle from '$modules/consent/AdvancedModeToggle.svelte';
  import ConnectionCard from '$modules/healthcheck/ConnectionCard.svelte';
  import SetupForm from '$modules/garmin-setup/SetupForm.svelte';
  import McpUrlCard from '$modules/mcp-url/McpUrlCard.svelte';
  import IntegrationsPanel from '$modules/integrations/IntegrationsPanel.svelte';
  import UpdateCard from '$modules/version/UpdateCard.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let disconnecting = $state(false);
  let refreshing = $state(false);

  async function refresh(): Promise<void> {
    await invalidateAll();
  }

  async function refreshStatus(): Promise<void> {
    refreshing = true;
    try {
      await invalidateAll();
    } finally {
      refreshing = false;
    }
  }

  async function disconnect(): Promise<void> {
    disconnecting = true;
    try {
      await fetch('/api/garmin/disconnect', { method: 'POST' });
      await invalidateAll();
    } finally {
      disconnecting = false;
    }
  }
</script>

<svelte:head><title>Ustawienia · Vagus</title></svelte:head>

<AppShell advanced={Boolean(data.advancedFeature?.enabled)} title="Ustawienia">
  {#snippet footer()}
    <SyncFooter />
  {/snippet}

  <div class="stack">
    <!-- Connection first: nothing else here works without it. -->
    <ConnectionCard
      status={data.health}
      onRefresh={refreshStatus}
      {refreshing}
      onDisconnect={disconnect}
      {disconnecting}
    >
      {#snippet connect()}
        <SetupForm onConnected={refresh} />
      {/snippet}
    </ConnectionCard>

    <McpUrlCard url={data.mcpUrl} connected={data.health.connected} />

    {#if data.advancedFeature}
      <Card
        title="Tryb zaawansowany"
        subtitle="Włącz lub wyłącz przetwarzanie danych — pulpit, analitykę i wnioski. Wyłączenie wraca do trybu podstawowego."
      >
        <AdvancedModeToggle feature={data.advancedFeature} onUpdated={refresh} />
      </Card>
    {/if}

    {#if data.features.length > 0}
      <Card
        title="Funkcje i zgody"
        subtitle="Włączaj i wyłączaj funkcje. Niektóre wymagają wcześniejszej akceptacji warunków."
      >
        <div class="features">
          {#each data.features as feature, i (feature.id)}
            {#if i > 0}<hr class="rule" />{/if}
            <ConsentPanel {feature} onUpdated={refresh} />
          {/each}
        </div>
      </Card>
    {/if}

    {#if data.integrations}
      <section class="integrations">
        <h2 class="section-title">Integracje</h2>
        <IntegrationsPanel status={data.integrations} />
      </section>
    {/if}

    <!-- Last: housekeeping, not something you come to Settings to do. -->
    <UpdateCard />
  </div>
</AppShell>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    max-width: 720px;
  }

  .section-title {
    font-size: var(--text-md);
    font-weight: var(--font-bold);
    margin: 0 0 var(--space-3);
  }
  .integrations {
    display: flex;
    flex-direction: column;
  }

  .features {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .rule {
    border: none;
    border-top: 1px solid var(--color-border);
    margin: 0;
  }
</style>
