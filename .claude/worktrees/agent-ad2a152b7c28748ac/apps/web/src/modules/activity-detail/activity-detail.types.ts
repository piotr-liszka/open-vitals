/** Contracts for the single-activity detail view (PWRX §2). Shared by the API handler and the UI. */
import type { ActivityLap, ActivityStreams } from '$lib/server/store/types';
import type { DurationPower, ZoneBucket } from '$lib/server/analytics/activity-power';
import type { ActivityStats } from '$lib/server/analytics/activity-stats';
import type {
  ActivityVerdict,
  AlignmentConfidence,
  PlanIntensitySource,
  PlanStepAlignment,
  PlanTakeaway,
  PlannedOrigin,
  PlannedStepActual,
  PlannedStepComparison,
  PlannedStepKey,
  PlannedStructureStep,
  PlannedWorkoutComparison,
  PlannedWorkoutStatus,
  TrainingComparison
} from './activity-comparison';
import type { ActivityHighlight, SuspectValue } from './activity-highlights';
import type { Decoupling } from '$lib/analytics/efficiency';
import type { BestEffort } from '$lib/analytics/best-efforts';
import type { Pacing } from '$lib/analytics/pacing';
import type { Climb } from '$lib/analytics/climbs';
import type { SimilarActivities } from './similar-activities';

export type { ActivityLap, ActivityStats, ActivityStreams };
export type {
  ActivityVerdict,
  AlignmentConfidence,
  PlanIntensitySource,
  PlanStepAlignment,
  PlanTakeaway,
  PlannedOrigin,
  PlannedStepActual,
  PlannedStepComparison,
  PlannedStepKey,
  PlannedStructureStep,
  PlannedWorkoutComparison,
  PlannedWorkoutStatus,
  TrainingComparison
};
export type { ActivityHighlight, SuspectValue };
export type { Decoupling };
export type { BestEffort };
export type { Pacing, PacingShape } from '$lib/analytics/pacing';
export type { Climb } from '$lib/analytics/climbs';
export type { SimilarActivities, SimilarEntry, SimilarDelta } from './similar-activities';

/** One earlier outing on the same route, for the comparison table (spec 041). */
export interface MatchedRouteEntry {
  readonly activityId: string;
  /** Local day `YYYY-MM-DD`. */
  readonly day: string;
  readonly name: string | null;
  readonly distanceM: number | null;
  /** Moving time where the watch reports it. */
  readonly durationS: number | null;
  readonly avgHr: number | null;
  readonly paceSecPerKm: number | null;
  /** Cell-set overlap with this activity's track, 0–1 — how confident the match is. */
  readonly similarity: number;
  /** 1 = the fastest outing on this route among those matched, this one included. */
  readonly rank: number;
  /** True for the activity being viewed. */
  readonly isCurrent: boolean;
}

/**
 * "You have run this route N times" (spec 041). `null` when the activity has no usable GPS, or when no
 * earlier outing matched — a route done once is not a route worth comparing.
 */
export interface MatchedRoute {
  /** Outings on this route including the current one, fastest first. */
  readonly entries: readonly MatchedRouteEntry[];
  /** This activity's placing among them; `null` when it has no comparable pace. */
  readonly currentRank: number | null;
  /** How many earlier outings matched. */
  readonly previousCount: number;
  /** Fastest pace ever recorded on the route, for the "vs best" line. */
  readonly bestPaceSecPerKm: number | null;
  /** Candidate tracks actually compared, so the page can say how wide the search was. */
  readonly comparedCount: number;
}

/**
 * Aerobic efficiency for this session (spec 038). Every leaf is `null` when its inputs are missing —
 * a session with no heart-rate strap gets the block with nothing in it rather than no block, so the
 * page can explain the absence.
 */
export interface EfficiencyBlock {
  /** Pace-per-heartbeat drift between the halves; `null` for a session too short to judge. */
  readonly decoupling: Decoupling | null;
  /** Metres per minute per bpm. */
  readonly ef: number | null;
  /** Watts per bpm — present only with a power meter. */
  readonly powerEf: number | null;
  /** Heartbeats per kilometre. */
  readonly cardiacCost: number | null;
}

/** Display projection of the stored `ActivitySummary`. */
export interface ActivityDetailSummary {
  readonly id: string;
  readonly sport: string;
  readonly name: string | null;
  readonly startTime: string;
  readonly startTimeLocal: string;
  readonly distanceM: number | null;
  readonly durationS: number | null;
  readonly movingS: number | null;
  readonly elevationGainM: number | null;
  readonly avgHr: number | null;
  readonly maxHr: number | null;
  readonly avgPower: number | null;
  readonly maxPower: number | null;
  readonly normPower: number | null;
  readonly calories: number | null;
  readonly trainingLoad: number | null;
  readonly hasGps: boolean;
}

