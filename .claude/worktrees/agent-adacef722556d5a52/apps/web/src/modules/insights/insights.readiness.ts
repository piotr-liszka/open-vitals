/**
 * Readiness as an ABSOLUTE question (spec 084) — pure, no I/O, no `Date`, no random.
 *
 * WHAT CHANGED AND WHY. Until this spec the score was a *deviation index*: four channels, each
 * z-scored against its own last 30 days, composited by weighted mean. That answers "how do I compare
 * with my own recent normal". The question the start page is actually asked is "how ready am I to
 * train today, and when will I be at 100%" — and for that a rolling personal norm is not merely
 * unhelpful, it is misleading, because a month of training moves the norm instead of the score. Spec
 * 070 documented the blind spot and patched its worst instance with a recovery-time ceiling; this
 * module removes the cause.
 *
 * THE EVIDENCE, from the store's own 11–17.08.2026:
 *
 *   - 17.08: ours 52 `moderate`, Garmin 39 `LOW` / `LOW_HRV_UNBALANCED`. `hrvSummary` carried
 *     `lastNightAvg: 113`, `weeklyAvg: 99`, band `102…133`. We read last night (good) against our own
 *     30-day mean → z +0.20 → "fine". Garmin read the week (99) against the band → below it → 57%.
 *     Same underlying HRV, opposite verdicts, purely because of which variable and which window.
 *   - 14.08: Garmin's factors were 68 / 71 / 73 / 19 / 36 / 60 and Garmin answered **1**. Their
 *     arithmetic mean is 54.5, their weighted geometric mean 49.3. No smooth combination of those six
 *     numbers reaches 1 — averaging is simply the wrong operator. One crushing input pins the score.
 *   - 12.08: the recovery timer reached zero (`recoveryTimeFactorPercent: 99`) and Garmin still said
 *     74, because HRV was already out of band. Hence `insights.forecast.ts`: "recovered" ≠ "ready".
 *
 * SO: six absolute channels — the same six Garmin publishes, so the card's two numbers are finally
 * built from the same inputs — composited by weighted mean, then capped by every active ceiling.
 *
 * EXPLICIT NON-GOAL: this does not try to equal Garmin's number. Garmin's score is not a function of
 * its own published factors (min-factor 64 → 74 on 12.08; min-factor 63 → 50 on 13.08), so fitting it
 * would produce a number nobody can explain and that breaks whenever Garmin retunes. The goal is the
 * same inputs, the same drivers, and a number that can be read line by line — never the residual.
 */
import type { MessageKey } from '$lib/i18n';
import type { DayKey } from '$lib/date';
import type { Lane } from '$modules/metrics-dashboard/dashboard.types';
import { factorPercent, isHrvUnbalanced, type ParsedTrainingReadiness } from './insights.garmin-readiness';
import { computeForecast, type ForecastInputs } from './insights.forecast';
import type {
  DayPoint,
  HrvStatus,
  Readiness,
  ReadinessBand,
  ReadinessDriver,
  ReadinessLimit
} from './insights.types';

/* ------------------------------------------------------------------ *
 * Configuration
 * ------------------------------------------------------------------ */

export interface ReadinessChannelConfig {
  /** Stable key, matching Garmin's factor keys so the two line up channel for channel. */
  key: string;
  labelKey: MessageKey;
  accent: Lane;
  weight: number;
}

/**
 * The six channels in reading order, with their weights in the composite.
 *
 * Sleep and recovery carry the most because they are the two the athlete can act on tonight; the two
 * "history" channels carry least because they are slow-moving context rather than today's state. The
 * weights only shape the composite — they cannot rescue a channel that becomes a ceiling, which is the
 * whole point of the limiting rule below.
 */
export const READINESS_CHANNELS: readonly ReadinessChannelConfig[] = [
  { key: 'sleep', labelKey: 'garminReadiness.factor.sleep', accent: 'indigo', weight: 0.25 },
  { key: 'recovery', labelKey: 'garminReadiness.factor.recovery', accent: 'cyan', weight: 0.25 },
  { key: 'hrv', labelKey: 'garminReadiness.factor.hrv', accent: 'green', weight: 0.2 },
  { key: 'load', labelKey: 'garminReadiness.factor.load', accent: 'orange', weight: 0.15 },
  { key: 'sleep_history', labelKey: 'garminReadiness.factor.sleep_history', accent: 'violet', weight: 0.1 },
  { key: 'stress', labelKey: 'garminReadiness.factor.stress', accent: 'amber', weight: 0.05 }
];

