<script lang="ts">
  import { AppShell } from '$lib/ui';
  import SyncFooter from '$modules/sync/SyncFooter.svelte';
  import ActivityDetail from '$modules/activity-detail/ActivityDetail.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const title = $derived(data.detail.activity.name ?? 'Aktywność');
</script>

<svelte:head><title>{title} · Vagus</title></svelte:head>

<AppShell advanced title="Aktywność" tier="advanced">
  {#snippet footer()}
    <SyncFooter />
  {/snippet}

  <ActivityDetail data={data.detail} />
</AppShell>
