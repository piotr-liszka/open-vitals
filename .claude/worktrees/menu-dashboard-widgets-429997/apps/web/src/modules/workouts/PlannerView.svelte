<script lang="ts">
  /**
   * The planner (spec 066): a month on the left, the selected day on the right.
   *
   * Month and day live in the URL, so a view is linkable, the back button pages through months, and a
   * save can simply `invalidate` rather than re-fetch and merge by hand — the server load is already
   * the one description of what this page shows.
   */
  import Card from '$lib/ui/Card.svelte';
  import Button from '$lib/ui/Button.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import Banner from '$lib/ui/Banner.svelte';
  import ConfirmDialog from '$lib/ui/ConfirmDialog.svelte';
  import { toasts } from '$lib/ui/toast';
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import { formatDay, type DayKey, type MonthKey } from '$lib/date';
  import { sportLabel } from '$lib/sport-labels';
  import PlannerCalendar from './PlannerCalendar.svelte';
  import WorkoutSteps from './WorkoutSteps.svelte';
  import WorkoutEditor from './WorkoutEditor.svelte';
  import WorkoutLibrary from './WorkoutLibrary.svelte';
  import { byTimeThenTitle, groupByDay } from './planner';
  import { fmtClock, fmtDistance } from './workout-format';
  import type { AuthoredWorkoutView, PlannerData, WorkoutDraft, WorkoutTemplateView } from './workouts.types';

  interface Props {
    data: PlannerData;
    month: MonthKey;
    today: DayKey;
    selected: DayKey | null;
  }
  let { data, month, today, selected }: Props = $props();

  /** No explicit selection means today — the day the athlete is most likely asking about. */
  const day = $derived(selected ?? today);

  const authoredByDay = $derived(
    new Map([...groupByDay(data.workouts, (w) => w.day)].map(([k, v]) => [k, v.length]))
  );
  const plannedByDay = $derived(
    new Map([...groupByDay(data.planned, (p) => p.day)].map(([k, v]) => [k, v.length]))
  );

  const dayWorkouts = $derived(data.workouts.filter((w) => w.day === day).sort(byTimeThenTitle));
  const dayPlanned = $derived(data.planned.filter((p) => p.day === day));

  let editing = $state<AuthoredWorkoutView | null>(null);
  let composing = $state(false);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let confirming = $state<AuthoredWorkoutView | null>(null);

  /* ---- library (spec 069) ---- */
  /** Which library entry is being edited, and whether the editor is in library mode at all. */
  let editingTemplate = $state<WorkoutTemplateView | null>(null);
  let composingTemplate = $state(false);
  /** The entry currently under the cursor mid-drag; what a drop on a day cell will schedule. */
  let draggedTemplate = $state<WorkoutTemplateView | null>(null);
  let confirmingTemplate = $state<WorkoutTemplateView | null>(null);

  const PUSH_TONE = {
    pending: { tone: 'neutral' as const, label: 'W kolejce' },
    pushed: { tone: 'success' as const, label: 'Na zegarku' },
    failed: { tone: 'danger' as const, label: 'Błąd wysyłki' },
    unsupported: { tone: 'warning' as const, label: 'Niewspierane' }
  };

  /** Returns the navigation so a caller that must wait for the new data can await it. */
  function navigate(next: { month?: MonthKey; day?: DayKey }): Promise<void> {
    const url = new URL($page.url);
    if (next.month) url.searchParams.set('month', next.month);
    if (next.day) url.searchParams.set('day', next.day);
    return goto(`${url.pathname}${url.search}`, { keepFocus: true, noScroll: true });
  }

  function startCompose(): void {
    editing = null;
    composing = true;
    error = null;
  }
  function startEdit(w: AuthoredWorkoutView): void {
    editing = w;
    composing = true;
    error = null;
  }
  function cancel(): void {
    composing = false;
    editing = null;
    composingTemplate = false;
    editingTemplate = null;
    error = null;
  }

  function startComposeTemplate(): void {
    cancel();
    composingTemplate = true;
  }
  function startEditTemplate(t: WorkoutTemplateView): void {
    cancel();
    editingTemplate = t;
    composingTemplate = true;
  }

  /** Save a LIBRARY entry. The draft's `day`/`time` are ignored — a template has no date. */
  async function saveTemplate(draft: WorkoutDraft): Promise<void> {
    saving = true;
    error = null;
    try {
      const res = await fetch(
        editingTemplate ? `/api/workout-templates/${editingTemplate.id}` : '/api/workout-templates',
        {
          method: editingTemplate ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sport: draft.sport,
            title: draft.title,
            steps: draft.steps,
            note: draft.note
          })
        }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        error = body?.error ?? 'Nie udało się zapisać treningu';
        return;
      }
      const wasEdit = editingTemplate !== null;
      cancel();
      await invalidateAll();
      toasts.success(wasEdit ? 'Zapisano w bibliotece' : 'Dodano do biblioteki');
    } finally {
      saving = false;
    }
  }

  async function removeTemplate(): Promise<void> {
    const target = confirmingTemplate;
    confirmingTemplate = null;
    if (!target) return;
    const res = await fetch(`/api/workout-templates/${target.id}`, { method: 'DELETE' });
    if (!res.ok) {
      toasts.error('Nie udało się usunąć treningu');
      return;
    }
    await invalidateAll();
    toasts.success('Usunięto z biblioteki');
  }

  /**
   * Put a library entry on a day — the drop handler, and the keyboard button's handler too. Goes
   * through the ordinary create endpoint with a `templateId` (spec 069): scheduling IS creating an
   * authored workout, and the only new thing is where the steps came from.
   */
  async function schedule(template: WorkoutTemplateView, onDay: DayKey): Promise<void> {
    const res = await fetch('/api/workouts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ templateId: template.id, day: onDay })
    });
    if (!res.ok) {
      toasts.error('Nie udało się zaplanować treningu');
      return;
    }
    /*
     * Land on the day it went to, so the result is visible without hunting for it — and do ONE of the
     * two refreshes, not both. `goto` to a different `?day=` re-runs the page load by itself; firing
     * `invalidateAll` alongside it raced, and the drop appeared to do nothing at all.
     */
    if (onDay === day) await invalidateAll();
    else await navigate({ day: onDay });

    toasts.success(`Zaplanowano „${template.title}” na ${formatDay(onDay, 'short')}`);
  }

  async function save(draft: WorkoutDraft): Promise<void> {
    saving = true;
    error = null;
    try {
      const res = await fetch(editing ? `/api/workouts/${editing.id}` : '/api/workouts', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft)
      });
      if (!res.ok) {
        // The server's own reason, shown verbatim — `normalizeWorkout` already explains itself.
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        error = body?.error ?? 'Nie udało się zapisać treningu';
        return;
      }
      cancel();
      await invalidateAll();
      toasts.success(editing ? 'Zapisano zmiany' : 'Dodano trening');
    } finally {
      saving = false;
    }
  }

  async function remove(): Promise<void> {
    const target = confirming;
    confirming = null;
    if (!target) return;
    const res = await fetch(`/api/workouts/${target.id}`, { method: 'DELETE' });
    if (!res.ok) {
      toasts.error('Nie udało się usunąć treningu');
      return;
    }
    await invalidateAll();
    toasts.success('Usunięto trening');
  }

  const summary = (w: AuthoredWorkoutView): string => {
    const bits: string[] = [];
    if (w.estimatedDurationS !== null) bits.push(fmtClock(w.estimatedDurationS));
    if (w.estimatedDistanceM !== null) bits.push(fmtDistance(w.estimatedDistanceM));
    return bits.join(' · ');
  };
