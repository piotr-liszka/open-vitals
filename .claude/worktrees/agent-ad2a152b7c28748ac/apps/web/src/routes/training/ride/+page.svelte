<script lang="ts">
  import PowerView from '$modules/power/PowerView.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<PowerView data={data.power} />
