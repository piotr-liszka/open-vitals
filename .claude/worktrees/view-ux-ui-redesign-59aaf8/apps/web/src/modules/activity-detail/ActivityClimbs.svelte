<script lang="ts">
  /**
   * What did I climb? (spec 046)
   *
   * Total elevation gain answers "how hilly was it". This answers a different question: 600 m of rolling
   * terrain and 600 m in one long ascent are the same number and nothing alike.
   *
   * VAM — metres of ascent per hour — is the column that makes climbs comparable to each other and to past
   * efforts, because unlike a time it does not care how long the climb was.
   *
   * Presentational; the handler found the climbs. The card says what fraction of the day's gain was actual
   * climbing, because that ratio is the honest summary of a hilly-looking ride that was really just rolling.
   */
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import { fmtClock, fmtKm, fmtNum } from './activity-format';
  import type { Climb } from './activity-detail.types';

  let { climbs, totalGainM }: { climbs: readonly Climb[]; totalGainM: number | null } = $props();

  const nf = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 });

  const climbedM = $derived(climbs.reduce((sum, c) => sum + c.gainM, 0));
  /** Share of the day's ascent that happened inside a named climb. */
  const sharePct = $derived(
    totalGainM !== null && totalGainM > 0 ? Math.min(100, (climbedM / totalGainM) * 100) : null
  );
  const hardest = $derived(
    climbs.reduce<Climb | null>((best, c) => (best === null || c.score > best.score ? c : best), null)
  );
</script>

{#if climbs.length > 0}
  <Card
    title="Podjazdy"
    subtitle="Nie „ile przewyższenia”, a „co konkretnie wjechałem” — z VAM, czyli tempem wspinania"
  >
    {#snippet actions()}
      {#if hardest && hardest.categoryKey !== 'uncat'}
        <Badge tone="info">Najtrudniejszy: {hardest.categoryLabel}</Badge>
      {/if}
    {/snippet}

    <p class="summary">
      <strong>{nf.format(climbs.length)}</strong>
      {climbs.length === 1 ? 'podjazd' : 'podjazdów'} · <strong>{nf.format(climbedM)} m</strong> wspinania
      {#if sharePct !== null}
        · to {nf1.format(sharePct)}% całego przewyższenia tej aktywności
      {/if}
    </p>

    <div class="table-wrap">
      <table class="climbs">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col" class="num">Przewyższenie</th>
            <th scope="col" class="num">Długość</th>
            <th scope="col" class="num">Nachylenie</th>
            <th scope="col" class="num">Czas</th>
            <th scope="col" class="num">VAM</th>
            <th scope="col" class="num">Start</th>
            <th scope="col">Kategoria</th>
          </tr>
        </thead>
        <tbody>
          {#each climbs as c (c.index)}
            <tr>
              <th scope="row">{c.index}</th>
              <td class="num strong">{fmtNum(c.gainM)}<small>m</small></td>
              <td class="num">{fmtKm(c.distanceM, 2)}<small>km</small></td>
              <td class="num">{nf1.format(c.gradePct)}<small>%</small></td>
              <td class="num muted">{fmtClock(c.durationS)}</td>
              <td class="num strong">{nf.format(c.vam)}<small>m/h</small></td>
              <td class="num muted">{fmtClock(c.startS)}</td>
              <td class="cat">{c.categoryLabel}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <p class="note">
      Podjazd to ciągły wzrost o co najmniej 30 m przy średnim nachyleniu od 2%; krótkie zjazdy w środku go
      nie przerywają, bo prawdziwe drogi mają fałszywe płaskie. VAM liczymy z czasu całego podjazdu — postój w
      połowie faktycznie obniża tempo wspinania. Wysokość z barometru dryfuje, a z GPS jeszcze bardziej, więc
      kategorie traktuj jako orientacyjne.
    </p>
  </Card>
{/if}

<style>
  .summary {
    margin: 0 0 var(--space-4);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .summary strong {
    color: var(--color-text);
    font-feature-settings: var(--numeric);
  }

  /* An eight-column table must scroll inside its own box, never push the page sideways. */
  .table-wrap {
    overflow-x: auto;
  }

  .climbs {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--text-sm);
  }

  .climbs th,
  .climbs td {
    padding: var(--space-2) var(--space-3);
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
  }

  .climbs thead th {
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }

  .climbs tbody th {
    width: 3ch;
    font-weight: var(--font-semibold);
    color: var(--color-text-muted);
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

  .cat {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }

  .climbs small {
    margin-left: 0.35ch;
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text-muted);
  }

  .note {
    margin: var(--space-3) 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    max-width: 84ch;
  }
</style>
