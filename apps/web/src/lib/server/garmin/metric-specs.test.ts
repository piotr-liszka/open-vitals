/**
 * `hasMetricValue` (spec 072) — the one definition of "this day holds a reading", shared by the sync
 * engine's counter, the store's coverage aggregate and the freshness signal.
 *
 * It exists because `data != null` answers a different question. On 2026-08-16 Garmin returned a
 * present daily-summary object for two days it had nothing for, every field inside it null, and the
 * whole app read that as data: the run logged "106 dni z danymi", /dane claimed the history was
 * complete, and the start page showed a Thursday readiness score as Saturday's.
 */
import { describe, it, expect } from 'vitest';
import { hasMetricValue } from './metric-specs';

/** The real shape, trimmed: Garmin's answer for a day the watch never uploaded. */
const HOLLOW_SUMMARY = {
  calendarDate: '2026-08-16',
  totalSteps: null,
  restingHeartRate: null,
  averageSpo2: null,
  totalKilocalories: null,
  includesWellnessData: false,
  lastSyncTimestampGMT: null,
  privacyProtected: false,
  netRemainingKilocalories: 0
};

describe('hasMetricValue', () => {
  it('rejects a present-but-hollow daily summary', () => {
    expect(hasMetricValue('steps', HOLLOW_SUMMARY)).toBe(false);
    expect(hasMetricValue('resting_heart_rate', HOLLOW_SUMMARY)).toBe(false);
    expect(hasMetricValue('spo2', HOLLOW_SUMMARY)).toBe(false);
  });

  it('accepts a real reading, including a legitimate zero', () => {
    expect(hasMetricValue('steps', { totalSteps: 9000 })).toBe(true);
    // A rest day of literally zero steps is DATA. Truthiness checks get this wrong; `pick` does not.
    expect(hasMetricValue('steps', { totalSteps: 0 })).toBe(true);
  });

  it('treats a missing or null payload as absent', () => {
    expect(hasMetricValue('hrv', null)).toBe(false);
    expect(hasMetricValue('hrv', undefined)).toBe(false);
    expect(hasMetricValue('hrv', {})).toBe(false);
  });

  it('reads through the sidecar envelope the store keeps verbatim', () => {
    expect(hasMetricValue('hrv', { metric: 'hrv', date: '2026-08-14', data: null })).toBe(false);
    expect(
      hasMetricValue('hrv', {
        metric: 'hrv',
        date: '2026-08-14',
        data: { hrvSummary: { lastNightAvg: 88 } }
      })
    ).toBe(true);
  });

  it('judges each metric by its own field, not by the payload being non-empty', () => {
    // The same daily summary is the source for steps AND spo2; a day can carry one and not the other.
    const stepsOnly = { totalSteps: 12_000, averageSpo2: null };
    expect(hasMetricValue('steps', stepsOnly)).toBe(true);
    expect(hasMetricValue('spo2', stepsOnly)).toBe(false);
  });

  it('recognises Garmin readiness and Body Battery, whose payloads are not flat scalars', () => {
    expect(hasMetricValue('training_readiness', { score: 1, level: 'POOR' })).toBe(true);
    expect(hasMetricValue('training_readiness', { level: 'POOR' })).toBe(false);
    expect(hasMetricValue('body_battery', { bodyBatteryValuesArray: [[0, 'MEASURED', 73]] })).toBe(true);
    expect(hasMetricValue('body_battery', { bodyBatteryValuesArray: [] })).toBe(false);
  });

  it('does not declare an unrecognised metric empty on the strength of not knowing it', () => {
    // No spec for `activities`; absence of evidence is not evidence of absence.
    expect(hasMetricValue('activities', [{ activityId: 1 }])).toBe(true);
    expect(hasMetricValue('activities', null)).toBe(false);
  });
});
