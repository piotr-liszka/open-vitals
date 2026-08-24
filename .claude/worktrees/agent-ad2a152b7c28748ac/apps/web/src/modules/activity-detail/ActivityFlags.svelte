<script lang="ts">
  /**
   * The two kinds of number worth pulling out of the sixty on this page (spec 036): the ones that
   * were notable, and the ones that are probably wrong.
   *
   * Presentational. `buildHighlights` / `buildSuspects` already decided what is worth saying and
   * wrote the sentence; this only places it. Both lists empty → nothing renders, so a page with an
   * unremarkable, clean activity is not padded with an "all normal" card.
   *
   * The two live in one card on purpose. They are the same question asked twice — "does this number
   * mean anything?" — and splitting them would put a warning below the fold on a phone.
   */
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import type { ActivityHighlight, SuspectValue } from './activity-highlights';

  let {
    highlights,
    suspects
  }: { highlights: readonly ActivityHighlight[]; suspects: readonly SuspectValue[] } = $props();

  const has = $derived(highlights.length > 0 || suspects.length > 0);
</script>

{#if has}
  <Card title="Warto zauważyć" subtitle="Rekordy i wartości, które wyglądają na błąd pomiaru">
    <div class="flags">
      {#if highlights.length > 0}
        <ul class="list" aria-label="Wyróżnione wyniki">
          {#each highlights as h (h.key)}
            <li class="row" class:record={h.kind === 'record'}>
              <div class="head">
                <span class="label">{h.label}</span>
                <Badge tone={h.kind === 'record' ? 'success' : 'info'}>
                  {h.kind === 'record' ? 'Rekord' : 'Wyróżnienie'}
                </Badge>
              </div>
              <p class="value">
                {h.value}{#if h.unit}<span class="unit">{h.unit}</span>{/if}
              </p>
              <p class="text">{h.text}</p>
              <p class="rank">{h.rank} z {h.outOf} porównywalnych sesji</p>
            </li>
          {/each}
        </ul>
      {/if}

      {#if suspects.length > 0}
        <ul class="list suspects" aria-label="Wartości wyglądające na błąd">
          {#each suspects as s (s.key)}
            <li class="row" class:warn={s.severity === 'warn'}>
              <div class="head">
                <span class="label">{s.label}</span>
                <Badge tone={s.severity === 'warn' ? 'danger' : 'warning'}>
                  {s.severity === 'warn' ? 'Podejrzana wartość' : 'Do sprawdzenia'}
                </Badge>
              </div>
              <p class="value muted">{s.value}</p>
              <p class="text">{s.text}</p>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </Card>
{/if}

<style>
  .flags {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space-4);
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--color-border);
    border-left: 3px solid var(--lane, var(--color-border-strong));
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
  }

  .list:not(.suspects) .row {
    --lane: var(--lane-cyan);
  }

  /*
    The lane rule carries the meaning at a glance; the badge spells it out. Scoped to the same depth
    as the cyan default above it — a bare `.row.record` loses the cascade to `.list:not(.suspects)
    .row` on specificity, which silently painted every personal record in the "notable" cyan.
  */
  .list:not(.suspects) .row.record {
    --lane: var(--lane-green);
  }

  .suspects .row {
    --lane: var(--lane-amber);
  }

  .suspects .row.warn {
    --lane: var(--lane-red);
  }

  /*
    Label above badge, ALWAYS — never side by side.

    These sit in an auto-fill grid, so the column width is whatever the widest card needs, and a
    `space-between` row wrapped only for the cards whose label happened to be long ("OBCIĄŻENIE
    TRENINGOWE" wrapped, "KALORIE" did not). Four cards reading the same kind of fact then had their
    numbers, sentences and ranks on four different baselines. Stacking costs one line on the short
    labels and buys a row of cards that scans as one instrument.
  */
  .head {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
    margin-bottom: var(--space-1);
  }

  .label {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }

  .value {
    margin: 0;
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    color: var(--color-text);
    font-feature-settings: var(--numeric);
    letter-spacing: var(--tracking-tight);
  }

  /* A suspect number is evidence, not a headline — it must not out-shout the explanation. */
  .value.muted {
    font-size: var(--text-base);
    color: var(--color-text-muted);
  }

  .unit {
    margin-left: 0.3ch;
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text-muted);
  }

  .text {
    margin: 0;
    font-size: var(--text-sm);
    line-height: var(--leading-snug);
    color: var(--color-text);
  }

  /*
    Pinned to the bottom of the card: the grid already stretches every card in a row to the tallest
    one, so without this a two-line sentence and a three-line sentence put their rank lines a row
    apart. `auto` eats the leftover space instead.
  */
  .rank {
    margin: auto 0 0;
    padding-top: var(--space-1);
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    font-feature-settings: var(--numeric);
  }
</style>
