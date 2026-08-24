<script lang="ts">
  /**
   * Laps and Garmin's classified splits (spec 026).
   *
   * Two different objects, deliberately drawn differently:
   *  - **Okrążenia** are a sequence, so they are a table — one row per lap, and only the columns the
   *    device actually filled in.
   *  - **Typed splits** are per-class AGGREGATES (`RWD_RUN` with a `count` of stretches), not a
   *    sequence. They get a composition bar and a summary list; drawing them as a timeline would
   *    invent an order Garmin never sent.
   */
  import Card from '$lib/ui/Card.svelte';
  import Table from '$lib/ui/Table.svelte';
  import StackedBar from '$lib/ui/StackedBar.svelte';
  import type { SportGroup } from '$lib/sport-labels';
  import { getI18n } from '$lib/i18n';
  import { buildLapTable, buildSplitSummary } from './activity-laps';
  import { DASH, fmtDuration, fmtNum, fmtPace } from './activity-format';
  import type { ActivityLap } from './activity-detail.types';

  const i18n = getI18n();

  interface Props {
    laps: readonly ActivityLap[];
    typedSplits: readonly ActivityLap[];
    sport: SportGroup;
  }

  let { laps, typedSplits, sport }: Props = $props();

  const table = $derived(buildLapTable(i18n.t, laps, sport));
  const splits = $derived(buildSplitSummary(i18n.t, typedSplits));
  const segments = $derived(splits.map((s) => ({ label: s.label, value: s.seconds, color: s.color })));
</script>

{#if splits.length > 0}
  <Card title={i18n.t('laps.splitsTitle')} subtitle={i18n.t('laps.splitsSubtitle')}>
    <StackedBar
      {segments}
      ariaLabel={i18n.t('laps.splitsAriaLabel')}
      format={(v) => fmtDuration(v)}
      thickness="var(--space-4)"
    />
    <ul class="splits">
      {#each splits as split (split.key)}
        <li>
          <span class="s-swatch" style="background: {split.color}"></span>
          <span class="s-label">{split.label}</span>
          <span class="s-time">{fmtDuration(split.seconds)}</span>
          <span class="s-meta">
            {#if split.count !== null}{split.count}×{/if}
            {#if split.distanceM !== null}
              <span class="s-dot">·</span>{fmtNum(split.distanceM / 1000, 2, i18n.locale)} km
            {/if}
            {#if split.paceSecPerKm !== null}
              <span class="s-dot">·</span>{fmtPace(split.paceSecPerKm)} /km
            {/if}
          </span>
        </li>
      {/each}
    </ul>
  </Card>
{/if}

{#if table}
  <Card title={i18n.t('laps.title')} subtitle={i18n.t('laps.subtitle', { count: table.rows.length })}>
    <Table zebra caption={i18n.t('laps.caption')}>
      {#snippet head()}
        {#each table.columns as col (col.key)}
          <th class={col.numeric ? 'num' : ''}>{col.label}</th>
        {/each}
      {/snippet}
      {#each table.rows as row (row.key)}
        <tr>
          {#each row.cells as cell, i (table.columns[i]?.key ?? i)}
            <td class={table.columns[i]?.numeric ? 'num' : ''}>{cell ?? DASH}</td>
          {/each}
        </tr>
      {/each}
    </Table>
  </Card>
{/if}

<style>
  .splits {
    list-style: none;
    margin: var(--space-4) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .splits li {
    display: grid;
    grid-template-columns: auto minmax(80px, auto) auto 1fr;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    font-feature-settings: var(--numeric);
  }

  .s-swatch {
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-full);
  }

  .s-label {
    color: var(--color-text);
    font-weight: var(--font-semibold);
  }

  .s-time {
    color: var(--color-text);
    font-weight: var(--font-semibold);
  }

  .s-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
  }

  .s-dot {
    color: var(--color-text-subtle);
  }

  .num {
    text-align: right;
  }

  td.num {
    font-feature-settings: var(--numeric);
  }
</style>
