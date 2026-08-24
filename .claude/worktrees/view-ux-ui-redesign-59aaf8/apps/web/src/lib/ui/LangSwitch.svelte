<script lang="ts">
  /**
   * The language switch (spec 076) — one control, rendered by `AppShell`, so every page inside the
   * shell has it without wiring, and mountable on the logged-out screens too.
   *
   * Connected rather than presentational, for the same reason `RangeSwitch` is: threading a value
   * and a handler through all fifteen pages that mount `AppShell` is exactly the duplication that
   * lets two copies of one control drift apart. It owns two things:
   *
   *  - **The write.** `PUT /api/settings/locale` stores the choice on the user's account (and sets
   *    the cookie), so it follows them to other devices instead of living in this browser.
   *  - **The re-render.** `invalidateAll()` re-runs every loader, so the SERVER renders the new
   *    language. Swapping strings client-side would leave `<html lang>`, server-formatted numbers
   *    and anything computed in a loader still speaking the old one.
   *
   * The visible label is the accessible name (`PL` / `EN`); the group carries the fuller context.
   */
  import { invalidateAll } from '$app/navigation';
  import SegmentedControl from './SegmentedControl.svelte';
  import { LOCALES, getI18n, type Locale } from '$lib/i18n';

  interface Props {
    size?: 'sm' | 'md';
  }

  let { size = 'sm' }: Props = $props();

  const i18n = getI18n();

  const options = $derived(
    LOCALES.map((locale) => ({
      value: locale,
      label: i18n.t(locale === 'pl' ? 'lang.plShort' : 'lang.enShort')
    }))
  );

  /**
   * True while the round-trip is in flight. The control stays interactive — a second click just
   * supersedes the first — but a failed write must not leave the UI claiming a language the server
   * never stored, so `active` keeps reading from the server-resolved locale rather than from a
   * local optimistic copy.
   */
  let pending = $state(false);

  const active = $derived(i18n.locale);

  async function pick(value: string): Promise<void> {
    const locale = value as Locale;
    if (locale === active) return;
    pending = true;
    try {
      await fetch('/api/settings/locale', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ locale })
      });
      // Re-runs the loaders, so the next paint comes from the server in the new language.
      await invalidateAll();
    } finally {
      pending = false;
    }
  }
</script>

<div class="lang-switch" class:pending>
  <SegmentedControl
    {options}
    value={active}
    ariaLabel={i18n.t('lang.label')}
    {size}
    onChange={(value) => void pick(value)}
  />
</div>

<style>
  .lang-switch {
    display: inline-flex;
    /* Never the thing that collapses when the topbar runs out of room (spec 034): a reader who
       cannot read the current language needs this control most exactly when space is tightest. */
    flex-shrink: 0;
  }

  /* The page is about to be replaced wholesale; dim rather than disable, so the control never
     traps a keyboard user mid-switch. */
  .lang-switch.pending {
    opacity: 0.6;
  }
</style>
