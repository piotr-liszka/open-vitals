<script lang="ts">
  /**
   * The step builder (spec 066) — create or edit one authored session.
   *
   * Covers the WHOLE model in `$lib/workouts`: every step kind, every duration type, targets, and
   * one-level repeat blocks. Nothing MCP can express is missing here, which is the point — the
   * assistant is the fast way to compose a block, this is where you fix the interval that was wrong,
   * and an editor that could only represent half a session would send you back to the assistant to fix
   * the other half.
   *
   * Two rules it enforces so the server never has to reject something the UI offered:
   *
   *  1. **Targets are filtered by sport family.** `WORKOUT_TARGETS_BY_GROUP` is the same table the
   *     validator checks against, so a power target is simply absent on a walk rather than offered and
   *     then refused.
   *  2. **Repeat blocks do not nest.** The "add repeat" control exists only at the top level, because
   *     `normalizeWorkout` refuses depth > 1 and Garmin's own editor allows one.
   *
   * It still submits to a server that validates independently — the UI is a convenience, never the
   * trust boundary.
   */
  import Button from '$lib/ui/Button.svelte';
  import Field from '$lib/ui/Field.svelte';
  import Input from '$lib/ui/Input.svelte';
  import Banner from '$lib/ui/Banner.svelte';
  import { SPORT_LABELS, sportLabel, sportGroup } from '$lib/sport-labels';
  import {
    WORKOUT_DURATION_TYPES,
    WORKOUT_LIMITS,
    WORKOUT_STEP_KINDS,
    WORKOUT_TARGETS_BY_GROUP,
    WORKOUT_TARGET_UNITS,
    type WorkoutDurationType,
    type WorkoutStep,
    type WorkoutStepKind,
    type WorkoutTargetType
  } from '$lib/workouts';
  import {
    DURATION_TYPE_LABELS,
    DURATION_UNITS,
    DURATION_VALUE_LABELS,
    STEP_KIND_LABELS,
    TARGET_TYPE_LABELS
  } from './workout-format';
  import { moveItem } from '$modules/dashboards/reorder';
  import type { AuthoredWorkoutView, WorkoutDraft, WorkoutTemplateView } from './workouts.types';
  import { getI18n } from '$lib/i18n';

  const i18n = getI18n();

  interface Props {
    /** The session being edited, or null to compose a new one. */
    workout: AuthoredWorkoutView | WorkoutTemplateView | null;
    /** Day the new session lands on when composing. Ignored in `library` mode. */
    day: string;
    /**
     * `plan` edits a session committed to a day; `library` edits a reusable one that has no date
     * (spec 069). The editor is NOT forked for this: a library entry is the same step tree minus two
     * fields, and a second copy of ~300 lines of step UI would drift — which is exactly what spec 067
     * had to clean up inside this very file.
     */
    mode?: 'plan' | 'library';
    saving: boolean;
    /** Server-side validation message, shown verbatim — never re-worded here. */
    error: string | null;
    onsave: (draft: WorkoutDraft) => void;
    oncancel: () => void;
  }

  let { workout, day, mode = 'plan', saving, error, onsave, oncancel }: Props = $props();

  const isLibrary = $derived(mode === 'library');

  /** A mutable mirror of `WorkoutStep`; the readonly wire type is rebuilt on submit. */
  interface DraftStep {
    kind: WorkoutStepKind;
    durationType: WorkoutDurationType;
    durationValue: number | null;
    targetType: WorkoutTargetType;
    targetLow: number | null;
    targetHigh: number | null;
    repeats: number;
    steps: DraftStep[];
    note: string;
  }

  const emptyStep = (kind: WorkoutStepKind = 'work'): DraftStep => ({
    kind,
    durationType: 'time',
    durationValue: 300,
    targetType: 'none',
    targetLow: null,
    targetHigh: null,
    repeats: 4,
    steps: [],
    note: ''
  });

  /** Store shape → editor shape. */
  function toDraft(step: WorkoutStep): DraftStep {
    return {
      kind: step.kind,
      durationType: step.durationType ?? 'time',
      durationValue: step.durationValue,
      targetType: step.target?.type ?? 'none',
      targetLow: step.target?.low ?? null,
      targetHigh: step.target?.high ?? null,
      repeats: step.repeats ?? 4,
      steps: (step.steps ?? []).map(toDraft),
      note: step.note ?? ''
    };
  }

  /** Editor shape → wire shape. Nulls, not empty strings — the validator distinguishes them. */
  function toStep(d: DraftStep): WorkoutStep {
    if (d.kind === 'repeat') {
      return {
        kind: 'repeat',
        durationType: null,
        durationValue: null,
        target: null,
        repeats: d.repeats,
        steps: d.steps.map(toStep),
        note: d.note.trim() || null
      };
    }
    return {
      kind: d.kind,
      durationType: d.durationType,
      durationValue: d.durationType === 'lap' ? null : d.durationValue,
      target: d.targetType === 'none' ? null : { type: d.targetType, low: d.targetLow, high: d.targetHigh },
      repeats: null,
      steps: null,
      note: d.note.trim() || null
    };
  }

  // svelte-ignore state_referenced_locally
  let title = $state(workout?.title ?? '');
  // svelte-ignore state_referenced_locally
  let sport = $state(workout?.sport ?? 'running');
  // svelte-ignore state_referenced_locally
  let time = $state((workout && 'time' in workout ? workout.time : null) ?? '');
  // svelte-ignore state_referenced_locally
  let note = $state(workout?.note ?? '');
  // svelte-ignore state_referenced_locally
  let steps = $state<DraftStep[]>(
    workout ? workout.steps.map(toDraft) : [emptyStep('warmup'), emptyStep('work'), emptyStep('cooldown')]
  );

  const group = $derived(sportGroup(sport));
  /** Exactly the targets the validator will accept for this sport — same table, no second list. */
  const allowedTargets = $derived(WORKOUT_TARGETS_BY_GROUP[group]);

  const canSubmit = $derived(title.trim().length > 0 && steps.length > 0 && !saving);

  /**
   * A target that stops being valid when the sport changes is reset rather than left to be rejected on
   * save. Switching a run session to a walk silently keeping a cadence target would produce a 400 the
   * athlete could not connect to anything they did.
   */
  $effect(() => {
    const allowed = WORKOUT_TARGETS_BY_GROUP[sportGroup(sport)];
    const fix = (list: DraftStep[]): void => {
      for (const s of list) {
        if (s.targetType !== 'none' && !allowed.includes(s.targetType)) {
          s.targetType = 'none';
          s.targetLow = null;
          s.targetHigh = null;
        }
        if (s.steps.length > 0) fix(s.steps);
      }
    };
    fix(steps);
  });

  const unitOf = (t: WorkoutTargetType): string => WORKOUT_TARGET_UNITS[t] || '';

  /**
   * Kinds offered on a row. A row INSIDE a repeat block may not itself be a repeat — `normalizeWorkout`
   * refuses depth > 1 — so the control that would produce one is simply absent rather than offered and
   * then rejected. It is the only thing that differs between a top-level row and a nested one, which is
   * why one snippet draws both.
   */
  const kindsFor = (child: boolean): readonly WorkoutStepKind[] =>
    child ? WORKOUT_STEP_KINDS.filter((k) => k !== 'repeat') : WORKOUT_STEP_KINDS;

  function addStep(list: DraftStep[], kind: WorkoutStepKind = 'work'): void {
    list.push(emptyStep(kind));
  }
  function addRepeat(): void {
    const block = emptyStep('repeat');
    block.steps = [emptyStep('work'), emptyStep('recovery')];
    steps.push(block);
  }
  function removeAt(list: DraftStep[], i: number): void {
    list.splice(i, 1);
  }
  function move(list: DraftStep[], from: number, to: number): void {
    const next = moveItem(list, from, to);
    if (next === list) return;
    list.splice(0, list.length, ...(next as DraftStep[]));
  }

  function submit(event: SubmitEvent): void {
    event.preventDefault();
    if (!canSubmit) return;
    onsave({
      // In `library` mode both are ignored by the handler; sent as-is so one draft shape serves both.
      day,
      time: isLibrary ? null : time.trim() || null,
      sport,
      title: title.trim(),
      steps: steps.map(toStep),
      note: note.trim() || null
    });
  }
