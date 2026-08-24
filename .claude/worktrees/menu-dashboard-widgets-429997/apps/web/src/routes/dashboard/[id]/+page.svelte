<script lang="ts">
  import { AppShell } from '$lib/ui';
  import SyncFooter from '$modules/sync/SyncFooter.svelte';
  import DashboardGrid from '$modules/dashboards/DashboardGrid.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.dashboard.name} · Vagus</title></svelte:head>

<AppShell title={data.dashboard.name} tier="advanced" advanced>
  {#snippet footer()}
    <SyncFooter />
  {/snippet}

  <!-- Keyed on the dashboard so moving between panels REMOUNTS the grid. The grid forks the config
       into local editable state; without this it would carry one dashboard's half-finished edit state
       onto the next one. -->
  {#key data.dashboard.id}
    <DashboardGrid config={data.config} dashboardId={data.dashboard.id} data={data.widgetData} />
  {/key}
</AppShell>