export interface ReadinessConfig {
  channels: readonly ReadinessChannelConfig[];
  /**
   * Hours on the recovery timer at which the recovery channel reads 0. Unchanged from spec 070: 72 h
   * is a little past the ~4-day maximum a Garmin device will put on the clock, so a real timer never
   * quite pins the channel to zero — being maximally fatigued is not the same as being dead.
   */
  recoveryCeilingHours: number;
  /** Fewest channels a score may be built from. Below this, readiness is null rather than a guess. */
  minChannels: number;
  /** Nights in Garmin's HRV weekly average — the window the projection rolls forward. */
  hrvWindowNights: number;
}

export const DEFAULT_READINESS_CONFIG: ReadinessConfig = {
  channels: READINESS_CHANNELS,
  recoveryCeilingHours: 72,
  minChannels: 2,
  hrvWindowNights: 7
};

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

/** A percent we are willing to use: finite and inside 0–100. Out-of-range is rejected, not clamped. */
function usablePercent(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return value < 0 || value > 100 ? null : value;
}

export function bandFor(score: number): ReadinessBand {
  if (score < 40) return 'low';
  if (score < 60) return 'moderate';
  if (score < 80) return 'high';
  return 'peak';
}

/**
 * The recovery channel: 100 at a spent timer, falling linearly to 0 at `recoveryCeilingHours`.
 *
 * Unchanged maths from spec 070, but it is now BOTH a channel and a ceiling, and it is always fed the
 * LIVE remaining minutes rather than Garmin's `recoveryTimeFactorPercent`. That factor is frozen at
 * Garmin's capture instant while the real timer drains all day — spec 075 exists because a frozen
 * countdown is a wrong countdown, and reading the frozen factor here would reintroduce exactly that.
 *
 * Sanity check against Garmin's own factor for the same timers: 1297 min → 70 here, 65 there;
 * 968 → 78 / 74; 3672 → 15 / 19. Close enough to be the same claim, and ours keeps ticking.
 */
export function recoveryChannel(minutes: number, config: ReadinessConfig): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 100;
  const span = config.recoveryCeilingHours;
  if (!Number.isFinite(span) || span <= 0) return 100;
  return clamp(100 * (1 - minutes / 60 / span), 0, 100);
}

/**
 * Where the weekly average sits in the balanced band, as 0–100.
 *
 * Below the band the score falls away steeply — one band-width under `balancedLow` reads 0 — because
 * "below your balanced range" is the signal Garmin turns into `UNBALANCED`, and a gentle slope there
 * would reproduce the very dilution this spec removes. Inside the band it spans 55–100: being in range
 * is good, and being at the top of it is better.
 */
export function hrvChannelFromBand(hrv: HrvStatus): number | null {
  const { weeklyAvg, balancedLow, balancedUpper } = hrv;
  if (weeklyAvg === null || balancedLow === null || balancedUpper === null) return null;
  const width = balancedUpper - balancedLow;
  if (width <= 0) return null;
  if (weeklyAvg >= balancedLow) {
    const into = Math.min(1, (weeklyAvg - balancedLow) / width);
    return clamp(55 + 45 * into, 0, 100);
  }
  const under = Math.min(1, (balancedLow - weeklyAvg) / width);
  return clamp(55 * (1 - under), 0, 100);
}

/* ------------------------------------------------------------------ *
 * Channels
 * ------------------------------------------------------------------ */

/** Everything the score is built from. Every field optional — the score degrades, it does not throw. */
export interface ReadinessInputs {
  /** Garmin's parsed Training Readiness for the newest day it scored. */
  garmin?: ParsedTrainingReadiness | null;
  /** Garmin's HRV status and balanced band for the newest day carrying one. */
  hrv?: HrvStatus | null;
  /** LIVE minutes left on the recovery timer (spec 075), not the figure frozen at capture. */
  recoveryMinutes?: number | null;
  /** Nightly `lastNightAvg`, oldest→newest — the HRV fallback and the forecast's roll-forward. */
  hrvNights?: readonly DayPoint[] | undefined;
  /** Nightly Garmin sleep scores, oldest→newest — the sleep and sleep-history fallbacks. */
  sleepScores?: readonly DayPoint[] | undefined;
  /** Daily average stress, oldest→newest — the stress-history fallback. */
  stressDays?: readonly DayPoint[] | undefined;
  /** The user's local today (spec 018), for the forecast's day arithmetic. */
  today?: DayKey | null;
  /** "Now" from the injected clock, for the forecast's instants. */
  nowMs?: number | null;
  /** Whether a later activity has already invalidated the recovery reading (spec 075). */
  recoverySuperseded?: boolean;
  /** Epoch ms the recovery timer reaches zero (`RecoveryTime.endsAt`). */
  recoveryEndsAt?: number | null;
}

