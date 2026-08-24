<script lang="ts">
  /**
   * Create a dashboard (spec 064). A page rather than a button in the sidebar, for two reasons: the
   * name is asked for up front (it becomes the nav entry, so an unnamed "Panel 3" is a bad default to
   * live with), and the app sets `data-sveltekit-preload-data="hover"` — a create-on-GET route would
   * make a dashboard every time the pointer crossed the link.
   */
  import Button from '$lib/ui/Button.svelte';
  import Card from '$lib/ui/Card.svelte';
  import Field from '$lib/ui/Field.svelte';
  import Input from '$lib/ui/Input.svelte';
  import { toasts } from '$lib/ui/toast';
  import { goto, invalidateAll } from '$app/navigation';
  import { dashboardHref } from './dashboard-nav';
  import { MAX_DASHBOARD_NAME, type DashboardConfig } from './dashboards.types';

  let { config }: { config: DashboardConfig } = $props();

  let name = $state('');
  let saving = $state(false);

  const trimmed = $derived(name.trim());
  const canSubmit = $derived(trimmed.length > 0 && !saving);

  /**
   * A URL-safe id derived from the name, so `/dashboard/plan-startowy` reads as the thing it shows.
   * The server sanitises and de-duplicates this again — it is untrusted input like any other — so a
   * collision here costs a suffix, not a broken page.
   */
  function idFrom(label: string): string {
    const base = label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip the accents NFD just split off
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    // A name of pure punctuation or non-Latin script leaves nothing behind; fall back to a
    // positional id rather than to an empty route segment.
    return base || `panel-${config.dashboards.length + 1}`;
  }

  async function create(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!canSubmit) return;
    saving = true;

    const id = idFrom(trimmed);
    const next: DashboardConfig = {
      dashboards: [...config.dashboards, { id, name: trimmed.slice(0, MAX_DASHBOARD_NAME), widgets: [] }]
    };

    try {
      const res = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(next)
      });
      if (!res.ok) {
        toasts.error('Nie udało się utworzyć panelu');
        return;
      }
      // The server may have suffixed the id to avoid a collision, so navigate to what it actually
      // stored rather than to what we asked for.
      const saved = (await res.json()) as DashboardConfig;
      const created = saved.dashboards[saved.dashboards.length - 1];
      await invalidateAll();
      await goto(dashboardHref(created?.id ?? id));
    } finally {
      saving = false;
    }
  }
</script>

<div class="wrap">
  <Card>
    <form onsubmit={create}>
      <h2 class="title">Nowy panel</h2>
      <p class="lead">Panel to Twój własny zestaw widgetów. Widgety dodasz na następnym ekranie.</p>

      <Field label="Nazwa panelu" help="Pojawi się w menu. Możesz ją później zmienić.">
        {#snippet children(control)}
          <Input
            id={control.id}
            aria-describedby={control.describedBy}
            bind:value={name}
            maxlength={MAX_DASHBOARD_NAME}
            placeholder="np. Plan startowy"
            autocomplete="off"
          />
        {/snippet}
      </Field>

      <div class="actions">
        <Button type="button" size="sm" variant="ghost" onclick={() => history.back()}>Anuluj</Button>
        <Button type="submit" size="sm" variant="primary" disabled={!canSubmit}>
          {saving ? 'Tworzę…' : 'Utwórz panel'}
        </Button>
      </div>
    </form>
  </Card>
</div>

<style>
  .wrap {
    max-width: 32rem;
  }
  .title {
    margin: 0 0 var(--space-2);
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-tight);
  }
  .lead {
    margin: 0 0 var(--space-5);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-5);
  }
</style>
