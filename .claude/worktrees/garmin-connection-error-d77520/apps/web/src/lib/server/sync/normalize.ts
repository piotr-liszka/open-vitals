/**
 * Normalize a raw Garmin activity-summary dict (as returned by the sidecar) into our typed
 * `ActivitySummary`. Field names are best-effort: we probe candidate keys in order and degrade to
 * null so a shape drift yields a gap, never a thrown sync. The full raw dict is retained in `raw`.
 */
import type { GarminActivityDetails } from '../interfaces';
import { STREAMS_SCHEMA_VERSION, type ActivityStreams, type ActivitySummary } from '../store/types';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function num(o: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

function int(o: Record<string, unknown>, keys: string[]): number | null {
  const n = num(o, keys);
  return n === null ? null : Math.round(n);
}

function str(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

/** garmy nests the sport under `activityType.typeKey` (a couple of shapes seen in the wild). */
function sportOf(o: Record<string, unknown>): string {
  const at = asRecord(o['activityType']) ?? asRecord(o['activityTypeDTO']);
  const key = at ? str(at, ['typeKey']) : null;
  return key ?? str(o, ['activityType', 'sportTypeKey']) ?? 'other';
}

/** Garmin timestamps are `"YYYY-MM-DD HH:MM:SS"`. Turn the GMT one into an ISO instant. */
function toIso(gmt: string | null, local: string | null): string {
  const src = gmt ?? local;
  if (!src) return new Date(0).toISOString();
  const iso = src.includes('T') ? src : src.replace(' ', 'T');
  const withZone = gmt ? (iso.endsWith('Z') ? iso : `${iso}Z`) : iso;
  const d = new Date(withZone);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

export function normalizeActivity(userId: string, raw: unknown): ActivitySummary | null {
  const o = asRecord(raw);
  if (!o) return null;
  const idRaw = o['activityId'] ?? o['activityIdStr'];
  const activityId = idRaw === undefined || idRaw === null ? null : String(idRaw);
  if (!activityId) return null;

  const startTimeLocal = str(o, ['startTimeLocal']) ?? str(o, ['startTimeGMT']) ?? '1970-01-01 00:00:00';
  const startTimeGmt = str(o, ['startTimeGMT']);

  return {
    userId,
    activityId,
    sport: sportOf(o),
    name: str(o, ['activityName', 'name']),
    startTime: toIso(startTimeGmt, startTimeLocal),
    startTimeLocal,
    distanceM: num(o, ['distance', 'distanceInMeters']),
    durationS: num(o, ['duration', 'elapsedDuration', 'movingDuration']),
    movingS: num(o, ['movingDuration', 'duration']),
    elevationGainM: num(o, ['elevationGain', 'totalElevationGain']),
    avgHr: int(o, ['averageHR', 'avgHr']),
    maxHr: int(o, ['maxHR', 'maxHr']),
    avgPower: int(o, ['avgPower', 'averagePower', 'avgBikingPower']),
    maxPower: int(o, ['maxPower', 'maxBikingPower']),
    normPower: int(o, ['normPower', 'normalizedPower']),
    calories: int(o, ['calories', 'activeKilocalories']),
    trainingLoad: num(o, ['activityTrainingLoad', 'trainingLoad']),
    hasGps: o['hasPolyline'] === true || o['hasGps'] === true,
    raw
  };
}

/** Stream fields copied 1:1 from the sidecar details response into the stored blob. */
const STREAM_FIELDS = [
  'gps',
  'time',
  'heartRate',
  'power',
  'cadence',
  'fractionalCadence',
  'speed',
  'elevation',
  'grade',
  'temperature',
  'respirationRate',
  'verticalRatio',
  'verticalOscillation',
  'groundContactTime',
  'groundContactBalance',
  'strideLength',
  'stamina',
  'staminaPotential',
  'performanceCondition',
  'movingDuration',
  'moving',
  'laps',
  'typedSplits'
] as const satisfies ReadonlyArray<keyof ActivityStreams & keyof GarminActivityDetails>;

/**
 * Project a sidecar details response onto the stored `ActivityStreams` blob, stamping the current
 * schema version so a later contract change can invalidate and re-fetch this row.
 *
 * Copying by an EXPLICIT field list (rather than spreading) is what makes the sidecar↔store contract
 * checkable: a stream the sidecar starts sending is only stored once it is named here and in
 * `ActivityStreams`, and a renamed one shows up as a failing test instead of silently vanishing —
 * which is exactly how the HR stream was lost before spec 023.
 */
export function streamsFromDetails(d: GarminActivityDetails): ActivityStreams {
  const streams: Record<string, unknown> = { v: STREAMS_SCHEMA_VERSION };
  for (const field of STREAM_FIELDS) {
    const value = d[field];
    if (Array.isArray(value) && value.length > 0) streams[field] = value;
  }
  return streams as ActivityStreams;
}
