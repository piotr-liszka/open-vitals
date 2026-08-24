<script lang="ts">
  import { AppShell } from '$lib/ui';
  import SyncFooter from '$modules/sync/SyncFooter.svelte';
  import ActivityDetail from '$modules/activity-detail/ActivityDetail.svelte';
  import SessionRpe from '$modules/journal/SessionRpe.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const title = $derived(data.detail.activity.name ?? 'Aktywność');
</script>

<svelte:head><title>{title} · OpenVitals</title></svelte:head>

<AppShell title="Aktywność">
  {#snippet footer()}
    <SyncFooter />
  {/snippet}

  <ActivityDetail data={data.detail} />

  <!-- Spec 062: below the session's own numbers, because RPE is read against them, not instead. -->
  <div class="rpe">
    <SessionRpe activityId={data.detail.activity.id} day={data.day} entry={data.rpeEntry} />
  </div>
</AppShell>

<style>
  .rpe {
    margin-top: var(--space-5);
  }
</style>
