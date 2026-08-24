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
  import { getI18n } from '$lib/i18n';
  import { SCORE_MAX, SCORE_MIN, type JournalEntry } from './journal.types';

  const i18n = getI18n();

  let {
    activityId,
    day,
    entry = null
  }: { activityId: string; day: string; entry?: JournalEntry | null } = $props();

  // Seeded once — the athlete's working copy from here on. See CheckInCard for the same reasoning.
  let rpe = $state<number | null>(untrack(() => entry?.rpe ?? null));
  let saving = $state(false);

  /** The Borg anchors, so a number picked here means the same thing next month. */
  const hint = $derived<Record<number, string>>({
    1: i18n.t('journal.rpe.hint.1'),
    3: i18n.t('journal.rpe.hint.3'),
    5: i18n.t('journal.rpe.hint.5'),
    7: i18n.t('journal.rpe.hint.7'),
    9: i18n.t('journal.rpe.hint.9'),
    10: i18n.t('journal.rpe.hint.10')
  });

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
        toasts.error(body?.error ?? i18n.t('journal.rpe.toastError'));
        return;
      }
      rpe = next;
      toasts.success(
        next === null ? i18n.t('journal.rpe.toastRemoved') : i18n.t('journal.rpe.toastSaved', { value: next })
      );
    } catch {
      toasts.error(i18n.t('journal.rpe.toastError'));
    } finally {
      saving = false;
    }
  }
</script>

<Card title={i18n.t('journal.rpe.title')} subtitle={i18n.t('journal.rpe.subtitle')}>
  <ScoreScale
    label={i18n.t('journal.rpe.label')}
    value={rpe}
    min={SCORE_MIN}
    max={SCORE_MAX}
    hints={hint}
    lowLabel={hint[SCORE_MIN]}
    highLabel={hint[SCORE_MAX]}
    disabled={saving}
    ariaLabel={i18n.t('journal.rpe.ariaLabel')}
    onchange={(next) => void save(next)}
  />

  {#if rpe === null}
    <p class="why">
      {i18n.t('journal.rpe.why')}
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
