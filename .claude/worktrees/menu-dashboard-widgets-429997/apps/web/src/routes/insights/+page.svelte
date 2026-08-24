<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { AppShell } from '$lib/ui';
  import SyncFooter from '$modules/sync/SyncFooter.svelte';
  import InsightsView from '$modules/insights/InsightsView.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // The window selector that used to live here is now the global range switch in the topbar
  // (spec 047) — this page just renders what the loader resolved for `?range=`.

  async function refresh(): Promise<void> {
    await invalidateAll();
  }
</script>

<svelte:head><title>Wnioski · Vagus</title></svelte:head>

<AppShell advanced title="Wnioski">
  {#snippet footer()}
    <SyncFooter />
  {/snippet}

  <InsightsView
    data={data.insights}
    range={data.range}
    analyticsFeature={data.analyticsFeature}
    onConsentChange={refresh}
  />
</AppShell>
