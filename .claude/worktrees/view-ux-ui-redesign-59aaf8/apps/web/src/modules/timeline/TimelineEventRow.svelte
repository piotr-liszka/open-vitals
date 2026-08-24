<script lang="ts">
  /**
   * One event on the timeline rail (spec 022): a lane-coloured node, a glyph, the headline, and the
   * pre-formatted micro readouts the API produced. Presentational — it does no maths and knows
   * nothing about ranking; it only switches on the event's `kind` for the bits that differ.
   */
  import { Icon } from '$lib/ui';
  import type { TimelineEvent } from './timeline.types';

  interface Props {
    event: TimelineEvent;
    /**
     * Geometry only (spec 032). `rail` hangs the event off the vertical hairline with its own node;
     * `column` stacks it inside a day column of the horizontal axis, where the column header already
     * carries the axis tick. Same content either way.
     */
    layout?: 'rail' | 'column';
  }

  let { event, layout = 'rail' }: Props = $props();

  /** Health events that moved the healthy way are news too — just not bad news. */
  const tone = $derived(
    event.kind === 'health'
      ? event.favourable
        ? 'good'
        : 'bad'
      : event.kind === 'milestone'
        ? 'mark'
        : 'plain'
  );
</script>

<li class="row {tone} {layout}" style="--lane: var(--lane-{event.accent})">
  {#if layout === 'rail'}
    <span class="node" aria-hidden="true"></span>
  {/if}

  <span class="glyph"><Icon name={event.icon} size={18} /></span>

  <div class="body">
    <div class="head">
      {#if event.href}
        <a class="title" href={event.href}>{event.title}</a>
      {:else}
        <span class="title">{event.title}</span>
      {/if}
      {#if event.time}<span class="time">{event.time}</span>{/if}
    </div>

    {#if event.detail}
      <p class="detail">{event.detail}</p>
    {/if}

    {#if event.stats.length > 0}
      <dl class="stats">
        {#each event.stats as stat (stat.label)}
          <div class="stat">
            <dt>{stat.label}</dt>
            <dd>
              {stat.value}{#if stat.unit}<span class="unit">{stat.unit}</span>{/if}
            </dd>
          </div>
        {/each}
      </dl>
    {/if}
  </div>
</li>

<style>
  .row {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    column-gap: var(--space-3);
    padding: var(--space-3) 0 var(--space-3) var(--space-6);
    min-width: 0;
  }

  /* Inside a day column of the horizontal axis: no rail to hang off, so no node and no left inset;
     events in the same day are separated by a hairline instead of by the rail's rhythm. */
  .row.column {
    padding: var(--space-3) 0;
  }

  /* A day column is ~15rem wide, so the readouts sit closer than on the full-width rail. */
  .row.column .stats {
    gap: var(--space-1) var(--space-4);
  }

  /* The rail node. Sits on the shared vertical line drawn by the parent. */
  .node {
    position: absolute;
    left: 0;
    top: calc(var(--space-3) + 0.55rem);
    width: var(--space-2);
    height: var(--space-2);
    margin-left: calc(var(--space-2) / -2);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    box-shadow: 0 0 0 2px var(--lane);
  }

  .row.mark .node,
  .row.bad .node {
    background: var(--lane);
  }

  .glyph {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--space-8);
    height: var(--space-8);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    background: var(--color-surface-2);
    color: var(--lane);
  }

  .row.bad .glyph {
    border-color: color-mix(in srgb, var(--lane) 45%, transparent);
    background: color-mix(in srgb, var(--lane) 12%, transparent);
  }

  .row.mark .glyph {
    border-color: var(--color-accent-line);
    background: var(--color-accent-soft);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .head {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .title {
    font-size: var(--text-base);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
    text-decoration: none;
    min-width: 0;
  }

  a.title:hover {
    color: var(--color-accent);
    text-decoration: underline;
  }

  a.title:focus-visible {
    outline: none;
    border-radius: var(--radius-sm);
    box-shadow: var(--focus-ring);
  }

  .time {
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    font-feature-settings: var(--numeric);
    letter-spacing: var(--tracking-wide);
  }

  .detail {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    line-height: var(--leading-snug);
  }

  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-5);
    margin: var(--space-1) 0 0;
  }

  .stat {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
  }

  .stat dt {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-subtle);
  }

  .stat dd {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
    white-space: nowrap;
  }

  .unit {
    margin-left: 2px;
    font-weight: var(--font-medium);
    color: var(--color-text-muted);
  }
</style>
