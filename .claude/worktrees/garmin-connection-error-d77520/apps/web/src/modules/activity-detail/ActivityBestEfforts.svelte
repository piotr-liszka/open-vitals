<script lang="ts">
  /**
   * Best efforts inside this session (spec 040) — the 5 km hidden in a 15 km long run.
   *
   * Presentational; the handler found the windows. Two things are deliberately on the page rather than
   * only in the engine's doc comment, because both change how a reader should treat the numbers:
   * the effort's window covers *at least* the target (so the covered distance is shown next to it), and
   * the numbers inherit the watch's sample interval.
   */
  import Card from '$lib/ui/Card.svelte';
  import { fmtClock, fmtNum, fmtPace } from './activity-format';
  import type { BestEffort } from './activity-detail.types';

  let { efforts }: { efforts: readonly BestEffort[] } = $props();

  /** True when any window had to overshoot its target by enough to be worth explaining. */
  const overshoots = $derived(efforts.some((e) => e.actualM > e.metres * 1.02));
</script>

{#if efforts.length > 0}
  <Card
    title="Najlepsze odcinki"
    subtitle="Najszybszy fragment tej aktywności na każdym dystansie — także wtedy, gdy był tylko jej częścią"
  >
    <div class="table-wrap">
      <table class="efforts">
        <thead>
          <tr>
            <th scope="col">Dystans</th>
            <th scope="col" class="num">Czas</th>
            <th scope="col" class="num">Tempo</th>
            <th scope="col" class="num">Start</th>
            <th scope="col" class="num">Zmierzono</th>
          </tr>
        </thead>
        <tbody>
          {#each efforts as e (e.key)}
            <tr>
              <th scope="row">{e.label}</th>
              <td class="num strong">{fmtClock(e.durationS)}</td>
              <td class="num">{fmtPace(e.paceSecPerKm)}<small>min/km</small></td>
              <td class="num muted">{fmtClock(e.startS)}</td>
              <td class="num muted">{fmtNum(e.actualM)}<small>m</small></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="note">
      Okno pomiarowe pokrywa <em>co najmniej</em> zadany dystans, dlatego kolumna „zmierzono” pokazuje, ile
      metrów faktycznie objęło — tempo liczymy z tej wartości, a nie z dystansu nominalnego.
      {#if overshoots}
        Przy tym zapisie okna wyraźnie wychodzą poza dystans, co znaczy, że zegarek próbkował rzadko.
      {/if}
      „Start” to czas od początku aktywności.
    </p>
  </Card>
{/if}

<style>
  /* A five-column table must scroll inside its own box, never push the page sideways. */
  .table-wrap {
    overflow-x: auto;
  }

  .efforts {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  .efforts th,
  .efforts td {
    padding: var(--space-2) var(--space-3);
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
  }

  .efforts thead th {
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }

  .efforts tbody th {
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }

  .num {
    text-align: right;
    font-feature-settings: var(--numeric);
  }

  .strong {
    font-weight: var(--font-bold);
    color: var(--color-text);
  }

  .muted {
    color: var(--color-text-muted);
  }

  .efforts small {
    margin-left: 0.35ch;
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text-muted);
  }

  .note {
    margin: var(--space-3) 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    max-width: 78ch;
  }
</style>
