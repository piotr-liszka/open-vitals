<script lang="ts">
  /**
   * The season page (spec 060) — goals, what phase each is in, and whether the current trajectory
   * gets there.
   *
   * Deliberately NOT range-driven (spec 047), like the PMC card it sits beside: a goal's horizon is
   * the goal's own, and the global 7-day window would truncate a sixteen-week build into nothing.
   */
  import { invalidateAll } from '$app/navigation';
  import { Banner, Button, Card, toasts } from '$lib/ui';
  import { formatDay } from '$lib/date';
  import GoalCard from './GoalCard.svelte';
  import GoalForm from './GoalForm.svelte';
  import type { GoalSuggestion, SeasonData } from './season.types';

  let { data }: { data: SeasonData } = $props();

  let busy = $state<string | null>(null);

  const future = $derived(data.goals.filter((g) => g.daysOut >= 0));
  const past = $derived(data.goals.filter((g) => g.daysOut < 0));

  const nf1 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 });

  async function remove(id: string): Promise<void> {
    busy = id;
    try {
      const res = await fetch(`/api/season/goals/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toasts.error('Nie udało się usunąć celu.');
        return;
      }
      toasts.success('Cel usunięty.');
      await invalidateAll();
    } catch {
      toasts.error('Nie udało się połączyć z serwerem.');
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
        toasts.error(body.error ?? 'Nie udało się dodać celu.');
        return;
      }
      toasts.success('Start dodany jako cel.');
      await invalidateAll();
    } catch {
      toasts.error('Nie udało się połączyć z serwerem.');
    } finally {
      busy = null;
    }
  }
</script>

{#if !data.enabled}
  <Banner tone="info" title="Ta sekcja wymaga trybu zaawansowanego">
    Cele sezonu liczone są z Twojej historii treningowej, więc wymagają zgody na przetwarzanie danych.
  </Banner>
{:else}
  <div class="page">
    <Card
      title="Cele sezonu"
      subtitle="Jedyne miejsce w aplikacji, które patrzy do przodu — reszta opisuje to, co już było"
    >
      <p class="intro">
        Podaj datę i dyscyplinę, a odliczanie, faza przygotowań i trajektoria formy policzą się z danych,
        które już tu są. Cele bez docelowej formy też mają sens — dostaniesz odliczanie i fazę, tylko bez
        oceny „czy zdążę”.
      </p>
      <GoalForm sports={data.sports} today={data.today} />
    </Card>

    {#if data.suggestions.length > 0}
      <Card
        title="Starty z kalendarza Garmin"
        subtitle="Już je synchronizujemy — jeden klik i stają się celem"
      >
        <ul class="suggestions">
          {#each data.suggestions as s (s.eventId)}
            <li class="suggestion">
              <div>
                <p class="s-title">{s.title}</p>
                <p class="s-meta">
                  {s.sportLabel} · {formatDay(s.day, 'longYear')}
                  {#if s.distanceM !== null}
                    · {nf1.format(s.distanceM / 1000)} km{/if}
                </p>
              </div>
              <Button variant="secondary" disabled={busy === s.eventId} onclick={() => adopt(s)}>
                Dodaj jako cel
              </Button>
            </li>
          {/each}
        </ul>
      </Card>
    {/if}

    {#if future.length === 0 && past.length === 0}
      <Card title="Jeszcze nic tu nie ma">
        <p class="empty">
          Nie masz jeszcze żadnego celu. Dodaj start albo datę, na którą chcesz mieć formę — od tego momentu
          wszystkie liczby w aplikacji dostają kierunek.
        </p>
      </Card>
    {/if}

    {#if !data.hasData && (future.length > 0 || past.length > 0)}
      <Banner tone="info" title="Brak historii treningowej">
        Cele są zapisane, ale bez zsynchronizowanych aktywności nie ma z czego policzyć trajektorii.
      </Banner>
    {/if}

    {#each future as status (status.goal.id)}
      <GoalCard {status} onDelete={busy === status.goal.id ? undefined : remove} />
    {/each}

    {#if past.length > 0}
      <h2 class="section">Za Tobą</h2>
      {#each past as status (status.goal.id)}
        <GoalCard {status} onDelete={busy === status.goal.id ? undefined : remove} />
      {/each}
    {/if}
  </div>
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .intro,
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
