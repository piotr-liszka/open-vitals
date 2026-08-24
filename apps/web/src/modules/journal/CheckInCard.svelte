<script lang="ts">
  /**
   * The daily check-in (spec 062, redesigned in spec 080) — the one place in the app where the
   * athlete, not a device, is the instrument.
   *
   * The ten-second rule is still the design: two scales, two flags and a note, on one screen, with
   * nothing required and nothing pre-filled. Every field added past this costs completion rate, and
   * a sparse subjective series is worse than none — it makes the correlation engine confident about
   * noise. Anything richer belongs in the note.
   *
   * What spec 080 changed is that the form now says what it is asking for. Soreness runs worst-at-10
   * and mood runs best-at-10; the first version drew both as the same unlabelled row of digits, so
   * the poles and the per-score words are the fix, and they live in `ScoreScale` because the RPE card
   * asks the same kind of question.
   *
   * There is deliberately NO nag state. A day not logged says nothing about the athlete, and a card
   * that scolds gets dismissed rather than filled.
   */
  import { untrack } from 'svelte';
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Input from '$lib/ui/Input.svelte';
  import Field from '$lib/ui/Field.svelte';
  import InfoPopover from '$lib/ui/InfoPopover.svelte';
  import ScoreScale from '$lib/ui/ScoreScale.svelte';
  import Textarea from '$lib/ui/Textarea.svelte';
  import Toggle from '$lib/ui/Toggle.svelte';
  import { toasts } from '$lib/ui/toast';
  import { formatDay } from '$lib/date';
  import { MAX_LOCATION, MAX_NOTE } from './journal.validate';
  import { SCORE_MAX, SCORE_MIN, SORENESS_ALERT, type JournalEntry } from './journal.types';
  import { getI18n } from '$lib/i18n';

  const i18n = getI18n();

  let { today, entry = null }: { today: string; entry?: JournalEntry | null } = $props();

  /*
   * Seeded ONCE from what is already stored for today, so a second visit edits rather than starts
   * over. `untrack` says that is deliberate: these fields are the athlete's working copy from here
   * on, and a re-render that pulled the stored values back in would wipe half-typed input.
   */
  let soreness = $state<number | null>(untrack(() => entry?.soreness ?? null));
  let mood = $state<number | null>(untrack(() => entry?.mood ?? null));
  let location = $state(untrack(() => entry?.location ?? ''));
  let note = $state(untrack(() => entry?.note ?? ''));
  let illness = $state(untrack(() => entry?.illness ?? false));
  let injury = $state(untrack(() => entry?.injury ?? false));
  let saving = $state(false);

  /** What a score MEANS, so a 7 entered today is the same 7 next month. */
  const sorenessHints = $derived<Record<number, string>>({
    1: i18n.t('journal.checkIn.soreness.1'),
    2: i18n.t('journal.checkIn.soreness.2'),
    3: i18n.t('journal.checkIn.soreness.3'),
    4: i18n.t('journal.checkIn.soreness.4'),
    5: i18n.t('journal.checkIn.soreness.5'),
    6: i18n.t('journal.checkIn.soreness.6'),
    7: i18n.t('journal.checkIn.soreness.7'),
    8: i18n.t('journal.checkIn.soreness.8'),
    9: i18n.t('journal.checkIn.soreness.9'),
    10: i18n.t('journal.checkIn.soreness.10')
  });

  const moodHints = $derived<Record<number, string>>({
    1: i18n.t('journal.checkIn.mood.1'),
    2: i18n.t('journal.checkIn.mood.2'),
    3: i18n.t('journal.checkIn.mood.3'),
    4: i18n.t('journal.checkIn.mood.4'),
    5: i18n.t('journal.checkIn.mood.5'),
    6: i18n.t('journal.checkIn.mood.6'),
    7: i18n.t('journal.checkIn.mood.7'),
    8: i18n.t('journal.checkIn.mood.8'),
    9: i18n.t('journal.checkIn.mood.9'),
    10: i18n.t('journal.checkIn.mood.10')
  });

  /*
   * The last state the SERVER has. "Dirty" is a comparison against this, not a flag — the first
   * version set `saved = true` once and left the card claiming it forever, including after the next
   * edit. A cleared field is a real change too, which is why nulls are part of the snapshot.
   */
  type Snapshot = ReturnType<typeof snapshot>;

  function snapshot(e: JournalEntry | null) {
    return {
      soreness: e?.soreness ?? null,
      mood: e?.mood ?? null,
      location: e?.location ?? '',
      note: e?.note ?? '',
      illness: e?.illness ?? false,
      injury: e?.injury ?? false
    };
  }

  let persisted = $state<Snapshot>(untrack(() => snapshot(entry)));

  const working = $derived<Snapshot>({
    soreness,
    mood,
    location: location.trim(),
    note: note.trim(),
    illness,
    injury
  });

  const sore = $derived(soreness !== null && soreness >= SORENESS_ALERT);
  const dirty = $derived(
    (Object.keys(working) as (keyof Snapshot)[]).some((k) => working[k] !== persisted[k])
  );
  /** Was anything ever written for today? Drives "zapisano" vs "nic nie zapisano". */
  const stored = $derived(Object.values(persisted).some((v) => v !== null && v !== '' && v !== false));
  const canSave = $derived(
    dirty && (stored || Object.values(working).some((v) => v !== null && v !== '' && v !== false))
  );

  async function save(): Promise<void> {
    if (saving || !canSave) return;
    saving = true;
    const sent = working;
    try {
      const res = await fetch('/api/journal', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          day: today,
          soreness: sent.soreness,
          mood: sent.mood,
          location: sent.location || null,
          note: sent.note || null,
          illness: sent.illness,
          injury: sent.injury
        })
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        toasts.error(body?.error ?? i18n.t('journal.checkIn.toastError'));
        return;
      }
      // Whatever we just sent is now what the server holds — the card is clean until the next edit.
      persisted = sent;
      toasts.success(i18n.t('journal.checkIn.toastSaved'));
    } catch {
      toasts.error(i18n.t('journal.checkIn.toastError'));
    } finally {
      saving = false;
    }
  }
