<script lang="ts">
  /**
   * The grouped detail numbers (spec 026). Presentational: `buildStatSections` decided what exists,
   * this only draws it.
   *
   * Density is the job. Sixteen sections of three-to-seven readouts would be unreadable as a flat
   * grid of tiles, so each group is a titled cluster with a lane-coloured rule, and the clusters
   * flow in columns. A value whose absence has a reason renders a dashed em dash carrying that
   * reason — as a tooltip for pointers, as text for screen readers.
   *
   * NOTE (design-system): the compact `value / label` readout below is deliberately NOT `StatTile` —
   * a bordered tile per number would nest cards and blow this section up to three screens. It is
   * built from tokens only and is a candidate to be promoted into `lib/ui` as a shared
   * `ReadoutGrid`; see the spec's follow-ups.
   */
  import type { StatSection } from './activity-stat-groups';
  import { DASH } from './activity-format';

  let { sections }: { sections: readonly StatSection[] } = $props();
</script>

<div class="groups">
  {#each sections as group (group.key)}
    <section class="group" style="--lane: {group.accent}">
      <h3 class="group-title">{group.title}</h3>
      <dl class="readouts">
        {#each group.items as item (item.key)}
          <div class="readout">
            <dt class="label">{item.label}</dt>
            <dd class="value" class:absent={item.value === null}>
              {#if item.value === null}
                <span class="dash" title={item.hint}>{DASH}</span>
                {#if item.hint}<span class="sr-only">Brak danych: {item.hint}</span>{/if}
              {:else}
                {item.value}{#if item.unit}<span class="unit">{item.unit}</span>{/if}
              {/if}
            </dd>
          </div>
        {/each}
      </dl>
    </section>
  {/each}
</div>

<style>
  .groups {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-6) var(--space-8);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }

  /* Instrument caps with the group's lane colour as a leading rule — the only chrome a group gets. */
  .group-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--color-border);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
  }

  .group-title::before {
    content: '';
    width: var(--space-1);
    height: var(--text-xs);
    border-radius: var(--radius-full);
    background: var(--lane, var(--color-accent));
  }

  .readouts {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: var(--space-3) var(--space-4);
    margin: 0;
  }

  .readout {
    display: flex;
    flex-direction: column-reverse; /* value first visually, label under it */
    gap: var(--space-1);
    min-width: 0;
  }

  .label {
    font-size: var(--text-xs);
    line-height: var(--leading-snug);
    color: var(--color-text-muted);
  }

  .value {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-tight);
    line-height: var(--leading-tight);
    color: var(--color-text);
    font-feature-settings: var(--numeric);
    white-space: nowrap;
  }

  .value.absent {
    color: var(--color-text-subtle);
  }

  .unit {
    margin-left: 0.25ch;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--color-text-muted);
  }

  /* A dash with an explanation reads as "we checked" rather than "it broke". */
  .dash[title] {
    border-bottom: 1px dotted var(--color-border-strong);
    cursor: help;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
