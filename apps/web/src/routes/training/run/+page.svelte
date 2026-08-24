<script lang="ts">
  import RunningView from '$modules/running/RunningView.svelte';
  import BestEffortsCard from '$modules/best-efforts/BestEffortsCard.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<!-- The records card is passed IN rather than imported by RunningView: two modules, and a module may
     not reach into another's folder (AGENTS.md §5). The running view still decides where it sits. -->
<RunningView data={data.running}>
  {#snippet records()}
    <BestEffortsCard data={data.bestEfforts} />
  {/snippet}
</RunningView>
