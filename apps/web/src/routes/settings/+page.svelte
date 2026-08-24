<script lang="ts">
  /**
   * Settings is one list of integrations (spec 071). Each card is a whole integration: what it is,
   * whether it is connected, and every switch that belongs to it. There is no separate "features"
   * list any more — a switch that lives away from the thing it switches is a switch nobody finds.
   */
  import { invalidateAll } from '$app/navigation';
  import { AppShell } from '$lib/ui';
  import SyncFooter from '$modules/sync/SyncFooter.svelte';
  import FeatureSwitch from '$modules/features/FeatureSwitch.svelte';
  import ConnectionCard from '$modules/healthcheck/ConnectionCard.svelte';
  import SetupForm from '$modules/garmin-setup/SetupForm.svelte';
  import McpUrlCard from '$modules/mcp-url/McpUrlCard.svelte';
  import IntegrationsPanel from '$modules/integrations/IntegrationsPanel.svelte';
  import UpdateCard from '$modules/version/UpdateCard.svelte';
  import ProfileCard from '$modules/settings/ProfileCard.svelte';
  import AccountCard from '$modules/account/AccountCard.svelte';
  import SessionsCard from '$modules/account/SessionsCard.svelte';
  import { getI18n } from '$lib/i18n';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const i18n = getI18n();

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

  const mcpEnabled = $derived(data.mcpFeatures.find((f) => f.id === 'mcp')?.enabled ?? true);
</script>

<svelte:head><title>{i18n.t('nav.settings')} · OpenVitals</title></svelte:head>

<AppShell title={i18n.t('nav.settings')}>
  {#snippet footer()}
    <SyncFooter />
  {/snippet}

  <div class="stack">
    <section class="section">
      <h2 class="section-title">{i18n.t('settings.integrationsSection')}</h2>
      <div class="cards">
        <!-- Garmin first: it is the only integration the rest of the app cannot work without. -->
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
          {#snippet settings()}
            {#each data.garminFeatures as feature (feature.id)}
              <FeatureSwitch {feature} onUpdated={refresh} />
            {/each}
          {/snippet}
        </ConnectionCard>

        <McpUrlCard url={data.mcpUrl} connected={data.health.connected} enabled={mcpEnabled}>
          {#snippet settings()}
            {#each data.mcpFeatures as feature (feature.id)}
              <FeatureSwitch {feature} onUpdated={refresh} />
            {/each}
          {/snippet}
        </McpUrlCard>

        <IntegrationsPanel status={data.integrations} />
      </div>
    </section>

    <!-- After the integrations, because these numbers only mean anything once data is flowing. -->
    <section class="section">
      <h2 class="section-title">{i18n.t('profile.section')}</h2>
      <div class="cards">
        <ProfileCard profile={data.profile} />
      </div>
    </section>

    <!-- My account (spec 094): password + linked-method status, and this user's own sessions —
         after the integrations/profile, before housekeeping. -->
    {#if data.account}
      <section class="section">
        <h2 class="section-title">{i18n.t('settings.accountSection')}</h2>
        <div class="cards">
          <AccountCard account={data.account} />
          <SessionsCard sessions={data.sessions} />
        </div>
      </section>
    {/if}

    <!-- Last: housekeeping, not something you come to Settings to do. -->
    <section class="section">
      <h2 class="section-title">{i18n.t('settings.appSection')}</h2>
      <div class="cards">
        <UpdateCard />
      </div>
    </section>
  </div>
</AppShell>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-8);
    max-width: 720px;
  }

  .section {
    display: flex;
    flex-direction: column;
  }

  .section-title {
    font-size: var(--text-md);
    font-weight: var(--font-bold);
    margin: 0 0 var(--space-3);
  }

  .cards {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
</style>
