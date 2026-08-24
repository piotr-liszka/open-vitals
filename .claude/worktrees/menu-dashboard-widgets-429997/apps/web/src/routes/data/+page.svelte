<script lang="ts">
  import { AppShell } from '$lib/ui';
  import SyncFooter from '$modules/sync/SyncFooter.svelte';
  import DataView from '$modules/sync/DataView.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Dane · Vagus</title></svelte:head>

<AppShell advanced={data.advanced} title="Twoje dane" tier={data.advanced ? 'advanced' : 'base'}>
  {#snippet footer()}
    <SyncFooter />
  {/snippet}

  <DataView coverage={data.coverage} lastRun={data.lastRun} connected={data.connected} prompt={data.prompt} />
</AppShell>