</script>

<Card title={i18n.t('journal.checkIn.title')} subtitle={formatDay(i18n.locale, today)} overflowVisible>
  {#snippet actions()}
    <InfoPopover label={i18n.t('journal.checkIn.infoLabel')}>
      <p>{i18n.t('journal.checkIn.why')}</p>
    </InfoPopover>
    {#if stored && !dirty}<Badge tone="success">{i18n.t('journal.checkIn.savedBadge')}</Badge>{/if}
  {/snippet}

  <div class="grid">
    <div class="col scales">
      <ScoreScale
        label={i18n.t('journal.checkIn.painLabel')}
        value={soreness}
        min={SCORE_MIN}
        max={SCORE_MAX}
        hints={sorenessHints}
        lowLabel={sorenessHints[SCORE_MIN]}
        highLabel={sorenessHints[SCORE_MAX]}
        warnFrom={SORENESS_ALERT}
        ariaLabel={i18n.t('journal.checkIn.painAriaLabel')}
        onchange={(next) => (soreness = next)}
      />

      {#if sore}
        <div class="where">
          <Field label={i18n.t('journal.checkIn.whereLabel')} help={i18n.t('journal.checkIn.whereHelp')}>
            {#snippet children(control)}
              <Input
                id={control.id}
                aria-describedby={control.describedBy}
                bind:value={location}
                placeholder={i18n.t('journal.checkIn.wherePlaceholder')}
                maxlength={MAX_LOCATION}
              />
            {/snippet}
          </Field>
        </div>
      {/if}

      <ScoreScale
        label={i18n.t('journal.checkIn.moodLabel')}
        value={mood}
        min={SCORE_MIN}
        max={SCORE_MAX}
        hints={moodHints}
        lowLabel={moodHints[SCORE_MIN]}
        highLabel={moodHints[SCORE_MAX]}
        ariaLabel={i18n.t('journal.checkIn.moodAriaLabel')}
        onchange={(next) => (mood = next)}
      />
    </div>

    <div class="col aside">
      <!-- Visible labels, tied to the switch by `for`/`id`: the first version passed the words to
           `aria-label` only, which left two unexplained tracks on the screen. -->
      <div class="flags">
        <div class="flag">
          <label class="flag-label" for="checkin-illness">{i18n.t('journal.checkIn.illnessLabel')}</label>
          <Toggle id="checkin-illness" checked={illness} onchange={(v) => (illness = v)} />
        </div>
        <div class="flag">
          <label class="flag-label" for="checkin-injury">{i18n.t('journal.checkIn.injuryLabel')}</label>
          <Toggle id="checkin-injury" checked={injury} onchange={(v) => (injury = v)} />
        </div>
      </div>

      <Field label={i18n.t('journal.checkIn.noteLabel')} help={i18n.t('journal.checkIn.noteHelp')}>
        {#snippet children(control)}
          <Textarea
            id={control.id}
            aria-describedby={control.describedBy}
            bind:value={note}
            placeholder={i18n.t('journal.checkIn.notePlaceholder')}
            maxlength={MAX_NOTE}
            rows={4}
          />
        {/snippet}
      </Field>
    </div>
  </div>

  <div class="footer">
    <p class="status" aria-live="polite">
      {#if dirty}
        {i18n.t('journal.checkIn.statusDirty')}
      {:else if stored}
        {i18n.t('journal.checkIn.statusSaved')}
      {:else}
        {i18n.t('journal.checkIn.statusEmpty')}
      {/if}
    </p>
    <Button onclick={save} disabled={saving || !canSave}>
      {saving ? i18n.t('journal.checkIn.saving') : i18n.t('common.save')}
    </Button>
  </div>
</Card>

<style>
  /*
   * One column on a phone, two from 900px. The scales are the reason: stretched across a full
   * desktop card each step was ~190px wide, which read as a wall of boxes rather than a scale.
   */
  .grid {
    display: grid;
    gap: var(--space-6);
  }

  @media (min-width: 900px) {
    .grid {
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
      gap: var(--space-8);
    }
    /* Hairline rule instead of a second card — the instrument grid this app is built on.
       Nested cards are never the answer to "these two groups are different". */
    .aside {
      padding-left: var(--space-8);
      border-left: 1px solid var(--color-grid);
    }
  }

  .col {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    min-width: 0;
  }

  .scales {
    /* A 1–10 track wider than this stops being readable as one measure. */
    max-width: 34rem;
  }

  .flags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3) var(--space-6);
  }

  .flag {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
  }

  .flag-label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-on-surface);
    cursor: pointer;
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin-top: var(--space-6);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .status {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }
</style>
