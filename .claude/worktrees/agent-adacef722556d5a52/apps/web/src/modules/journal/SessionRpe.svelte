<script lang="ts">
  /**
   * How hard THIS session felt (spec 062).
   *
   * It lives on the activity page rather than in the daily check-in because RPE describes one
   * workout: "should have been 7, felt like 9" is the sentence a coach acts on, and a day-level
   * score cannot say it when there were two sessions. That comparison is also why this sits beside
   * the session's own numbers — an RPE read apart from the pace and heart rate it belongs to is
   * just a number.
   *
   * The picker is the shared `ScoreScale` (spec 080): the check-in asks the same kind of question, and
   * one control means one keyboard behaviour and one idea of what "10" means.
   */
  import { untrack } from 'svelte';
  import Card from '$lib/ui/Card.svelte';
  import ScoreScale from '$lib/ui/ScoreScale.svelte';
  import { toasts } from '$lib/ui/toast';
  import { SCORE_MAX, SCORE_MIN, type JournalEntry } from './journal.types';

  let {
    activityId,
    day,
    entry = null
  }: { activityId: string; day: string; entry?: JournalEntry | null } = $props();

  // Seeded once — the athlete's working copy from here on. See CheckInCard for the same reasoning.
  let rpe = $state<number | null>(untrack(() => entry?.rpe ?? null));
  let saving = $state(false);

  /** The Borg anchors, so a number picked here means the same thing next month. */
  const HINT: Record<number, string> = {
    1: 'bardzo lekko',
    3: 'lekko',
    5: 'umiarkowanie',
    7: 'ciężko',
    9: 'bardzo ciężko',
    10: 'maksymalnie'
  };

  /** One pick, one write — there is nothing else on this card to batch a save with. */
  async function save(next: number | null): Promise<void> {
    if (saving) return;
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
  <ScoreScale
    label="RPE"
    value={rpe}
    min={SCORE_MIN}
    max={SCORE_MAX}
    hints={HINT}
    lowLabel={HINT[SCORE_MIN]}
    highLabel={HINT[SCORE_MAX]}
    disabled={saving}
    ariaLabel="RPE w skali 1–10"
    onchange={(next) => void save(next)}
  />

  {#if rpe === null}
    <p class="why">
      Twoja ocena, nie zegarka. Próg, który czuł się jak dziewiątka, mówi więcej niż średnie tętno.
    </p>
  {/if}
</Card>

<style>
  .why {
    margin: var(--space-4) 0 0;
    max-width: 68ch;
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
    color: var(--color-text-muted);
  }
</style>
