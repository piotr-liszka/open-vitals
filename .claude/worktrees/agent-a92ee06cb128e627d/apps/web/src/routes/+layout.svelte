<script lang="ts">
  import '$lib/styles/global.css';
  import { ToastContainer } from '$lib/ui';
  import { setI18nContext } from '$lib/i18n';
  import type { Snippet } from 'svelte';
  import type { LayoutData } from './$types';

  interface Props {
    data: LayoutData;
    children?: Snippet;
  }

  let { data, children }: Props = $props();

  // The active language, published once for the whole tree (spec 076). A getter, not a snapshot:
  // after a switch `invalidateAll()` refreshes `data.locale`, and every consumer re-reads it here
  // instead of holding a copy that has quietly gone stale.
  setI18nContext(() => data.locale);

  // `<html lang>` is server-rendered from the same value; keep it true across client-side switches,
  // where no new document is fetched and the attribute would otherwise keep the old language.
  $effect(() => {
    document.documentElement.lang = data.locale;
  });
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
