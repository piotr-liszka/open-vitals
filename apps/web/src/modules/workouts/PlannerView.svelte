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
  import { completionBadge, completionNotes, fmtClock, fmtDistance } from './workout-format';
  import type { AuthoredWorkoutView, PlannerData, WorkoutDraft, WorkoutTemplateView } from './workouts.types';
  import { getI18n } from '$lib/i18n';

  const i18n = getI18n();

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
  /**
   * How many of a day's authored sessions were actually done (spec 081). The grid draws this as a
   * filled-in dot; the day panel below carries the detail — the ratio, the day shift and whether the
   * pairing was inferred — because a calendar cell is too small to hold a caveat.
   */
  const doneByDay = $derived(
    new Map(
      [...groupByDay(data.workouts, (w) => w.day)].map(([k, v]) => [
        k,
        v.filter((w) => w.completion !== null).length
      ])
    )
  );

  const dayWorkouts = $derived(data.workouts.filter((w) => w.day === day).sort(byTimeThenTitle));
  const dayPlanned = $derived(data.planned.filter((p) => p.day === day));

  let editing = $state<AuthoredWorkoutView | null>(null);
  let composing = $state(false);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let confirming = $state<AuthoredWorkoutView | null>(null);
  /** Id of the session currently being pushed on demand (spec 083), or null. */
  let pushing = $state<string | null>(null);

  /* ---- library (spec 069) ---- */
  /** Which library entry is being edited, and whether the editor is in library mode at all. */
  let editingTemplate = $state<WorkoutTemplateView | null>(null);
  let composingTemplate = $state(false);
  /** The entry currently under the cursor mid-drag; what a drop on a day cell will schedule. */
  let draggedTemplate = $state<WorkoutTemplateView | null>(null);
  let confirmingTemplate = $state<WorkoutTemplateView | null>(null);

  const PUSH_TONE = $derived({
    pending: { tone: 'neutral' as const, label: i18n.t('workout.pushState.pending') },
    pushed: { tone: 'success' as const, label: i18n.t('workout.pushState.pushed') },
    failed: { tone: 'danger' as const, label: i18n.t('workout.pushState.failed') },
    unsupported: { tone: 'warning' as const, label: i18n.t('workout.pushState.unsupported') }
  });

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
        error = body?.error ?? i18n.t('workout.saveFailed');
        return;
      }
      const wasEdit = editingTemplate !== null;
      cancel();
      await invalidateAll();
      toasts.success(wasEdit ? i18n.t('workout.library.saved') : i18n.t('workout.library.added'));
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
      toasts.error(i18n.t('workout.deleteFailed'));
      return;
    }
    await invalidateAll();
    toasts.success(i18n.t('workout.library.removed'));
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
      toasts.error(i18n.t('workout.scheduleFailed'));
      return;
    }
    /*
     * Land on the day it went to, so the result is visible without hunting for it — and do ONE of the
     * two refreshes, not both. `goto` to a different `?day=` re-runs the page load by itself; firing
     * `invalidateAll` alongside it raced, and the drop appeared to do nothing at all.
     */
    if (onDay === day) await invalidateAll();
    else await navigate({ day: onDay });

    toasts.success(
      i18n.t('workout.scheduledToast', {
        title: template.title,
        date: formatDay(i18n.locale, onDay, 'short')
      })
    );
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
        error = body?.error ?? i18n.t('workout.saveFailed');
        return;
      }
      cancel();
      await invalidateAll();
      toasts.success(editing ? i18n.t('workout.saved') : i18n.t('workout.added'));
    } finally {
      saving = false;
    }
  }

  /**
   * Send one session to Garmin now (spec 083), rather than waiting for the background push.
   *
   * The server owns the outcome — it re-reads the row after pushing — so this only re-loads and
   * reports. Guessing the new state here would let the panel claim "Na zegarku" for a push that
   * Garmin refused.
   */
  async function pushNow(w: AuthoredWorkoutView): Promise<void> {
    pushing = w.id;
    try {
      const res = await fetch(`/api/workouts/${w.id}/push`, { method: 'POST' });
      const body = (await res.json().catch(() => null)) as (AuthoredWorkoutView & { error?: string }) | null;
      if (!res.ok) {
        toasts.error(body?.error ?? i18n.t('workout.pushFailed'));
        return;
      }
      await invalidateAll();
      if (body?.pushState === 'pushed') toasts.success(i18n.t('workout.pushedToast', { title: w.title }));
      // A refused or half-finished push already wrote its reason onto the row; the panel renders it
      // under the session rather than repeating it in a toast that disappears.
      else toasts.error(body?.pushError ?? i18n.t('workout.pushRejected'));
    } finally {
      pushing = null;
    }
  }

  async function remove(): Promise<void> {
    const target = confirming;
    confirming = null;
    if (!target) return;
    const res = await fetch(`/api/workouts/${target.id}`, { method: 'DELETE' });
    if (!res.ok) {
      toasts.error(i18n.t('workout.deleteFailed'));
      return;
    }
    await invalidateAll();
    toasts.success(i18n.t('workout.deletedToast'));
  }

  const summary = (w: AuthoredWorkoutView): string => {
    const bits: string[] = [];
    if (w.estimatedDurationS !== null) bits.push(fmtClock(w.estimatedDurationS));
    if (w.estimatedDistanceM !== null) bits.push(fmtDistance(i18n.t, w.estimatedDistanceM));
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
      {doneByDay}
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
      <h3 class="day-title">{formatDay(i18n.locale, day, 'long')}</h3>
      {#if data.canWrite && !composing}
        <Button size="sm" variant="primary" onclick={startCompose}>{i18n.t('workout.addButton')}</Button>
      {/if}
    </div>

    {#if !data.canWrite}
      <!-- Read-only rather than buttons that 403: the switch is a decision the athlete made, so the
           page names it and points at where to change it (spec 050, re-worded in spec 071). -->
      <Banner tone="info" title={i18n.t('workout.readOnlyTitle')}>
        {i18n.t('workout.readOnlyBody')} <a href="/settings">{i18n.t('data.settingsLink')}</a>{i18n.t(
          'workout.readOnlyBodyTail'
        )}
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
          {i18n.t('workout.emptyDay')}{data.canWrite ? i18n.t('workout.emptyDayHint') : ''}
        </p>
      {/if}

      {#each dayWorkouts as w (w.id)}
        <article class="session">
          <div class="session-head">
            <div class="who">
              <span class="sport">{sportLabel(i18n.t, w.sport)}</span>
              <h4 class="name">{w.title}</h4>
            </div>
            <div class="meta">
              {#if w.time}<span class="time">{w.time}</span>{/if}
              {#if w.completion}
                <!-- Spec 081: what was actually done. Success when the session was completed as
                     written, warning when it was cut short — never a claim about WHY. -->
                <Badge tone={completionBadge(i18n.t, w.completion.adherence).tone}>
                  {completionBadge(i18n.t, w.completion.adherence).label}
                </Badge>
              {/if}
              <Badge tone={PUSH_TONE[w.pushState].tone}>{PUSH_TONE[w.pushState].label}</Badge>
              {#if w.syncedBack}
                <!-- Spec 093: Garmin has echoed this exact push back onto its own calendar. The
                     separate read-only "Z Garmina" card that echo would otherwise also produce is
                     folded into this one — see `matchPlannedEcho` / `loadPlanner`. -->
                <Badge tone="info" dot={false}>{i18n.t('workout.syncedBackBadge')}</Badge>
              {/if}
            </div>
          </div>

          {#if summary(w)}<p class="summary">{summary(w)}</p>{/if}
          {#if w.completion && completionNotes(i18n.t, w.completion).length > 0}
            <p class="completion">{completionNotes(i18n.t, w.completion).join(' · ')}</p>
          {/if}
          {#if w.pushError}<p class="push-error">{w.pushError}</p>{/if}

          <WorkoutSteps steps={w.steps} />

          {#if w.note}<p class="note">{w.note}</p>{/if}

          {#if data.canWrite}
            <div class="session-actions">
              <Button size="sm" variant="ghost" onclick={() => startEdit(w)}>{i18n.t('common.edit')}</Button>
              <Button size="sm" variant="ghost" onclick={() => (confirming = w)}
                >{i18n.t('common.delete')}</Button
              >
              <!-- Spec 083 + 092. A session already in Garmin's library AND on its calendar shows the
                   status as a label, but a click target is ALWAYS present (spec 092): the de-emphasized
                   "Wyślij ponownie" forces a delete-then-recreate, which is the only recovery path when
                   the upstream copy was removed outside this app — the server never detects that on
                   its own, so the control cannot be allowed to disappear once pushed. -->
              {#if w.pushState === 'pushed'}
                <span class="on-garmin">{i18n.t('workout.onGarmin')}</span>
                <Button size="sm" variant="ghost" disabled={pushing !== null} onclick={() => pushNow(w)}>
                  {pushing === w.id ? i18n.t('workout.pushing') : i18n.t('workout.pushAgain')}
                </Button>
              {:else}
                <Button size="sm" variant="secondary" disabled={pushing !== null} onclick={() => pushNow(w)}>
                  {pushing === w.id ? i18n.t('workout.pushing') : i18n.t('workout.pushNow')}
                </Button>
              {/if}
              {#if w.onGarmin && w.pushState !== 'pushed'}
                <!-- Known limitation, said plainly rather than discovered on the watch: the push is
                     create-if-missing, so a session edited AFTER it reached Garmin keeps the version
                     that was first sent. -->
                <span class="stale">{i18n.t('workout.staleOnGarmin')}</span>
              {/if}
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
              <span class="sport"
                >{p.sport ? sportLabel(i18n.t, p.sport) : i18n.t('workout.fromCalendar')}</span
              >
              <h4 class="name">{p.title}</h4>
            </div>
            <Badge tone="neutral">{i18n.t('workout.fromGarminBadge')}</Badge>
          </div>
          {#if p.description}<p class="note">{p.description}</p>{/if}
        </article>
      {/each}
    {/if}
  </Card>
</div>

<ConfirmDialog
  open={confirming !== null}
  title={i18n.t('workout.confirmDeleteTitle', { title: confirming?.title ?? '' })}
  body={confirming?.onGarmin
    ? i18n.t('workout.confirmDeleteBody.onGarmin')
    : i18n.t('workout.confirmDeleteBody.notOnGarmin')}
  onconfirm={remove}
  oncancel={() => (confirming = null)}
/>

<ConfirmDialog
  open={confirmingTemplate !== null}
  title={i18n.t('workout.confirmDeleteTemplateTitle', { title: confirmingTemplate?.title ?? '' })}
  body={i18n.t('workout.confirmDeleteTemplateBody')}
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
  /* Spec 081: the caveats that do not fit on a grid cell — ratio, day shift, inferred-vs-known. */
  .completion {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
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
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1);
    margin-top: var(--space-3);
  }
  .on-garmin {
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    padding-inline: var(--space-2);
  }
  .stale {
    flex-basis: 100%;
    font-size: var(--text-xs);
    color: var(--color-warning);
  }
</style>
