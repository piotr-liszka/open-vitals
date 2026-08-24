<script lang="ts">
  import { AppShell } from '$lib/ui';
  import SyncFooter from '$modules/sync/SyncFooter.svelte';
  import InsightsView from '$modules/insights/InsightsView.svelte';
  import { getI18n } from '$lib/i18n';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const i18n = getI18n();

  // The window selector that used to live here is now the global range switch in the topbar
  // (spec 047) — this page just renders what the loader resolved for `?range=`.
</script>

<svelte:head><title>{i18n.t('nav.insights')} · OpenVitals</title></svelte:head>

<AppShell title={i18n.t('nav.insights')}>
  {#snippet footer()}
    <SyncFooter />
  {/snippet}

  <InsightsView data={data.insights} range={data.range} />
</AppShell>
