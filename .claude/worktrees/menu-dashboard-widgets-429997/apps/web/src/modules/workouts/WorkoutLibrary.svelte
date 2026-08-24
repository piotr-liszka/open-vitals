<script lang="ts">
  /**
   * The workout library (spec 069) — reusable sessions with no date, and the drag source for the
   * calendar above it.
   *
   * The split it represents is the real model of planning: a session is a thing you HAVE, a plan is
   * WHEN you will do it. Spec 066 could only express the second, so the athlete who does the same
   * 5×1 km every fortnight rebuilt it every fortnight.
   *
   * Dragging is the headline gesture, but every entry also carries a "schedule on the selected day"
   * button — a drag is not reachable from a keyboard, and here it would otherwise be the ONLY way to
   * get a workout onto a day.
   */
  import Button from '$lib/ui/Button.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import { sportLabel } from '$lib/sport-labels';
  import { formatDay, type DayKey } from '$lib/date';
  import { describeSteps, fmtClock, fmtDistance } from './workout-format';
  import type { WorkoutTemplateView } from './workouts.types';

  interface Props {
    templates: readonly WorkoutTemplateView[];
    /** The day a keyboard "schedule" lands on — the calendar's current selection. */
    selectedDay: DayKey;
    canWrite: boolean;
    onschedule: (template: WorkoutTemplateView, day: DayKey) => void;
    onedit: (template: WorkoutTemplateView) => void;
    ondelete: (template: WorkoutTemplateView) => void;
    oncreate: () => void;
    /** Told which template is being dragged, so the calendar knows what a drop means. */
    ondragtemplate: (template: WorkoutTemplateView | null) => void;
  }

  let { templates, selectedDay, canWrite, onschedule, onedit, ondelete, oncreate, ondragtemplate }: Props =
    $props();

  let draggingId = $state<string | null>(null);

  function onDragStart(t: WorkoutTemplateView, event: DragEvent): void {
    draggingId = t.id;
    ondragtemplate(t);
    // The id also rides in the payload so a drop handler could read it without shared state; the
    // component state is what the calendar actually uses, same as the dashboard grid (spec 064).
    event.dataTransfer?.setData('text/plain', t.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }

  function onDragEnd(): void {
    draggingId = null;
    ondragtemplate(null);
  }

  const summary = (t: WorkoutTemplateView): string => {
    const bits: string[] = [];
    if (t.estimatedDurationS !== null) bits.push(fmtClock(t.estimatedDurationS));
    if (t.estimatedDistanceM !== null) bits.push(fmtDistance(t.estimatedDistanceM));
    return bits.join(' · ');
  };
</script>

<section class="library">
  <div class="head">
    <h3 class="title">Biblioteka treningów</h3>
    {#if canWrite}
      <Button size="sm" variant="secondary" onclick={oncreate}>+ Nowy</Button>
    {/if}
  </div>

  {#if templates.length === 0}
    <p class="empty">
      Biblioteka jest pusta. Zapisz tu treningi, które powtarzasz — potem przeciągniesz je na kalendarz.{canWrite
        ? ''
        : ' Włącz zgodę „Tworzenie treningów”, aby dodawać.'}
    </p>
  {:else}
    <p class="hint">Przeciągnij trening na dzień w kalendarzu albo użyj przycisku „Zaplanuj”.</p>
    <ul class="list">
      {#each templates as t (t.id)}
        <li
          class="item"
          class:dragging={draggingId === t.id}
          draggable={canWrite}
          ondragstart={(e) => onDragStart(t, e)}
          ondragend={onDragEnd}
        >
          <div class="row">
            <div class="who">
              <Badge tone="neutral">{sportLabel(t.sport)}</Badge>
              <span class="name">{t.title}</span>
            </div>
            {#if summary(t)}<span class="est">{summary(t)}</span>{/if}
          </div>

          <!-- The step tree as one line: enough to recognise the session without opening it. -->
          <p class="steps">{describeSteps(t.steps)}</p>

          {#if canWrite}
            <div class="actions">
              <Button size="sm" variant="ghost" onclick={() => onschedule(t, selectedDay)}>
                Zaplanuj na {formatDay(selectedDay, 'short')}
              </Button>
              <Button size="sm" variant="ghost" onclick={() => onedit(t)}>Edytuj</Button>
              <Button size="sm" variant="ghost" onclick={() => ondelete(t)}>Usuń</Button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .library {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .title {
    margin: 0;
    font-size: var(--text-md);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
  }
  .empty,
  .hint {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    line-height: var(--leading-normal);
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .item {
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
  }
  .item[draggable='true'] {
    cursor: grab;
  }
  /* Fades rather than disappears: the browser drags a copy, and a hidden original makes the list look
     like it lost an entry mid-drag (same reasoning as the dashboard grid, spec 064). */
  .item.dragging {
    opacity: 0.4;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .who {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }
  .name {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .est {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    font-feature-settings: var(--numeric);
    flex-shrink: 0;
  }
  .steps {
    margin: var(--space-1) 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    font-feature-settings: var(--numeric);
  }
  .actions {
    display: flex;
    gap: var(--space-1);
    margin-top: var(--space-2);
    flex-wrap: wrap;
  }
</style>
