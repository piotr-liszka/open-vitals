/**
 * "Kiedy będę na 100%" (spec 084) — pure, no I/O, no `Date.now()`.
 *
 * The start page was asked two questions and only ever answered one. This module answers the second,
 * and it is deliberately two-layered, because **"the recovery timer hit zero" is not "I am ready"**:
 * on 2026-08-12 the timer reached zero (`recoveryTimeFactorPercent: 99`,
 * `recoveryTimeChangePhrase: "REACHED_ZERO"`) and Garmin still scored 74, because the weekly HRV
 * average was already out of band. A card that had answered "ready at 04:42" that morning would have
 * been confidently wrong.
 *
 * So each limit reports its own clearance with its own confidence, and the honest answer for the whole
 * athlete is the LAST of them — never sooner, and null when any one of them is `unknown`. "We don't
 * know" must not render as "today".
 */
import { addDays, dayKeyOf, DEFAULT_TIME_ZONE, type DayKey } from '$lib/date';
import type {
  HrvStatus,
  DayPoint,
  ReadinessConfidence,
  ReadinessForecast,
  ReadinessLimit
} from './insights.types';

/**
 * Backstop on the roll-forward loop.
 *
 * Not normally reachable: the projection only runs when the assumed nightly value is at or above the
 * floor, and after `hrvWindowNights` rolls the window contains nothing but that value — so a clearance
 * always lands within the window length (7 days today). This guards a pathological config where the
 * window is longer than the horizon, and keeps the loop provably terminating.
 */
export const MAX_PROJECTION_DAYS = 14;
/** Nights the assumed future value is taken from. Three smooths a single outlier without lagging. */
export const ASSUMPTION_NIGHTS = 3;

export interface ForecastInputs {
  /** The limits the score found, still without their clearances. */
  limits: readonly ReadinessLimit[];
  hrv: HrvStatus | null;
  /** Nightly `lastNightAvg`, oldest→newest. */
  hrvNights?: readonly DayPoint[] | undefined;
  hrvWindowNights: number;
  today: DayKey | null;
  nowMs: number | null;
  /** Epoch ms the recovery timer reaches zero (`RecoveryTime.endsAt`, spec 075). */
  recoveryEndsAt: number | null;
  recoverySuperseded: boolean;
  /** Zone the instant→day conversion resolves in (spec 018). */
  timeZone?: string;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function presentValues(days: readonly DayPoint[] | undefined): number[] {
  if (!days) return [];
  return days.filter((d): d is { date: string; value: number } => d.value !== null).map((d) => d.value);
}

/**
 * The day the 7-night HRV average is expected back inside the balanced band.
 *
 * `weeklyAvg` is a rolling mean of nightly `lastNightAvg`, and we hold every night, so this is a
 * simulation rather than a curve fit: roll the window forward one night at a time, assume each future
 * night equals the median of the last three, and report the first day the mean reaches `balancedLow`.
 * On 17.08 the window mean was 99 against a floor of 102 with the latest night at 113 — the bad nights
 * of 14–16.08 rolling out of the window is what clears it, which a projection can see and a reader
 * cannot.
 *
 * Returns null (→ `unknown`) rather than a date when the assumption itself cannot get there: if the
 * median of the last three nights is below the floor, no amount of rolling reaches it, and answering
 * "in 12 days" would be arithmetic dressed up as a forecast.
 */
export function projectHrvClearance(inputs: ForecastInputs): { day: DayKey; assumedNightly: number } | null {
  const { hrv, today, hrvWindowNights } = inputs;
  if (hrv === null || today === null) return null;
  const floor = hrv.balancedLow;
  if (floor === null) return null;

  const nights = presentValues(inputs.hrvNights);
  if (nights.length < ASSUMPTION_NIGHTS) return null;

  const assumed = median(nights.slice(-ASSUMPTION_NIGHTS));
  if (assumed === null || assumed < floor) return null;

  const window = nights.slice(-hrvWindowNights);
  if (window.length === 0) return null;

  for (let d = 1; d <= MAX_PROJECTION_DAYS; d++) {
    window.shift();
    window.push(assumed);
    if (mean(window) >= floor) return { day: addDays(today, d), assumedNightly: Math.round(assumed) };
  }
  return null;
}

/**
 * Fill each limit's clearance in, then take the latest.
 *
 * The recovery limit is `exact` — it is a derived instant, not an estimate. HRV is `projected` under
 * the stated assumption. Load is `unknown` in this spec: "when does ACWR clear" is computable from
 * spec 079's load series, but that is a second projection and was left out deliberately.
 */
export function computeForecast(inputs: ForecastInputs): ReadinessForecast {
  const zone = inputs.timeZone ?? DEFAULT_TIME_ZONE;
  const recoveredAt =
    inputs.recoverySuperseded || inputs.recoveryEndsAt === null || !Number.isFinite(inputs.recoveryEndsAt)
      ? null
      : inputs.recoveryEndsAt;

  const hrvClearance = projectHrvClearance(inputs);

  const limits: ReadinessLimit[] = inputs.limits.map((limit) => {
    if (limit.key === 'recovery') {
      const confidence: ReadinessConfidence = recoveredAt === null ? 'unknown' : 'exact';
      return {
        ...limit,
        clearsAt: recoveredAt,
        clearsOn: recoveredAt === null ? null : dayKeyOf(new Date(recoveredAt), zone),
        confidence
      };
    }
    if (limit.key === 'hrv') {
      return {
        ...limit,
        clearsAt: null,
        clearsOn: hrvClearance?.day ?? null,
        confidence: hrvClearance === null ? 'unknown' : 'projected'
      };
    }
    return { ...limit, clearsAt: null, clearsOn: null, confidence: 'unknown' };
  });

  /*
   * Nothing capping the score means nothing to wait for — the answer is "today", not "we don't know".
   * One unknown limit poisons the whole answer, though: a date that silently ignores a limit we cannot
   * project would be the most misleading thing this card could say.
   */
  const anyUnknown = limits.some((l) => l.confidence === 'unknown');
  let fullyReadyAt: DayKey | null = null;
  if (!anyUnknown) {
    const days = limits.map((l) => l.clearsOn).filter((d): d is DayKey => d !== null);
    fullyReadyAt = days.length === 0 ? inputs.today : days.reduce((latest, d) => (d > latest ? d : latest));
  }

  return { recoveredAt, fullyReadyAt, limits };
}