</script>

<div class="planner">
  <Card>
    <PlannerCalendar
      {month}
      {today}
      selected={day}
      {authoredByDay}
      {plannedByDay}
      onselect={(d) => void navigate({ day: d })}
      onmonth={(m) => void navigate({ month: m })}
      dropActive={draggedTemplate !== null}
      ondropday={(d) => {
        const t = draggedTemplate;
        draggedTemplate = null;
        if (t) void schedule(t, d);
      }}
    />
  </Card>

  <Card>
    <WorkoutLibrary
      templates={data.templates}
      selectedDay={day}
      canWrite={data.canWrite}
      onschedule={(t, d) => void schedule(t, d)}
      onedit={startEditTemplate}
      ondelete={(t) => (confirmingTemplate = t)}
      oncreate={startComposeTemplate}
      ondragtemplate={(t) => (draggedTemplate = t)}
    />
  </Card>

  <Card>
    <div class="day-head">
      <h3 class="day-title">{formatDay(day, 'long')}</h3>
      {#if data.canWrite && !composing}
        <Button size="sm" variant="primary" onclick={startCompose}>+ Trening</Button>
      {/if}
    </div>

    {#if !data.canWrite}
      <!-- Read-only rather than buttons that 403: the consent gate is a decision the athlete made, so
           the page names it and points at where to change it (spec 050). -->
      <Banner tone="info" title="Tryb tylko do odczytu">
        Zapis treningów wymaga zgody „Tworzenie treningów”. Włącz ją w
        <a href="/settings">Ustawieniach</a>, aby dodawać i edytować sesje tutaj.
      </Banner>
    {/if}

    {#if composingTemplate}
      <!-- Same editor, library mode: a template is this step tree minus its two date fields. -->
      <WorkoutEditor
        workout={editingTemplate}
        {day}
        mode="library"
        {saving}
        {error}
        onsave={saveTemplate}
        oncancel={cancel}
      />
    {:else if composing}
      <WorkoutEditor workout={editing} {day} {saving} {error} onsave={save} oncancel={cancel} />
    {:else}
      {#if dayWorkouts.length === 0 && dayPlanned.length === 0}
        <p class="empty">
          Nic nie zaplanowano na ten dzień.{data.canWrite
            ? ' Dodaj trening przyciskiem powyżej albo przez asystenta (MCP).'
            : ''}
        </p>
      {/if}

      {#each dayWorkouts as w (w.id)}
        <article class="session">
          <div class="session-head">
            <div class="who">
              <span class="sport">{sportLabel(w.sport)}</span>
              <h4 class="name">{w.title}</h4>
            </div>
            <div class="meta">
              {#if w.time}<span class="time">{w.time}</span>{/if}
              <Badge tone={PUSH_TONE[w.pushState].tone}>{PUSH_TONE[w.pushState].label}</Badge>
            </div>
          </div>

          {#if summary(w)}<p class="summary">{summary(w)}</p>{/if}
          {#if w.pushError}<p class="push-error">{w.pushError}</p>{/if}

          <WorkoutSteps steps={w.steps} />

          {#if w.note}<p class="note">{w.note}</p>{/if}

          {#if data.canWrite}
            <div class="session-actions">
              <Button size="sm" variant="ghost" onclick={() => startEdit(w)}>Edytuj</Button>
              <Button size="sm" variant="ghost" onclick={() => (confirming = w)}>Usuń</Button>
            </div>
          {/if}
        </article>
      {/each}

      {#each dayPlanned as p (p.id)}
        <!-- From Garmin's own calendar (spec 024): shown so the day is complete, marked so it is
             obvious why there is no edit button — this row is replaced wholesale on every sync. -->
        <article class="session synced">
          <div class="session-head">
            <div class="who">
              <span class="sport">{p.sport ? sportLabel(p.sport) : 'Z kalendarza'}</span>
              <h4 class="name">{p.title}</h4>
            </div>
            <Badge tone="neutral">Z Garmina</Badge>
          </div>
          {#if p.description}<p class="note">{p.description}</p>{/if}
        </article>
      {/each}
    {/if}
  </Card>
</div>

<ConfirmDialog
  open={confirming !== null}
  title="Usunąć „{confirming?.title ?? ''}”?"
  body={confirming?.onGarmin
    ? 'Trening zniknie z tej listy od razu. Z zegarka usunie go dopiero najbliższa synchronizacja.'
    : 'Ten trening nie trafił jeszcze do Garmina, więc zostanie usunięty bez śladu.'}
  onconfirm={remove}
  oncancel={() => (confirming = null)}
/>

<ConfirmDialog
  open={confirmingTemplate !== null}
  title="Usunąć „{confirmingTemplate?.title ?? ''}” z biblioteki?"
  body="Treningi już zaplanowane w kalendarzu zostaną — usuwasz tylko wzorzec, z którego powstały."
  onconfirm={removeTemplate}
  oncancel={() => (confirmingTemplate = null)}
/>

<style>
  /* Calendar and library share the left column, the selected day takes the right: a drag from the
     library to a day is then a short upward move rather than a trip across the viewport. */
  .planner {
    display: grid;
    grid-template-columns: minmax(280px, 380px) 1fr;
    gap: var(--space-4);
    align-items: start;
  }
  .planner > :global(:nth-child(2)) {
    grid-column: 1;
  }
  .planner > :global(:nth-child(3)) {
    grid-column: 2;
    grid-row: 1 / span 2;
  }
  @media (max-width: 900px) {
    .planner > :global(:nth-child(2)),
    .planner > :global(:nth-child(3)) {
      grid-column: 1;
      grid-row: auto;
    }
  }
  @media (max-width: 900px) {
    .planner {
      grid-template-columns: 1fr;
    }
  }
  .day-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .day-title {
    margin: 0;
    font-size: var(--text-md);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
    text-transform: capitalize;
  }
  .empty {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
  }
  .session + .session {
    margin-top: var(--space-4);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }
  .session-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-2);
  }
  .sport {
    display: block;
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-subtle);
  }
  .name {
    margin: 2px 0 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }
  .meta {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }
  .time {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    font-feature-settings: var(--numeric);
  }
  .summary {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    font-feature-settings: var(--numeric);
  }
  .push-error {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    color: var(--color-danger);
  }
  .note {
    margin: var(--space-2) 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
  }
  /* Quieter than an authored session: it is context the athlete cannot act on here. */
  .session.synced .name {
    color: var(--color-text-muted);
  }
  .session-actions {
    display: flex;
    gap: var(--space-1);
    margin-top: var(--space-3);
  }
</style>
