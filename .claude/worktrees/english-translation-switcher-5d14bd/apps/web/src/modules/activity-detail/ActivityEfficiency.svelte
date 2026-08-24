<script lang="ts">
  /**
   * Aerobic efficiency (spec 038): did this session hold together, and is the engine improving?
   *
   * Three numbers that are useless without their sentence, so each one carries it. Decoupling in
   * particular is a number people misread — it is meaningless for intervals and it punishes a long
   * warm-up — so the card says what it measures rather than leaving a bare percentage to be
   * over-interpreted.
   *
   * Presentational: the handler computed everything. Nothing here renders when the session carried no
   * heart rate at all, because all three numbers are HR-relative.
   */
  import Card from '$lib/ui/Card.svelte';
  import Badge from '$lib/ui/Badge.svelte';
  import { fmtPace } from './activity-format';
  import { COUPLED_LIMIT_PCT } from '$lib/analytics/efficiency';
  import type { EfficiencyBlock, Pacing, PacingShape } from './activity-detail.types';

  let { efficiency, pacing }: { efficiency: EfficiencyBlock; pacing: Pacing | null } = $props();

  /** What each pace shape means. Variability is checked first, so an interval session is never "faded". */
  const SHAPE: Record<PacingShape, { label: string; tone: 'success' | 'info' | 'warning'; text: string }> = {
    even: {
      label: 'Równo',
      tone: 'success',
      text: 'Obie połowy w podobnym tempie, bez dużych wahań. Tak wygląda dobrze rozłożona jednostka ciągła.'
    },
    'negative-split': {
      label: 'Negative split',
      tone: 'success',
      text: 'Druga połowa szybsza od pierwszej. To rozkład, o który walczy się na zawodach — start pod kontrolą, finisz mocniej.'
    },
    faded: {
      label: 'Odpadnięcie',
      tone: 'warning',
      text: 'Druga połowa wyraźnie wolniejsza. Klasyczny zbyt szybki start — albo dystans jeszcze poza zasięgiem obecnej formy.'
    },
    variable: {
      label: 'Zmienne tempo',
      tone: 'info',
      text: 'Duży rozrzut tempa między fragmentami. Tak wygląda trening interwałowy albo bardzo pofałdowana trasa — bilans połówek nic tu nie znaczy.'
    }
  };

  const d = $derived(efficiency.decoupling);
  const has = $derived(
    d !== null ||
      pacing !== null ||
      efficiency.ef !== null ||
      efficiency.powerEf !== null ||
      efficiency.cardiacCost !== null
  );

  const nf = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
  const nf2 = new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const signed = (v: number): string => `${v > 0 ? '+' : ''}${nf1.format(v)}`;

  /** What a decoupling figure actually means, in the direction it points. */
  const verdict = $derived.by(() => {
    if (!d) return null;
    if (d.coupled) {
      return {
        tone: 'success' as const,
        label: 'Spięty',
        text: `Tempo na uderzenie serca utrzymało się w drugiej połowie (do ${COUPLED_LIMIT_PCT}% uznajemy za stabilne). Tak wygląda dobrze rozłożony wysiłek tlenowy.`
      };
    }
    if (d.pct > 0) {
      return {
        tone: 'warning' as const,
        label: 'Rozjechany',
        text: 'Druga połowa kosztowała więcej uderzeń na ten sam efekt. Typowe przyczyny: zbyt szybki start, upał, za mało paliwa albo dystans jeszcze poza zasięgiem formy tlenowej.'
      };
    }
    return {
      tone: 'info' as const,
      label: 'Przyspieszony',
      text: 'Druga połowa była tańsza niż pierwsza — zwykle znaczy to bardzo spokojny start albo długą rozgrzewkę wliczoną w zapis.'
    };
  });
</script>

{#if has}
  <Card
    title="Wydolność tlenowa"
    subtitle="Ile kosztowało jedno uderzenie serca — i czy ten koszt rósł w trakcie"
  >
    <div class="grid">
      {#if d && verdict}
        <div class="item wide">
          <div class="head">
            <span class="label">Rozejście tętna i {d.basis === 'power' ? 'mocy' : 'tempa'}</span>
            <Badge tone={verdict.tone}>{verdict.label}</Badge>
          </div>
          <p class="value">{signed(d.pct)}<span class="unit">%</span></p>
          <p class="text">{verdict.text}</p>
          <p class="meta">
            Druga połowa vs pierwsza, po {nf.format(d.samples)} próbek na połowę. Liczone z całego zapisu — dla
            treningu interwałowego ta liczba nie ma sensu.
          </p>
        </div>
      {/if}

      {#if pacing}
        <div class="item wide">
          <div class="head">
            <span class="label">Rozkład tempa</span>
            <Badge tone={SHAPE[pacing.shape].tone}>{SHAPE[pacing.shape].label}</Badge>
          </div>
          <p class="value">
            {signed(pacing.splitPct)}<span class="unit">% druga połowa</span>
          </p>
          <p class="text">{SHAPE[pacing.shape].text}</p>
          <p class="meta">
            Połowy dzielone po DYSTANSIE, nie po czasie — inaczej odpadnięcie byłoby zaniżone.
            {fmtPace(pacing.firstHalfPaceSecPerKm)} vs {fmtPace(pacing.secondHalfPaceSecPerKm)} min/km. Rozrzut
            tempa między {nf.format(pacing.chunks)} fragmentami: {nf1.format(pacing.variabilityPct)}%.
          </p>
        </div>
      {/if}

      {#if efficiency.ef !== null}
        <div class="item">
          <span class="label">Współczynnik wydolności</span>
          <p class="value">{nf2.format(efficiency.ef)}</p>
          <p class="text">
            Metrów na minutę na jedno uderzenie. Rośnie, gdy to samo tempo kosztuje mniej — to sygnał formy
            tlenowej, niezależny od tego, jak mocno się starało.
          </p>
        </div>
      {/if}

      {#if efficiency.powerEf !== null}
        <div class="item">
          <span class="label">Wydolność na mocy</span>
          <p class="value">{nf2.format(efficiency.powerEf)}<span class="unit">W/bpm</span></p>
          <p class="text">Watów na uderzenie serca — rowerowy odpowiednik powyższego.</p>
        </div>
      {/if}

      {#if efficiency.cardiacCost !== null}
        <div class="item">
          <span class="label">Koszt sercowy</span>
          <p class="value">{nf.format(efficiency.cardiacCost)}<span class="unit">ud./km</span></p>
          <p class="text">
            Tyle uderzeń serca kosztował jeden kilometr. Mniej na tej samej trasie = lepsza forma.
          </p>
        </div>
      {/if}
    </div>
  </Card>
{/if}

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-5);
  }

  /* The decoupling verdict carries a badge and two lines of explanation, so it gets the wide slot. */
  .wide {
    grid-column: 1 / -1;
  }

  .item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
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

  .text {
    margin: 0;
    font-size: var(--text-sm);
    line-height: var(--leading-snug);
    color: var(--color-text);
    max-width: 68ch;
  }

  .meta {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-subtle);
    max-width: 68ch;
  }
</style>
