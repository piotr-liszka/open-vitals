<script lang="ts">
  import { AppShell } from '$lib/ui';
  import SyncFooter from '$modules/sync/SyncFooter.svelte';
  import DashboardCreate from '$modules/dashboards/DashboardCreate.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Nowy panel · OpenVitals</title></svelte:head>

<!-- `range="off"`: an empty create form displays no windowed data, so the switch would be a control
     with no effect (spec 047). -->
<AppShell title="Nowy panel" range="off">
  {#snippet footer()}
    <SyncFooter />
  {/snippet}

  <DashboardCreate config={data.config} />
</AppShell>
