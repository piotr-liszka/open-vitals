<script lang="ts">
  /**
   * Where the athlete is HEADED, not where they are (spec 039). The PMC above this card already says
   * fitness/fatigue/form; this says how fast load is being added and whether that rate is one people
   * get hurt at.
   *
   * Two numbers because either alone misses a real case: a ratio can look calm while fitness is being
   * forced up ten points a week, and a ramp can look calm in a week that is far above the athlete's
   * base. Both are shown with the band they add up to.
   *
   * Presentational. Under the history floor the handler returns `null` numbers, and this renders the
   * reason instead of a reassuring 1.0 — that is the whole point of the floor.
   */
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import type { LoadRisk, LoadRiskBand, SportFitness } from './training.types';

  let { risk, perSport }: { risk: LoadRisk; perSport: readonly SportFitness[] } = $props();

  const BAND_LABEL: Record<LoadRiskBand, string> = {
    detraining: 'Roztrenowanie',
    steady: 'Stabilnie',
    building: 'Budowanie',
    overreaching: 'Przeciążenie',
    spike: 'Skok obciążenia'
  };

  const BAND_TONE: Record<LoadRiskBand, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
    detraining: 'info',
    steady: 'neutral',
    building: 'success',
    overreaching: 'warning',
    spike: 'danger'
  };

  const nf1 = new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
  const nf2 = new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const signed = (v: number): string => `${v > 0 ? '+' : ''}${nf1.format(v)}`;

  const known = $derived(risk.acwr !== null);
</script>

<Card
  title="Tempo narastania obciążenia"
  subtitle="Nie „gdzie jestem”, a „w którą stronę i jak szybko” — to stąd biorą się kontuzje przeciążeniowe"
>
  {#snippet actions()}
    {#if known}<Badge tone={BAND_TONE[risk.band]}>{BAND_LABEL[risk.band]}</Badge>{/if}
  {/snippet}

  {#if !known}
    <p class="unknown">{risk.advice}</p>
    <p class="meta">Mamy {risk.historyDays} dni ciągłej historii.</p>
  {:else}
    <div class="numbers">
      <div class="item">
        <span class="label">Ostatni tydzień vs baza</span>
        <p class="value">{nf2.format(risk.acwr!)}</p>
        <p class="hint">
          Obciążenie 7-dniowe podzielone przez 42-dniowe. Zakres 0,80–1,30 to obszar, w którym można
          bezpiecznie budować.
        </p>
      </div>
      {#if risk.rampRatePerWeek !== null}
        <div class="item">
          <span class="label">Przyrost formy</span>
          <p class="value">{signed(risk.rampRatePerWeek)}<span class="unit">CTL/tyg.</span></p>
          <p class="hint">
            Liczone z dwóch tygodni, żeby jeden mocny weekend nie udawał trendu. Powyżej +7 forma jest raczej
            wymuszana niż budowana.
          </p>
        </div>
      {/if}
    </div>

    <p class="advice">{risk.advice}</p>
    <p class="meta">
      Wskaźnik ostry/chroniczny to obserwacja populacyjna, nie prawo — traktuj go jako powód, by się
      przyjrzeć, nie jako wyrok. Liczony z {risk.historyDays} dni historii.
    </p>
  {/if}

  {#if perSport.length > 1}
    <div class="per-sport">
      <h4 class="per-sport-title">Forma w poszczególnych sportach</h4>
      <p class="hint">
        Wspólne CTL potrafi ukryć to, co najważniejsze: formę biegową spadającą, gdy rowerowa rośnie.
      </p>
      <ul class="sports">
        {#each perSport as s (s.group)}
          <li class="sport" style="--lane: {s.color}">
            <span class="sport-name">{s.label}</span>
            <span class="sport-nums">
              <span class="sport-num"><small>forma</small>{nf1.format(s.ctl)}</span>
              <span class="sport-num"><small>świeżość</small>{signed(s.tsb)}</span>
              {#if s.risk.acwr !== null}
                <span class="sport-num"><small>tydz./baza</small>{nf2.format(s.risk.acwr)}</span>
              {/if}
            </span>
            {#if s.risk.acwr !== null && s.risk.band !== 'steady' && s.risk.band !== 'building'}
              <Badge tone={BAND_TONE[s.risk.band]}>{BAND_LABEL[s.risk.band]}</Badge>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</Card>

<style>
  .numbers {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-5);
  }

  .item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
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

  .unit {
    margin-left: 0.35ch;
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--color-text-muted);
  }

  .hint,
  .meta {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    max-width: 72ch;
  }

  .meta {
    color: var(--color-text-subtle);
  }

  .advice {
    margin: var(--space-4) 0 var(--space-2);
    font-size: var(--text-sm);
    line-height: var(--leading-snug);
    color: var(--color-text);
    max-width: 78ch;
  }

  .unknown {
    margin: 0 0 var(--space-2);
    font-size: var(--text-sm);
    line-height: var(--leading-snug);
    color: var(--color-text-muted);
    max-width: 78ch;
  }

  .per-sport {
    margin-top: var(--space-6);
    padding-top: var(--space-5);
    border-top: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .per-sport-title {
    margin: 0;
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
  }

  .sports {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .sport {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
    padding: var(--space-2) var(--space-3);
    border-left: 3px solid var(--lane);
    border-radius: var(--radius-sm);
    background: var(--color-surface-2);
  }

  .sport-name {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-text);
    min-width: 6rem;
  }

  .sport-nums {
    display: flex;
    gap: var(--space-4);
    flex-wrap: wrap;
    margin-right: auto;
  }

  .sport-num {
    display: flex;
    flex-direction: column;
    font-size: var(--text-sm);
    font-weight: var(--font-bold);
    color: var(--color-text);
    font-feature-settings: var(--numeric);
  }

  .sport-num small {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    color: var(--color-text-muted);
  }
</style>
