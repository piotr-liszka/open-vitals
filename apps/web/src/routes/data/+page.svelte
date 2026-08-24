<script lang="ts">
  import { AppShell } from '$lib/ui';
  import SyncFooter from '$modules/sync/SyncFooter.svelte';
  import DataView from '$modules/sync/DataView.svelte';
  import { getI18n } from '$lib/i18n';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const i18n = getI18n();
</script>

<svelte:head><title>{i18n.t('nav.data')} · OpenVitals</title></svelte:head>

<AppShell title={i18n.t('page.yourData')}>
  {#snippet footer()}
    <SyncFooter />
  {/snippet}

  <DataView coverage={data.coverage} lastRun={data.lastRun} connected={data.connected} prompt={data.prompt} />
</AppShell>