interface BuiltChannel {
  config: ReadinessChannelConfig;
  percent: number;
  source: ReadinessDriver['source'];
  detail: string | null;
}

/** Mean of the trailing `n` present values, or null when there are none. */
function trailingMean(days: readonly DayPoint[] | undefined, n: number): number | null {
  if (!days || days.length === 0) return null;
  const present = days.filter((d): d is { date: string; value: number } => d.value !== null);
  if (present.length === 0) return null;
  return mean(present.slice(-n).map((p) => p.value));
}

/**
 * Each channel, preferring Garmin's own factor and falling back to raw payloads.
 *
 * The fallbacks exist so the score survives a day or an account with no Training Readiness — which was
 * the original reason for having a score of our own at all. A channel with neither source is DROPPED,
 * and the composite renormalises over what is left, rather than a missing input silently scoring 0.
 */
export function buildChannels(inputs: ReadinessInputs, config: ReadinessConfig): BuiltChannel[] {
  const garmin = inputs.garmin ?? null;
  const hrv = inputs.hrv ?? null;
  const out: BuiltChannel[] = [];

  for (const channel of config.channels) {
    let percent: number | null = null;
    let source: ReadinessDriver['source'] = 'garmin';
    let detail: string | null = null;

    if (channel.key === 'recovery') {
      /*
       * Always ours, never Garmin's factor — see `recoveryChannel`. A null timer means the account has
       * no Training Readiness at all, in which case there is nothing to say about recovery and the
       * channel drops rather than defaulting to "fully recovered".
       */
      const minutes = inputs.recoveryMinutes ?? null;
      if (minutes !== null && Number.isFinite(minutes)) {
        percent = recoveryChannel(minutes, config);
        source = 'derived';
      }
    } else if (channel.key === 'hrv') {
      percent = usablePercent(factorPercent(garmin, 'hrv'));
      if (percent === null && hrv !== null) {
        percent = hrvChannelFromBand(hrv);
        source = 'derived';
      }
      if (hrv?.weeklyAvg !== null && hrv?.weeklyAvg !== undefined) {
        detail =
          hrv.balancedLow !== null && hrv.balancedUpper !== null
            ? `${Math.round(hrv.weeklyAvg)} ms · ${Math.round(hrv.balancedLow)}–${Math.round(hrv.balancedUpper)}`
            : `${Math.round(hrv.weeklyAvg)} ms`;
      }
    } else if (channel.key === 'sleep') {
      percent = usablePercent(factorPercent(garmin, 'sleep'));
      if (percent === null) {
        percent = usablePercent(trailingMean(inputs.sleepScores, 1));
        source = 'derived';
      }
    } else if (channel.key === 'sleep_history') {
      percent = usablePercent(factorPercent(garmin, 'sleep_history'));
      if (percent === null) {
        percent = usablePercent(trailingMean(inputs.sleepScores, 7));
        source = 'derived';
      }
    } else if (channel.key === 'stress') {
      percent = usablePercent(factorPercent(garmin, 'stress'));
      if (percent === null) {
        // Garmin's stress metric is 0–100 where LOW is good, so the channel is its complement.
        const stress = trailingMean(inputs.stressDays, 7);
        percent = stress === null ? null : usablePercent(100 - clamp(stress, 0, 100));
        source = 'derived';
      }
    } else if (channel.key === 'load') {
      percent = usablePercent(factorPercent(garmin, 'load'));
      // No fallback in this spec: ACWR needs the 7-vs-28-day load ratio from spec 079's load series,
      // which this pure module is not handed. The channel simply drops. See the spec's follow-ups.
    }

    if (percent === null) continue;
    out.push({ config: channel, percent: Math.round(percent), source, detail });
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Ceilings
 * ------------------------------------------------------------------ */

/**
 * Every limit that caps the composite (spec 084), strongest first.
 *
 * A limit is NOT simply "a low channel" — it is an input whose own state says *do not train hard
 * today* regardless of how the rest looks: a running recovery timer, a weekly HRV average outside the
 * balanced band, an acute:chronic load ratio Garmin itself calls `POOR`. That distinction is what
 * keeps a good night's sleep from averaging away a 61-hour recovery debt.
 */
export function buildLimits(channels: readonly BuiltChannel[], inputs: ReadinessInputs): ReadinessLimit[] {
  const limits: ReadinessLimit[] = [];
  const byKey = new Map(channels.map((c) => [c.config.key, c]));

  const minutes = inputs.recoveryMinutes ?? null;
  const recovery = byKey.get('recovery');
  if (recovery && minutes !== null && minutes > 0) {
    limits.push({
      key: 'recovery',
      labelKey: 'readiness.limit.recovery',
      ceiling: recovery.percent,
      minutes: Math.round(minutes),
      detail: null,
      clearsAt: null,
      clearsOn: null,
      confidence: 'unknown'
    });
  }

  const hrvChannel = byKey.get('hrv');
  if (hrvChannel && isHrvUnbalanced(inputs.hrv ?? null)) {
    limits.push({
      key: 'hrv',
      labelKey: 'readiness.limit.hrv',
      ceiling: hrvChannel.percent,
      detail: hrvChannel.detail,
      clearsAt: null,
      clearsOn: null,
      confidence: 'unknown'
    });
  }

  /*
   * Load caps only on Garmin's own `POOR` verdict, not on `MODERATE`. On 14.08 the ACWR factor was 36
   * with `acwrFactorFeedback: "POOR"` and it belonged in the ceiling; on 17.08 it was 61 `MODERATE`,
   * where an athlete mid-block normally sits and where capping would make the score permanently
   * pessimistic. The feedback word is Garmin's judgement of its own number and is better than a
   * threshold we invent.
   */
  const load = byKey.get('load');
  if (load && (inputs.garmin?.loadFeedback ?? null) === 'poor') {
    limits.push({
      key: 'load',
      labelKey: 'readiness.limit.load',
      ceiling: load.percent,
      detail: null,
      clearsAt: null,
      clearsOn: null,
      confidence: 'unknown'
    });
  }

  return limits.sort((a, b) => a.ceiling - b.ceiling);
}

/* ------------------------------------------------------------------ *
 * Top level
 * ------------------------------------------------------------------ */

export function computeReadiness(
  inputs: ReadinessInputs = {},
  config: ReadinessConfig = DEFAULT_READINESS_CONFIG
): Readiness | null {
  const channels = buildChannels(inputs, config);
  if (channels.length < config.minChannels) return null;

  const totalWeight = channels.reduce((sum, c) => sum + c.config.weight, 0);
  if (totalWeight <= 0) return null;

  const composite = Math.round(
    channels.reduce((sum, c) => sum + c.percent * c.config.weight, 0) / totalWeight
  );

  const drivers: ReadinessDriver[] = channels.map((c) => ({
    key: c.config.key,
    labelKey: c.config.labelKey,
    accent: c.config.accent,
    percent: c.percent,
    source: c.source,
    detail: c.detail,
    contribution: Math.round(c.percent * (c.config.weight / totalWeight))
  }));

  const rawLimits = buildLimits(channels, inputs);
  // The forecast decides WHEN each limit clears; the score decides WHETHER it bit. Both read the same
  // objects, so the card can never show a ceiling with no clearance or a clearance with no ceiling.
  const forecastInputs: ForecastInputs = {
    limits: rawLimits,
    hrv: inputs.hrv ?? null,
    hrvNights: inputs.hrvNights,
    hrvWindowNights: config.hrvWindowNights,
    today: inputs.today ?? null,
    nowMs: inputs.nowMs ?? null,
    recoveryEndsAt: inputs.recoveryEndsAt ?? null,
    recoverySuperseded: inputs.recoverySuperseded ?? false
  };
  const forecast = computeForecast(forecastInputs);

  /*
   * A ceiling only ever lowers the score (spec 070's rule, now general): a spent recovery timer does
   * not certify a bad night's sleep as readiness.
   *
   * `limitedBy` is the subset that actually bit — what explains today's NUMBER. `forecast.limits` keeps
   * ALL of them, because they explain today's DATE, and those are different questions: a 21-hour timer
   * that does not cap a composite of 67 still means the athlete is not at 100% until tomorrow morning.
   */
  const biting = forecast.limits.filter((l) => l.ceiling < composite);
  const score = biting.reduce((lowest, l) => Math.min(lowest, l.ceiling), composite);

  return { score, band: bandFor(score), composite, drivers, limitedBy: biting, forecast };
}
