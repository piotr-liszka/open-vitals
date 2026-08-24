<script lang="ts">
  import { page } from '$app/stores';
  import { AppShell, SubNav } from '$lib/ui';
  import SyncFooter from '$modules/sync/SyncFooter.svelte';
  import HeatmapView from '$modules/heatmap/HeatmapView.svelte';
  import { ACTIVITIES_TABS, activitiesTitle } from '$modules/activities/activities-nav';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const title = $derived(activitiesTitle($page.url.pathname));
</script>

<svelte:head><title>{title} · OpenVitals</title></svelte:head>

<AppShell {title}>
  {#snippet footer()}
    <SyncFooter />
  {/snippet}

  <!-- The map sizes itself against the viewport, so it has to be told how much vertical space the
       tab row above it takes; otherwise it overflows by exactly that much. -->
  <div class="section">
    <SubNav items={[...ACTIVITIES_TABS]} current={$page.url.pathname} ariaLabel="Sekcja aktywności" />
    <HeatmapView data={data.heatmap} />
  </div>
</AppShell>

<style>
  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    --heatmap-offset: calc(var(--space-10) + var(--space-2) + var(--space-6));
  }
</style>
