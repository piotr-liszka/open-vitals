<script lang="ts">
  /**
   * The daily check-in (spec 062) — the one place in the app where the athlete, not a device, is
   * the instrument.
   *
   * The ten-second rule is the design: two 1–10 rows, two flags and a note, on one screen, with
   * nothing required and nothing pre-filled. Every field added past this costs completion rate, and
   * a sparse subjective series is worse than none — it makes the correlation engine confident about
   * noise. Anything richer belongs in the note.
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
  import Toggle from '$lib/ui/Toggle.svelte';
  import { toasts } from '$lib/ui/toast';
  import { formatDay } from '$lib/date';
  import { SORENESS_ALERT, type JournalEntry } from './journal.types';

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
  let saved = $state(false);

  const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const sore = $derived(soreness !== null && soreness >= SORENESS_ALERT);
  const anything = $derived(soreness !== null || mood !== null || note.trim() !== '' || illness || injury);

  function pick(current: number | null, value: number): number | null {
    // Tapping the chosen score again clears it — the only way back to "did not say" without a reload.
    return current === value ? null : value;
  }

  async function save(): Promise<void> {
    if (saving || !anything) return;
    saving = true;
    try {
      const res = await fetch('/api/journal', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          day: today,
          soreness,
          mood,
          location: location.trim() || null,
          note: note.trim() || null,
          illness,
          injury
        })
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        toasts.error(body?.error ?? 'Nie udało się zapisać wpisu');
        return;
      }
      saved = true;
      toasts.success('Zapisano');
    } catch {
      toasts.error('Nie udało się zapisać wpisu');
    } finally {
      saving = false;
    }
  }
</script>

<Card title="Jak się dziś czujesz?" subtitle={formatDay(today)}>
  <p class="why">Zegarek tego nie zmierzy, a to najwcześniejszy sygnał, jaki masz. Nic nie jest wymagane.</p>

  <fieldset class="row">
    <legend>Ból / zakwasy</legend>
    <div class="scores" role="group" aria-label="Ból lub zakwasy w skali 1–10">
      {#each SCORES as value (value)}
        <button
          type="button"
          class="score"
          class:on={soreness === value}
          class:warn={soreness === value && value >= SORENESS_ALERT}
          aria-pressed={soreness === value}
          onclick={() => (soreness = pick(soreness, value))}
        >
          {value}
        </button>
      {/each}
    </div>
  </fieldset>

  {#if sore}
    <div class="where">
      <Field label="Gdzie boli?">
        {#snippet children(control)}
          <Input id={control.id} bind:value={location} placeholder="np. lewe kolano" maxlength={120} />
        {/snippet}
      </Field>
    </div>
  {/if}

  <fieldset class="row">
    <legend>Nastrój</legend>
    <div class="scores" role="group" aria-label="Nastrój w skali 1–10">
      {#each SCORES as value (value)}
        <button
          type="button"
          class="score"
          class:on={mood === value}
          aria-pressed={mood === value}
          onclick={() => (mood = pick(mood, value))}
        >
          {value}
        </button>
      {/each}
    </div>
  </fieldset>

  <div class="flags">
    <Toggle checked={illness} label="Choroba" onchange={(v) => (illness = v)} />
    <Toggle checked={injury} label="Kontuzja" onchange={(v) => (injury = v)} />
  </div>

  <Field label="Notatka">
    {#snippet children(control)}
      <Input
        id={control.id}
        bind:value={note}
        placeholder="cokolwiek, co warto zapamiętać"
        maxlength={1000}
      />
    {/snippet}
  </Field>

  <div class="actions">
    {#if saved}<Badge tone="success">Zapisano</Badge>{/if}
    <Button onclick={save} disabled={saving || !anything}>
      {saving ? 'Zapisuję…' : 'Zapisz'}
    </Button>
  </div>
</Card>

<style>
  .why {
    margin: 0 0 var(--space-4);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }

  .row {
    border: 0;
    margin: 0 0 var(--space-4);
    padding: 0;
  }

  legend {
    padding: 0 0 var(--space-2);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

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

  .score:hover {
    border-color: var(--color-border-strong);
    color: var(--color-text);
  }

  .score:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .score.on {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
    color: var(--color-text);
    font-weight: var(--font-semibold);
  }

  .score.warn {
    border-color: var(--color-warning);
  }

  .where {
    margin-bottom: var(--space-4);
  }

  .flags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
    margin-top: var(--space-4);
  }
</style>
