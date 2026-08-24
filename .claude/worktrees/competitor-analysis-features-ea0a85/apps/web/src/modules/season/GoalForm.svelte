<script lang="ts">
  /**
   * Add a goal (spec 060). Deliberately short: a day, a sport and a name are all that is required —
   * everything else is a target the athlete may not have yet, and a form that demanded a CTL number
   * up front would stop most people entering a race at all.
   *
   * The distance and time fields take the units athletes actually think in (kilometres, `h:mm:ss`)
   * and convert on the way out; the API's contract stays metres and seconds.
   */
  import { untrack } from 'svelte';
  import { invalidateAll } from '$app/navigation';
  import { Button, Field, Input, toasts } from '$lib/ui';
  import type { GoalKind, GoalPriority, SeasonData } from './season.types';

  let { sports, today }: { sports: SeasonData['sports']; today: string } = $props();

  let open = $state(false);
  let day = $state('');
  // Seeded from the athlete's first family and then owned by the user — deliberately untracked, so a
  // re-render of the list can never overwrite a selection they have already made.
  let sport = $state<string>(untrack(() => sports[0]?.group ?? 'run'));
  let title = $state('');
  let kind = $state<GoalKind>('race');
  let priority = $state<GoalPriority>('a');
  let distanceKm = $state('');
  let targetTime = $state('');
  let targetCtl = $state('');
  let note = $state('');
  let error = $state<string | undefined>(undefined);
  let submitting = $state(false);

  /** `h:mm:ss`, `mm:ss` or plain minutes → seconds. `null` for empty, `NaN` for nonsense. */
  function parseDuration(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const parts = trimmed.split(':').map((p) => Number(p));
    if (parts.some((p) => !Number.isFinite(p) || p < 0)) return Number.NaN;
    if (parts.length === 1) return parts[0]! * 60;
    if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
    if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
    return Number.NaN;
  }

  function optionalNumber(raw: string): number | null {
    const trimmed = raw.trim().replace(',', '.');
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : Number.NaN;
  }

  function reset(): void {
    day = '';
    title = '';
    distanceKm = '';
    targetTime = '';
    targetCtl = '';
    note = '';
    kind = 'race';
    priority = 'a';
    error = undefined;
  }

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    error = undefined;

    const km = optionalNumber(distanceKm);
    const seconds = parseDuration(targetTime);
    const ctl = optionalNumber(targetCtl);
    if (Number.isNaN(km)) return void (error = 'Dystans musi być liczbą kilometrów.');
    if (Number.isNaN(seconds)) return void (error = 'Czas docelowy podaj jako g:mm:ss.');
    if (Number.isNaN(ctl)) return void (error = 'Docelowa forma musi być liczbą.');

    submitting = true;
    try {
      const res = await fetch('/api/season/goals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          day,
          sport,
          title,
          kind,
          priority,
          distanceM: km === null ? null : km * 1000,
          targetTimeS: seconds,
          targetCtl: ctl,
          note: note.trim() === '' ? null : note
        })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        error = data.error ?? 'Nie udało się zapisać celu.';
        return;
      }
      toasts.success('Cel dodany.');
      reset();
      open = false;
      await invalidateAll();
    } catch {
      error = 'Nie udało się połączyć z serwerem.';
    } finally {
      submitting = false;
    }
  }
</script>

{#if !open}
  <Button onclick={() => (open = true)}>Dodaj cel</Button>
{:else}
  <form onsubmit={submit} novalidate>
    <div class="grid">
      <Field label="Nazwa" required>
        {#snippet children(control)}
          <Input
            id={control.id}
            bind:value={title}
            invalid={control.invalid}
            placeholder="np. Maraton Warszawski"
            maxlength={120}
            required
          />
        {/snippet}
      </Field>

      <Field label="Data" required help="Dzień startu, albo dzień, na który chcesz mieć formę.">
        {#snippet children(control)}
          <Input id={control.id} type="date" bind:value={day} min={today} required />
        {/snippet}
      </Field>

      <Field label="Dyscyplina" help="Trajektoria liczona jest z formy w tej właśnie dyscyplinie.">
        {#snippet children(control)}
          <select id={control.id} class="select" bind:value={sport}>
            {#each sports as s (s.group)}
              <option value={s.group}>{s.label}</option>
            {/each}
          </select>
        {/snippet}
      </Field>

      <Field label="Rodzaj">
        {#snippet children(control)}
          <select id={control.id} class="select" bind:value={kind}>
            <option value="race">Start</option>
            <option value="fitness">Forma</option>
          </select>
        {/snippet}
      </Field>

      <Field label="Priorytet" help="A to cel sezonu; B i C to starty po drodze.">
        {#snippet children(control)}
          <select id={control.id} class="select" bind:value={priority}>
            <option value="a">A</option>
            <option value="b">B</option>
            <option value="c">C</option>
          </select>
        {/snippet}
      </Field>

      <Field label="Dystans (km)" help="Potrzebny, żeby policzyć prognozę czasu.">
        {#snippet children(control)}
          <Input id={control.id} bind:value={distanceKm} inputmode="decimal" placeholder="21,1" />
        {/snippet}
      </Field>

      <Field label="Czas docelowy" help="Format g:mm:ss, np. 1:30:00.">
        {#snippet children(control)}
          <Input id={control.id} bind:value={targetTime} placeholder="1:30:00" />
        {/snippet}
      </Field>

      <Field
        label="Docelowa forma (CTL)"
        help="Opcjonalna. Bez niej dostajesz odliczanie i fazę, ale bez oceny trajektorii."
      >
        {#snippet children(control)}
          <Input id={control.id} bind:value={targetCtl} inputmode="decimal" placeholder="70" />
        {/snippet}
      </Field>

      <div class="wide">
        <Field label="Notatka">
          {#snippet children(control)}
            <Input id={control.id} bind:value={note} maxlength={500} />
          {/snippet}
        </Field>
      </div>
    </div>

    {#if error}<p class="error" role="alert">{error}</p>{/if}

    <div class="actions">
      <Button type="submit" disabled={submitting}>{submitting ? 'Zapisywanie…' : 'Zapisz cel'}</Button>
      <Button variant="ghost" type="button" onclick={() => ((open = false), reset())}>Anuluj</Button>
    </div>
  </form>
{/if}

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-4);
  }

  .wide {
    grid-column: 1 / -1;
  }

  .select {
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
  }

  .select:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }

  .error {
    color: var(--color-danger);
    font-size: var(--text-sm);
  }

  .actions {
    display: flex;
    gap: var(--space-3);
  }
</style>
