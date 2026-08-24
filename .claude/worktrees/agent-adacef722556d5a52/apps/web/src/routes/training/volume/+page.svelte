<script lang="ts">
  import VolumeView from '$modules/volume/VolumeView.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<VolumeView data={data.volume} />
