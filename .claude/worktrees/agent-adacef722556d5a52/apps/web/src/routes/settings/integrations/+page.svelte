<script lang="ts">
  import { getI18n } from '$lib/i18n';

  const i18n = getI18n();
  // This route redirects to /settings in its loader (integrations moved into Settings). This markup
  // is never rendered; it exists only so the route is valid.
</script>

<p>{i18n.t('page.redirectingToSettings')}</p>
