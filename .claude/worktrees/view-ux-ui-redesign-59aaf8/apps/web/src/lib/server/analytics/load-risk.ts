/**
 * How fast the athlete is loading up, and whether that rate is safe (spec 039). PURE compute over an
 * already-built PMC series — no store, no clock, no Garmin.
 *
 * The training page has CTL, ATL and TSB. Those say where the athlete IS. Two derived numbers say
 * where they are HEADED, which is the part injuries come from:
 *
 * 1. **Acute:chronic workload ratio** — this week's load against the last six weeks'. Above roughly
 *    1.3 the athlete is doing markedly more than they are trained for; below 0.8 they are detraining.
 *    Between the two is the band the literature calls the sweet spot. We reuse the PMC's own ATL/CTL
 *    (7-day and 42-day EWMAs) rather than a second pair of rolling sums, so this cannot disagree with
 *    the chart above it.
 * 2. **Ramp rate** — how many CTL points per week fitness is climbing. A ratio can look calm while
 *    fitness is being forced up 10 points a week, which is a different mistake with the same ending.
 *
 * ## Honesty
 *
 * Both numbers are meaningless on a short or sparse history: with three weeks of data CTL has not
 * converged, and dividing by it produces alarming ratios out of nothing. `null` is therefore returned
 * — not a reassuring 1.0 — until `MIN_HISTORY_DAYS` of series exist.
 *
 * ACWR is also a POPULATION finding, not a personal law. The band is a prompt to look, not a verdict,
 * and the label strings say so.
 */
import type { DailyLoadPoint } from './training-load';

/** Series length below which CTL has not converged and neither number may be reported. */
export const MIN_HISTORY_DAYS = 28;
/** Below this the athlete is doing less than they are trained for. */
export const ACWR_LOW = 0.8;
/** Above this the acute load is running clear of the chronic base. */
export const ACWR_HIGH = 1.3;
/** Well above `ACWR_HIGH` — the range the literature associates with the sharpest risk rise. */
export const ACWR_VERY_HIGH = 1.5;
/** CTL points per week beyond which fitness is being forced rather than built. */
export const RAMP_HIGH = 7;
/** Losing more than this per week is detraining, not tapering. */
export const RAMP_LOW = -7;

export type LoadRiskBand = 'detraining' | 'steady' | 'building' | 'overreaching' | 'spike';

export interface LoadRisk {
  /** ATL ÷ CTL on the last day of the series. `null` on too little history. */
  readonly acwr: number | null;
  /** CTL points gained per week, measured over the trailing `RAMP_WINDOW_DAYS`. `null` as above. */
  readonly rampRatePerWeek: number | null;
  readonly band: LoadRiskBand;
  /** Polish sentence naming what to do about it. */
  readonly advice: string;
  /** Days of series behind the numbers, so a view can say how much to trust them. */
  readonly historyDays: number;
}

/** Days the ramp rate is measured over — two weeks smooths a single big weekend out. */
export const RAMP_WINDOW_DAYS = 14;

const ADVICE: Record<LoadRiskBand, string> = {
  detraining:
    'Obciążenie spadło wyraźnie poniżej tego, do czego jesteś przygotowany. Jeśli to nie zaplanowane roztrenowanie ani choroba, wróć do regularnych jednostek — forma tlenowa cofa się szybciej, niż narasta.',
  steady:
    'Obciążenie ostatniego tygodnia mieści się w tym, do czego jesteś przygotowany. To zakres, w którym można bezpiecznie budować.',
  building:
    'Budujesz formę w rozsądnym tempie — obciążenie rośnie, ale nie ucieka bazie. Utrzymaj ten kierunek i pilnuj tygodni odciążających.',
  overreaching:
    'Ostatni tydzień jest wyraźnie mocniejszy od Twojej bazy. Jeden taki tydzień to normalny bodziec; dwa lub trzy pod rząd to najczęstsza droga do kontuzji przeciążeniowej.',
  spike:
    'Skok obciążenia: ostatni tydzień znacznie przewyższa to, do czego jesteś przygotowany. Najbezpieczniejszy ruch to lżejszy tydzień, zanim wróci normalny plan.'
};

/**
 * Classify the pair. The RATIO decides the band, and the ramp rate can only make it worse — a calm
 * ratio with fitness climbing 10 points a week is still being forced, which is the case a ratio alone
 * misses.
 */
export function bandFor(acwr: number, rampPerWeek: number): LoadRiskBand {
  if (acwr >= ACWR_VERY_HIGH) return 'spike';
  if (acwr > ACWR_HIGH) return 'overreaching';
  if (acwr < ACWR_LOW) return rampPerWeek <= RAMP_LOW ? 'detraining' : 'steady';
  // Inside the band: the ramp rate is what separates "building" from "forcing".
  if (rampPerWeek > RAMP_HIGH) return 'overreaching';
  if (rampPerWeek <= RAMP_LOW) return 'detraining';
  return rampPerWeek > 0 ? 'building' : 'steady';
}

/**
 * Load risk from a PMC series. Expects the series `buildTrainingLoad` produces (oldest first, one
 * entry per day including rest days) — the per-day continuity is what makes the ramp window a real
 * fortnight rather than a fortnight of recorded sessions.
 */
export function loadRisk(series: readonly DailyLoadPoint[]): LoadRisk {
  const historyDays = series.length;
  const last = series[historyDays - 1];

  if (!last || historyDays < MIN_HISTORY_DAYS || last.ctl <= 0) {
    return {
      acwr: null,
      rampRatePerWeek: null,
      band: 'steady',
      advice:
        'Za mało historii, aby ocenić tempo narastania obciążenia. Potrzebne są około cztery tygodnie ciągłych danych — wcześniej wskaźniki liczone z niepełnej bazy tylko straszą.',
      historyDays
    };
  }

  const acwr = round2(last.atl / last.ctl);

  // Ramp measured against the CTL of `RAMP_WINDOW_DAYS` ago, then normalised to a week. The window is
  // clamped to the series, and the ACTUAL span is what the rate is divided by — a shorter history
  // gives a rate over what exists rather than one deflated by days that were never there.
  const backIndex = Math.max(0, historyDays - 1 - RAMP_WINDOW_DAYS);
  const back = series[backIndex];
  const spanDays = historyDays - 1 - backIndex;
  const rampRatePerWeek = back && spanDays > 0 ? round1(((last.ctl - back.ctl) / spanDays) * 7) : null;

  const band = bandFor(acwr, rampRatePerWeek ?? 0);
  return { acwr, rampRatePerWeek, band, advice: ADVICE[band], historyDays };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
