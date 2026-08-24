<script lang="ts">
  /**
   * The season page (spec 060) — goals, what phase each is in, and whether the current trajectory
   * gets there.
   *
   * Deliberately NOT range-driven (spec 047), like the PMC card it sits beside: a goal's horizon is
   * the goal's own, and the global 7-day window would truncate a sixteen-week build into nothing.
   */
  import { invalidateAll } from '$app/navigation';
  import { Banner, Button, Card, InfoPopover, toasts } from '$lib/ui';
  import { formatDay } from '$lib/date';
  import GoalCard from './GoalCard.svelte';
  import GoalForm from './GoalForm.svelte';
  import type { GoalSuggestion, SeasonData } from './season.types';
  import { formatNumber, getI18n } from '$lib/i18n';

  const i18n = getI18n();

  let { data }: { data: SeasonData } = $props();

  let busy = $state<string | null>(null);

  const future = $derived(data.goals.filter((g) => g.daysOut >= 0));
  const past = $derived(data.goals.filter((g) => g.daysOut < 0));

  const nf1 = (n: number): string => formatNumber(i18n.locale, n, { maximumFractionDigits: 1 });

  async function remove(id: string): Promise<void> {
    busy = id;
    try {
      const res = await fetch(`/api/season/goals/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toasts.error(i18n.t('season.deleteFailed'));
        return;
      }
      toasts.success(i18n.t('season.deleted'));
      await invalidateAll();
    } catch {
      toasts.error(i18n.t('season.networkError'));
    } finally {
      busy = null;
    }
  }

  /** Adopt a race Garmin already knows about, so the athlete does not retype it. */
  async function adopt(s: GoalSuggestion): Promise<void> {
    busy = s.eventId;
    try {
      const res = await fetch('/api/season/goals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          day: s.day,
          sport: s.sport,
          title: s.title,
          kind: 'race',
          priority: 'a',
          distanceM: s.distanceM,
          garminEventId: s.eventId
        })
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toasts.error(body.error ?? i18n.t('season.addFailed'));
        return;
      }
      toasts.success(i18n.t('season.adopted'));
      await invalidateAll();
    } catch {
      toasts.error(i18n.t('season.networkError'));
    } finally {
      busy = null;
    }
  }
</script>

<div class="page">
  <Card title={i18n.t('season.pageTitle')} subtitle={i18n.t('season.pageSubtitle')} overflowVisible>
    {#snippet actions()}
      <InfoPopover label={i18n.t('season.explainLabel')} title={i18n.t('season.explainTitle')}>
        <p>{i18n.t('season.explainBody')}</p>
      </InfoPopover>
    {/snippet}
    <GoalForm sports={data.sports} today={data.today} />
  </Card>

  {#if data.suggestions.length > 0}
    <Card title={i18n.t('season.suggestionsTitle')} subtitle={i18n.t('season.suggestionsSubtitle')}>
      <ul class="suggestions">
        {#each data.suggestions as s (s.eventId)}
          <li class="suggestion">
            <div>
              <p class="s-title">{s.title}</p>
              <p class="s-meta">
                {s.sportLabel} · {formatDay(i18n.locale, s.day, 'longYear')}
                {#if s.distanceM !== null}
                  · {nf1(s.distanceM / 1000)} km{/if}
              </p>
            </div>
            <Button variant="secondary" disabled={busy === s.eventId} onclick={() => adopt(s)}>
              {i18n.t('season.addAsGoal')}
            </Button>
          </li>
        {/each}
      </ul>
    </Card>
  {/if}

  {#if future.length === 0 && past.length === 0}
    <Card title={i18n.t('season.emptyTitle')}>
      <p class="empty">
        {i18n.t('season.emptyBody')}
      </p>
    </Card>
  {/if}

  {#if !data.hasData && (future.length > 0 || past.length > 0)}
    <Banner tone="info" title={i18n.t('season.noHistoryTitle')}>
      {i18n.t('season.noHistoryBody')}
    </Banner>
  {/if}

  {#each future as status (status.goal.id)}
    <GoalCard {status} onDelete={busy === status.goal.id ? undefined : remove} />
  {/each}

  {#if past.length > 0}
    <h2 class="section">{i18n.t('season.pastHeading')}</h2>
    {#each past as status (status.goal.id)}
      <GoalCard {status} onDelete={busy === status.goal.id ? undefined : remove} />
    {/each}
  {/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .empty {
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
    margin-bottom: var(--space-5);
  }

  .empty {
    margin-bottom: 0;
  }

  .suggestions {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .suggestion {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3) 0;
    border-bottom: 1px solid var(--color-border);
  }

  .suggestion:last-child {
    border-bottom: none;
  }

  .s-title {
    font-weight: var(--font-medium);
    color: var(--color-text);
  }

  .s-meta {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .section {
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
    margin-top: var(--space-4);
  }
</style>
