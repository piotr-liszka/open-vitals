<script lang="ts">
  /**
   * How hard THIS session felt (spec 062).
   *
   * It lives on the activity page rather than in the daily check-in because RPE describes one
   * workout: "should have been 7, felt like 9" is the sentence a coach acts on, and a day-level
   * score cannot say it when there were two sessions. That comparison is also why this sits beside
   * the session's own numbers — an RPE read apart from the pace and heart rate it belongs to is
   * just a number.
   */
  import { untrack } from 'svelte';
  import Card from '$lib/ui/Card.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import { toasts } from '$lib/ui/toast';
  import type { JournalEntry } from './journal.types';

  let {
    activityId,
    day,
    entry = null
  }: { activityId: string; day: string; entry?: JournalEntry | null } = $props();

  // Seeded once — the athlete's working copy from here on. See CheckInCard for the same reasoning.
  let rpe = $state<number | null>(untrack(() => entry?.rpe ?? null));
  let saving = $state(false);

  const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  /** The Borg anchors, so a number picked here means the same thing next month. */
  const HINT: Record<number, string> = {
    1: 'bardzo lekko',
    3: 'lekko',
    5: 'umiarkowanie',
    7: 'ciężko',
    9: 'bardzo ciężko',
    10: 'maksymalnie'
  };

  const hint = $derived(rpe === null ? null : (HINT[rpe] ?? null));

  async function save(value: number): Promise<void> {
    if (saving) return;
    const next = rpe === value ? null : value;
    saving = true;
    try {
      const res = await fetch('/api/journal', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ day, activityId, rpe: next })
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        toasts.error(body?.error ?? 'Nie udało się zapisać RPE');
        return;
      }
      rpe = next;
      toasts.success(next === null ? 'Usunięto RPE' : `Zapisano RPE ${next}`);
    } catch {
      toasts.error('Nie udało się zapisać RPE');
    } finally {
      saving = false;
    }
  }
</script>

<Card title="Jak ciężko było?" subtitle="RPE — odczuwany wysiłek, 1–10">
  <div class="scores" role="group" aria-label="RPE w skali 1–10">
    {#each SCORES as value (value)}
      <button
        type="button"
        class="score"
        class:on={rpe === value}
        aria-pressed={rpe === value}
        disabled={saving}
        onclick={() => save(value)}
      >
        {value}
      </button>
    {/each}
  </div>

  <p class="hint">
    {#if rpe === null}
      Twoja ocena, nie zegarka. Próg, który czuł się jak dziewiątka, mówi więcej niż średnie tętno.
    {:else}
      <Badge tone="info">RPE {rpe}</Badge>
      {#if hint}<span class="anchor">{hint}</span>{/if}
    {/if}
  </p>
</Card>

<style>
  .scores {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .score {
    flex: 1 1 2rem;
    min-width: 2rem;
    padding: var(--space-2) 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  .score:hover:not(:disabled) {
    border-color: var(--color-border-strong);
    color: var(--color-text);
  }

  .score:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .score:disabled {
    cursor: progress;
  }

  .score.on {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
    color: var(--color-text);
    font-weight: var(--font-semibold);
  }

  .hint {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: var(--space-3) 0 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .anchor {
    font-style: italic;
  }
</style>
