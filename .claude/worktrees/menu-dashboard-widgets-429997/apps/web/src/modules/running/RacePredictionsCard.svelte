<script lang="ts">
  /**
   * Predicted race times as a CARD (spec 057) — one row per distance instead of the five-column table
   * spec 043 shipped.
   *
   * The table was readable but flat: five equally sized cells, so the number an athlete actually came
   * for (the projected finish time) had the same weight as the extrapolation factor. Here the finish
   * time is the headline, the pace sits under it, and the trailing badge answers the second question
   * the athlete always asks — am I faster than I was?
   *
   * Nothing the table showed is dropped: the critical-speed estimate, the source best, its local day,
   * whether that source was measured or projected and the extrapolation factor all live in the row's
   * secondary lines.
   *
   * Presentational. Formatting helpers are inlined because the shared ones live under `$lib/server`.
   */
  import Card from '$lib/ui/Card.svelte';
  import DeltaBadge from '$lib/ui/DeltaBadge.svelte';
  import { formatDay } from '$lib/date';
  import type { RacePrediction } from './running.types';

  let { predictions }: { predictions: readonly RacePrediction[] } = $props();

  const nf1 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 });

  /** `h:mm:ss` or `mm:ss` — a marathon needs the hour, a 5 km must not carry a leading zero. */
  const fmtDur = (totalS: number | null): string => {
    if (totalS == null || !Number.isFinite(totalS)) return '—';
    const s = Math.round(totalS);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  };

  /** `mm:ss` per kilometre. Rounded to whole seconds FIRST so 59.6 s rolls over instead of "1:60". */
  const fmtPace = (secPerKm: number | null): string => {
    if (secPerKm == null || !Number.isFinite(secPerKm)) return '—';
    const t = Math.round(secPerKm);
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  };

  const BASIS_LABEL = {
    measured: 'zmierzony odcinek',
    projected: 'projekcja z całego biegu'
  } as const;
</script>

<Card
  title="Przewidywane czasy"
  subtitle="Dwie niezależne metody. Gdy się zgadzają, liczba jest coś warta; gdy się rozjeżdżają — to też jest informacja."
>
  <ul class="rows">
    {#each predictions as p (p.key)}
      {@const delta = p.trend?.deltaS ?? null}
      <li class="row" class:soft={!p.confident}>
        <div class="head">
          <h4 class="dist">{p.label}</h4>
          {#if p.trend && delta !== null}
            <DeltaBadge
              direction={delta > 0 ? 'better' : delta < 0 ? 'worse' : 'same'}
              arrow={delta > 0 ? 'down' : delta < 0 ? 'up' : 'none'}
              value={delta === 0 ? 'bez zmian' : fmtDur(Math.abs(delta))}
              label={delta === 0
                ? `${p.label}: bez zmian od ${formatDay(p.trend.sinceDay, 'shortYear')}`
                : `${p.label}: ${delta > 0 ? 'szybciej' : 'wolniej'} o ${fmtDur(Math.abs(delta))} niż ${formatDay(p.trend.sinceDay, 'shortYear')}`}
            />
          {/if}
        </div>

        <p class="time">{p.riegelS === null ? '—' : fmtDur(p.riegelS)}</p>
        <p class="pace">
          {fmtPace(p.paceSecPerKm)}<small>/km</small>
          {#if p.criticalSpeedS !== null}
            <span class="sep" aria-hidden="true">·</span>
            <span class="cs">z tempa krytycznego {fmtDur(p.criticalSpeedS)}</span>
          {/if}
        </p>

        <p class="src">
          {#if p.fromLabel}
            Na podstawie: {p.fromLabel}
            {#if p.fromDay}
              <span class="sep" aria-hidden="true">·</span>{formatDay(p.fromDay, 'shortYear')}
            {/if}
            {#if p.fromBasis}
              <span class="sep" aria-hidden="true">·</span>{BASIS_LABEL[p.fromBasis]}
            {/if}
            {#if p.extrapolation !== null && p.extrapolation > 1}
              <span class="sep" aria-hidden="true">·</span>ekstrapolacja ×{nf1.format(p.extrapolation)}
            {/if}
            {#if !p.confident}
              <span class="sep" aria-hidden="true">·</span><span class="warn">daleka ekstrapolacja</span>
            {/if}
          {:else}
            Tylko model tempa krytycznego — żaden rekord nie jest dość blisko tego dystansu.
          {/if}
        </p>
      </li>
    {/each}
  </ul>

  <p class="note">
    Duża liczba to prawo Riegela zastosowane do Twojego najbliższego wynikowo dystansu — im dalsza
    ekstrapolacja, tym mniej znaczy, dlatego pokazujemy jej krotność i nie liczymy jej wcale powyżej
    czterokrotności. Znacznik obok dystansu porównuje dzisiejszą prognozę z tą samą prognozą policzoną
    wyłącznie z wyników sprzed 90 dni; gdy nie ma czego porównać, znacznika po prostu nie ma. Dystanse, o
    których żadna metoda nie ma nic do powiedzenia, tu nie występują. Żadna z metod nie wie nic o paliwie,
    upale ani o tym, czy przebiegłeś kiedyś ten dystans.
  </p>
</Card>

<style>
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--space-5);
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  /* A far extrapolation is dimmed rather than hidden: still shown, visibly less load-bearing. Dimmed
     by stepping the TEXT token down, not with `opacity` — opacity would fade the delta badge and the
     warning below AA contrast, which is exactly the information a low-confidence row still needs. */
  .row.soft .time {
    font-weight: var(--font-semibold);
    color: var(--color-text-muted);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    min-height: var(--space-6);
  }

  .dist {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
  }

  .time {
    margin: 0;
    /* A number the user reads, so the fluid readout scale — not a fixed --text-* step. */
    font-size: var(--readout-md);
    font-weight: var(--font-bold);
    line-height: var(--leading-tight);
    letter-spacing: var(--tracking-tight);
    font-feature-settings: var(--numeric);
    color: var(--color-text);
  }

  .pace {
    margin: 0;
    font-size: var(--text-sm);
    font-feature-settings: var(--numeric);
    color: var(--color-text-muted);
  }

  .pace small {
    margin-left: 0.2ch;
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
  }

  .cs {
    font-size: var(--text-xs);
  }

  .src {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    text-wrap: pretty;
  }

  .sep {
    margin: 0 0.5ch;
  }

  .warn {
    color: var(--color-warning);
  }

  .note {
    margin: var(--space-5) 0 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    max-width: 78ch;
  }
</style>