</script>

<form class="editor" onsubmit={submit}>
  {#if error}
    <!-- The server's own sentence, verbatim. `normalizeWorkout` already explains what is wrong; a
         second wording here would be a second place for the rule to be described, and they would
         eventually disagree. -->
    <Banner tone="danger" title="Nie zapisano">{error}</Banner>
  {/if}

  <div class="meta">
    <Field label="Nazwa">
      {#snippet children(control)}
        <Input
          id={control.id}
          bind:value={title}
          maxlength={WORKOUT_LIMITS.maxTitle}
          placeholder="np. Interwały 5×1 km"
          autocomplete="off"
        />
      {/snippet}
    </Field>

    <Field label="Sport">
      {#snippet children(control)}
        <select id={control.id} class="select" bind:value={sport}>
          {#each SPORT_LABELS as s (s.key)}
            <option value={s.key}>{sportLabel(i18n.t, s.key)}</option>
          {/each}
        </select>
      {/snippet}
    </Field>

    <!-- A library entry has no date by definition (spec 069) — that absence IS the type. -->
    {#if !isLibrary}
      <Field label="Godzina" help="Puste = kiedykolwiek tego dnia">
        {#snippet children(control)}
          <Input id={control.id} type="time" bind:value={time} />
        {/snippet}
      </Field>
    {/if}
  </div>

  {#if isLibrary && workout}
    <!-- Said at the point of editing rather than left to be discovered: scheduling COPIES the steps,
         so already-planned sessions keep the version that was actually committed to. -->
    <p class="scope-note">
      Zmiany dotyczą tylko biblioteki. Treningi już zaplanowane w kalendarzu zostaną bez zmian.
    </p>
  {/if}

  <div class="steps">
    <div class="steps-head">
      <h4>Kroki</h4>
      <span class="count">{steps.length} / {WORKOUT_LIMITS.maxSteps}</span>
    </div>

    <!--
      One row, drawn once. A top-level step and a step nested in a repeat block are the same controls
      over the same `DraftStep`; they used to be two copies of this markup, which is how the two drifted
      into offering different accessible names for the same field. The single difference — a nested row
      cannot itself be a repeat block — is the `child` argument, and it is the ONLY branch between them.
    -->
    {#snippet stepRow(s: DraftStep, list: DraftStep[], i: number, child: boolean)}
      <div class="step-bar" class:child>
        <select class="select kind" bind:value={s.kind} aria-label="Rodzaj kroku">
          {#each kindsFor(child) as k (k)}
            <option value={k}>{STEP_KIND_LABELS[k]}</option>
          {/each}
        </select>

        {#if s.kind === 'repeat'}
          <label class="inline">
            <span class="lbl">Powtórzeń</span>
            <input class="num" type="number" min="1" max={WORKOUT_LIMITS.maxRepeats} bind:value={s.repeats} />
          </label>
        {:else}
          <select class="select" bind:value={s.durationType} aria-label="Zakończ krok po">
            {#each WORKOUT_DURATION_TYPES as t (t)}
              <option value={t}>{DURATION_TYPE_LABELS[t]}</option>
            {/each}
          </select>

          {#if s.durationType !== 'lap'}
            <input
              class="num"
              type="number"
              min="1"
              bind:value={s.durationValue}
              aria-label={DURATION_VALUE_LABELS[s.durationType]}
            />
            <span class="unit">{DURATION_UNITS[s.durationType]}</span>
          {/if}

          <select class="select" bind:value={s.targetType} aria-label="Cel">
            {#each allowedTargets as t (t)}
              <option value={t}>{TARGET_TYPE_LABELS[t] ?? t}</option>
            {/each}
          </select>

          {#if s.targetType !== 'none'}
            <input class="num" type="number" bind:value={s.targetLow} aria-label="Cel od" />
            <span class="dash">–</span>
            <input class="num" type="number" bind:value={s.targetHigh} aria-label="Cel do" />
            <span class="unit">{unitOf(s.targetType)}</span>
          {/if}
        {/if}

        <div class="ctrl">
          <button type="button" aria-label="W górę" onclick={() => move(list, i, i - 1)} disabled={i === 0}
            >↑</button
          >
          <button
            type="button"
            aria-label="W dół"
            onclick={() => move(list, i, i + 1)}
            disabled={i === list.length - 1}>↓</button
          >
          <button type="button" class="del" aria-label="Usuń krok" onclick={() => removeAt(list, i)}>✕</button
          >
        </div>
      </div>
    {/snippet}

    {#each steps as step, i (i)}
      <div class="step" class:block={step.kind === 'repeat'}>
        {@render stepRow(step, steps, i, false)}

        {#if step.kind === 'repeat'}
          <div class="children">
            {#each step.steps as child, j (j)}
              {@render stepRow(child, step.steps, j, true)}
            {/each}
            <Button size="sm" variant="ghost" onclick={() => addStep(step.steps)}>+ Krok w bloku</Button>
          </div>
        {/if}
      </div>
    {/each}

    <div class="adders">
      <Button size="sm" variant="secondary" onclick={() => addStep(steps)}>+ Krok</Button>
      <!-- Top level only: `normalizeWorkout` refuses nested repeats, so no control may produce one. -->
      <Button size="sm" variant="secondary" onclick={addRepeat}>+ Powtórzenie</Button>
    </div>
  </div>

  <Field label="Notatka">
    {#snippet children(control)}
      <textarea
        id={control.id}
        class="note"
        rows="2"
        maxlength={WORKOUT_LIMITS.maxNote}
        bind:value={note}
        placeholder="Opcjonalny opis sesji"
        aria-describedby="{control.id}-sent"
      ></textarea>
      <!-- Said BEFORE the note is typed, not after it has been sent (spec 082). Until 082 the note
           never left this machine; the athlete writes notes to themselves and the audience changed. -->
      <p class="hint" id="{control.id}-sent">
        Notatka trafia do opisu treningu w Garmin Connect razem z sesją.
      </p>
    {/snippet}
  </Field>

  <div class="actions">
    <Button type="button" size="sm" variant="ghost" onclick={oncancel}>Anuluj</Button>
    <Button type="submit" size="sm" variant="primary" disabled={!canSubmit}>
      {saving ? 'Zapisuję…' : workout ? 'Zapisz zmiany' : 'Dodaj trening'}
    </Button>
  </div>
</form>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .meta {
    display: grid;
    grid-template-columns: 2fr 1.4fr 1fr;
    gap: var(--space-3);
  }
  .scope-note {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    line-height: var(--leading-normal);
  }
  .hint {
    margin: var(--space-1) 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    line-height: var(--leading-normal);
  }
  @media (max-width: 640px) {
    .meta {
      grid-template-columns: 1fr;
    }
  }
  .steps {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .steps-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .steps-head h4 {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }
  .count {
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    font-feature-settings: var(--numeric);
  }
  .step.block {
    padding: var(--space-2);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
  }
  .step-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
    padding: var(--space-1) 0;
  }
  .children {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-top: var(--space-2);
    padding-left: var(--space-3);
    border-left: 2px solid var(--color-accent-line);
  }
  .select,
  .num,
  .note {
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    padding: var(--space-1) var(--space-2);
    height: var(--space-8);
  }
  .note {
    width: 100%;
    height: auto;
    font-family: inherit;
  }
  .select:focus-visible,
  .num:focus-visible,
  .note:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .kind {
    min-width: 8rem;
  }
  .num {
    width: 5.5rem;
    font-feature-settings: var(--numeric);
  }
  .unit,
  .dash,
  .lbl {
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
  }
  .inline {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  .ctrl {
    display: inline-flex;
    gap: var(--space-1);
    margin-left: auto;
  }
  .ctrl button {
    min-width: 26px;
    height: 26px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    cursor: pointer;
  }
  .ctrl button:hover:not(:disabled) {
    color: var(--color-text);
    border-color: var(--color-text-muted);
  }
  .ctrl button:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .ctrl button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .ctrl .del:hover {
    color: var(--color-danger);
    border-color: var(--color-danger);
  }
  .adders {
    display: flex;
    gap: var(--space-2);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
