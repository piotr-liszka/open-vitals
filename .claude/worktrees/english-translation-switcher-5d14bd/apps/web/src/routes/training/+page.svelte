<script lang="ts">
  import TrainingOverview from '$modules/training/TrainingOverview.svelte';
  import WeeklySportSummary from '$modules/weekly-summary/WeeklySportSummary.svelte';
  import BlockCard from '$modules/block/BlockCard.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<!-- The block card leads when there is a plan (spec 073): "what was this week supposed to be" comes
     before "what have I done", and without a block it collapses to one line of explanation. The
     weekly card follows — the one thing here that needs no model explained to be read (spec 056). -->
<div class="page">
  <BlockCard week={data.block.week} />
  <WeeklySportSummary data={data.weekly} />
  <TrainingOverview data={data.overview} />
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
</style>
