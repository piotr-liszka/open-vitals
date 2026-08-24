<script lang="ts">
  import { AppShell } from '$lib/ui';
  import SyncFooter from '$modules/sync/SyncFooter.svelte';
  import DataView from '$modules/sync/DataView.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Dane · OpenVitals</title></svelte:head>

<AppShell title="Twoje dane">
  {#snippet footer()}
    <SyncFooter />
  {/snippet}

  <DataView coverage={data.coverage} lastRun={data.lastRun} connected={data.connected} prompt={data.prompt} />
</AppShell>