/** Computed power block; present only when a power stream exists. */
export interface PowerBlock {
  readonly avg: number | null;
  readonly max: number | null;
  readonly np: number | null;
  /** Intensity Factor — `null` when FTP is unknown. */
  readonly if: number | null;
  /** Training Stress Score — `null` when FTP is unknown. */
  readonly tss: number | null;
  readonly kj: number | null;
  readonly curve: DurationPower[];
  /** Coggan power zones — empty when FTP is unknown. */
  readonly zones: ZoneBucket[];
}

/** Computed heart-rate block; present only when an HR stream exists. */
export interface HrBlock {
  readonly avg: number | null;
  readonly max: number | null;
  readonly zones: ZoneBucket[];
}

export interface ActivityDetailData {
  readonly activity: ActivityDetailSummary;
  /**
   * The rich Garmin stats (calories, respiration, training effect, stamina, running dynamics, …),
   * projected out of the stored raw payload + laps (spec 023). Groups are always present; every leaf
   * is optional — render "--" for an absent one rather than hiding the row.
   */
  readonly stats: ActivityStats;
  /** Device laps; empty when the activity has none. */
  readonly laps: readonly ActivityLap[];
  /** Garmin's classified splits (run/walk/stand, interval work/rest); empty when absent. */
  readonly typedSplits: readonly ActivityLap[];
  /**
   * Every numeric stream stored for this activity, for charts. Absent streams are simply missing.
   * `gps` and the lap arrays are NOT repeated here — they have their own top-level fields.
   */
  readonly streams: ActivityStreams;
  /** Full-resolution route for the interactive map; `null` when no GPS is stored. */
  readonly gps: NonNullable<ActivityStreams['gps']> | null;
  /**
   * "How good was this session?" — this activity's stress against the athlete's own recent norm,
   * fitness and form (spec 026). `null` only when the activity has no usable local day.
   * `trainingComparison.plannedWorkout` stays `null` until Garmin's workout calendar is synced.
   */
  readonly trainingComparison: TrainingComparison | null;
  /**
   * The matched plan's own step sequence, repeat blocks expanded (spec 085) — what the Przebieg
   * strip draws against the recorded streams. `null` — never an empty array — when no plan matched
   * or when the matched plan is a bare calendar entry with no steps: an absent strip and an empty
   * one say different things, and only the first one is true here.
   */
  readonly plannedStructure: readonly PlannedStructureStep[] | null;
  /**
   * Where this session stands against the athlete's own EARLIER sessions of the same family — a
   * record, or "the best since <month>" (spec 036). Empty when there is too little comparable
   * history to rank anything honestly.
   */
  readonly highlights: readonly ActivityHighlight[];
  /**
   * Numbers that look like sensor or GPS artefacts rather than results (spec 036), each with a plain
   * reason. Computed from this activity alone, so it is populated even with no history at all.
   */
  readonly suspects: readonly SuspectValue[];
  /**
   * Aerobic efficiency: decoupling, efficiency factor and cardiac cost (spec 038). Always present;
   * its leaves are `null` where the session lacks the streams to compute them.
   */
  readonly efficiency: EfficiencyBlock;
  /**
   * Fastest window for each standard distance the session contained (spec 040) — a 5 km best hidden
   * inside a long run. Empty when there is no distance stream, or when the session was too short to
   * contain even the shortest target.
   */
  readonly bestEfforts: readonly BestEffort[];
  /**
   * The SHAPE of the effort (spec 045) — split balance and variability — which an average pace hides.
   * `null` for a session too short to judge or with no distance axis.
   */
  readonly pacing: Pacing | null;
  /**
   * Climbs found along the route, in the order they were climbed (spec 046). Total elevation gain answers
   * "how hilly was it"; this answers "what did I climb", which is a different question. Empty without an
   * elevation and distance axis, or when nothing cleared the gain and gradient floors.
   */
  readonly climbs: readonly Climb[];
  /**
   * Earlier outings on the same route and where this one placed (spec 041). `null` when the activity has
   * no usable GPS or when nothing matched.
   */
  readonly matchedRoute: MatchedRoute | null;
  /**
   * Sessions at a comparable distance and duration (spec 065) — the other half of "what should I
   * compare this to", and the half that still works without a GPS track. `null` when the activity has
   * no distance/duration axis at all, which is a different statement from an empty `entries`.
   */
  readonly similarActivities: SimilarActivities | null;
  /** FTP used for the power maths (from settings, or estimated from the 20-min best). */
  readonly ftp: number | null;
  /** True when `ftp` was estimated from the curve rather than read from settings. */
  readonly ftpEstimated: boolean;
  readonly weightKg: number | null;
  readonly power: PowerBlock | null;
  readonly hr: HrBlock | null;
  /** Placeholder deep-link (feature not wired yet); the UI keeps it hidden. */
  readonly stravaUrl: string | null;
}
