<script lang="ts">
  /**
   * Read-only rendering of a step tree (spec 066). Shared by the day panel and the editor's preview so
   * a session reads identically wherever it is shown.
   *
   * Nesting is one level deep and always will be — `normalizeWorkout` refuses deeper — so this renders
   * a repeat block's children with an explicit inner list rather than recursing into itself. A
   * self-recursive component would be modelling a tree the validator does not allow.
   */
  import type { WorkoutStep } from '$lib/workouts';
  import { stepKindLabel, describeDuration, describeTarget } from './workout-format';
  import { getI18n } from '$lib/i18n';

  const i18n = getI18n();

  let { steps }: { steps: readonly WorkoutStep[] } = $props();
</script>

<ol class="steps">
  {#each steps as step, i (i)}
    <li class="step" class:repeat={step.kind === 'repeat'}>
      {#if step.kind === 'repeat'}
        <div class="row">
          <span class="kind">{stepKindLabel(i18n.t, 'repeat')}</span>
          <span class="reps">×{step.repeats ?? 0}</span>
        </div>
        <ol class="children">
          {#each step.steps ?? [] as child, j (j)}
            <li class="step child">
              <div class="row">
                <span class="kind kind-{child.kind}">{stepKindLabel(i18n.t, child.kind)}</span>
                <span class="dur">{describeDuration(i18n.t, child)}</span>
                {#if describeTarget(i18n.t, child.target)}
                  <span class="target">{describeTarget(i18n.t, child.target)}</span>
                {/if}
              </div>
              {#if child.note}<p class="note">{child.note}</p>{/if}
            </li>
          {/each}
        </ol>
      {:else}
        <div class="row">
          <span class="kind kind-{step.kind}">{stepKindLabel(i18n.t, step.kind)}</span>
          <span class="dur">{describeDuration(i18n.t, step)}</span>
          {#if describeTarget(i18n.t, step.target)}<span class="target"
              >{describeTarget(i18n.t, step.target)}</span
            >{/if}
        </div>
        {#if step.note}<p class="note">{step.note}</p>{/if}
      {/if}
    </li>
  {/each}
</ol>

<style>
  .steps,
  .children {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .children {
    margin-top: var(--space-1);
    /* Indented and ruled, so a glance answers "which steps are inside the repeat" without counting. */
    padding-left: var(--space-3);
    border-left: 2px solid var(--color-accent-line);
  }
  .step.repeat {
    padding: var(--space-2);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md);
  }
  .row {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    flex-wrap: wrap;
    font-size: var(--text-sm);
  }
  .kind {
    min-width: 6.5rem;
    font-weight: var(--font-semibold);
    color: var(--color-text-muted);
  }
  /* The two kinds that carry the session's intent get the accent; the rest stay quiet, so an interval
     set reads as work-and-recovery rather than five equally loud rows. */
  .kind-work {
    color: var(--color-accent);
  }
  .kind-recovery,
  .kind-rest {
    color: var(--color-text-subtle);
  }
  .reps {
    font-weight: var(--font-bold);
    color: var(--color-accent);
    font-feature-settings: var(--numeric);
  }
  .dur {
    color: var(--color-text);
    font-feature-settings: var(--numeric);
  }
  .target {
    color: var(--color-text-muted);
    font-feature-settings: var(--numeric);
  }
  .note {
    margin: 2px 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
  }
</style>
