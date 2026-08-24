<script lang="ts">
  import { page } from '$app/stores';
  import { AppShell, SubNav } from '$lib/ui';
  import SyncFooter from '$modules/sync/SyncFooter.svelte';
  import ActivitiesView from '$modules/activities/ActivitiesView.svelte';
  import { ACTIVITIES_TABS, activitiesTitle } from '$modules/activities/activities-nav';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const title = $derived(activitiesTitle($page.url.pathname));
</script>

<svelte:head><title>{title} · Vagus</title></svelte:head>

<AppShell advanced {title} tier="advanced">
  {#snippet footer()}
    <SyncFooter />
  {/snippet}

  <div class="section">
    <SubNav items={[...ACTIVITIES_TABS]} current={$page.url.pathname} ariaLabel="Sekcja aktywności" />
    <ActivitiesView data={data.activities} />
  </div>
</AppShell>

<style>
  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
</style>
