<script lang="ts">
  import '$lib/styles/global.css';
  import { ToastContainer } from '$lib/ui';
  import type { Snippet } from 'svelte';

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();
</script>

<!--
  IMPECCABLE DIRECTION CONTRACT — OpenVitals (athletic/energetic, Operate)
  THESIS: A personal race-telemetry instrument for your own body data. Refuses the generic
    admin-card dashboard and the neon-on-black fitness cliché.
  OWN-WORLD: Ink chassis + signal-magenta signature; ink-on-magenta controls; per-metric "lane"
    colors; heavy tabular numerals as the hero; crisp hairline grids; snappy ease-out motion.
  STORY: Owner glances in, reads connection + today's readiness + the week's trend, trusts that
    nothing leaves the LAN, and opts into deeper analytics knowingly.
  FIRST VIEWPORT: Left rail nav; header with status pill; a today-snapshot row of large numeric
    lane tiles; weekly trend sparklines (consent-gated); MCP URL. Primary action = connect/consent.
  FORM: Instrument/telemetry panel (user-pinned world; concept-seed roll skipped per pin).
  FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->
{@render children?.()}

<ToastContainer />
