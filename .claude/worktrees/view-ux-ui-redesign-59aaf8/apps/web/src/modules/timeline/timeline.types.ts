/**
 * Contracts for the start-page timeline slice (spec 022).
 *
 * The timeline is ONE stream of *events* — not a calendar grid. Backwards it merges what actually
 * happened (activities, notable health signals, milestones); forwards it carries what is planned.
 *
 * The event model is a DISCRIMINATED UNION on `kind`, deliberately not a bag of optional fields:
 * adding a new kind is one interface plus one union member, and every consumer that switches on
 * `kind` fails to compile until it handles the new case.
 *
 * Shared by `timeline.api.ts`, `timeline.events.ts`, `TimelineView.svelte` and its subcomponents.
 */
import type { DayKey } from '$lib/date';
import type { SportGroup } from '$lib/sport-labels';
import type { IconName } from '$lib/ui/icons';
import type { Lane } from '$modules/metrics-dashboard/dashboard.types';

export type { DayKey };

/** A pre-formatted micro readout under an event ("18,4 km", "5:12 /km"). Formatting is the API's job. */
export interface TimelineStat {
  readonly label: string;
  /** Already localised and rounded — the UI never does maths. */
  readonly value: string;
  readonly unit?: string;
}

export type TimelineEventKind = 'activity' | 'health' | 'milestone';

/** Fields every event kind carries, whatever it is. */
interface TimelineEventBase {
  /** Stable within one feed; usable as an `{#each}` key. */
  readonly id: string;
  readonly kind: TimelineEventKind;
  /** Calendar day the event belongs to (already the wearer's local day). */
  readonly day: DayKey;
  /** Local wall-clock `HH:MM`, or null for whole-day events (most health signals). */
  readonly time: string | null;
  readonly title: string;
  /** One supporting line in Polish, or null. */
  readonly detail: string | null;
  readonly stats: readonly TimelineStat[];
  readonly icon: IconName;
  readonly accent: Lane;
  /**
   * 0–100 attention score. Ranks the stream so a routine walk cannot crowd out an HRV crash;
   * the *order* on screen stays chronological.
   */
  readonly importance: number;
  /** True when this event survives the collapsed cap (the top-`limit` by importance). */
  readonly primary: boolean;
  /** In-app destination, or null when the event has no detail page. */
  readonly href: string | null;
}

export interface TimelineActivityEvent extends TimelineEventBase {
  readonly kind: 'activity';
  readonly activityId: string;
  /** Garmin `activityType.typeKey`. */
  readonly sport: string;
  readonly group: SportGroup;
  readonly distanceM: number | null;
  readonly durationS: number | null;
}

/** What a health event actually says, so the UI can pick copy and an icon without re-deriving it. */
export type HealthSignalKind =
  | 'poor_sleep'
  | 'long_sleep'
  | 'elevated_rhr'
  | 'low_rhr'
  | 'hrv_drop'
  | 'hrv_rise'
  | 'high_stress'
  | 'low_stress'
  | 'body_battery_crash'
  | 'body_battery_peak'
  | 'metric_outlier';

export type HealthSeverity = 'moderate' | 'strong';
export type HealthDirection = 'up' | 'down';

export interface TimelineHealthEvent extends TimelineEventBase {
  readonly kind: 'health';
  /** Metric key the signal came from (`hrv`, `sleep`, …). */
  readonly metric: string;
  readonly signal: HealthSignalKind;
  readonly severity: HealthSeverity;
  readonly direction: HealthDirection;
  readonly value: number;
  /** Signed z of the reading against its in-window baseline. */
  readonly z: number;
  /** True when the move is the healthy direction (a *good* outlier still deserves a note). */
  readonly favourable: boolean;
}

export type MilestoneKind = 'longest_distance' | 'longest_duration' | 'new_sport' | 'streak';

export interface TimelineMilestoneEvent extends TimelineEventBase {
  readonly kind: 'milestone';
  readonly milestone: MilestoneKind;
  readonly activityId: string | null;
}

export type TimelineEvent = TimelineActivityEvent | TimelineHealthEvent | TimelineMilestoneEvent;

/**
 * A notable health reading fed into the timeline. Structurally the subset of the insights engine's
 * `Anomaly` that the timeline needs — declared here so this slice does NOT import another module's
 * types (AGENTS.md §5); `Anomaly` satisfies it by shape.
 */
export interface HealthSignalInput {
  readonly key: string;
  readonly label: string;
  readonly accent: Lane;
  /** `YYYY-MM-DD`. */
  readonly date: string;
  readonly value: number;
  readonly z: number;
  readonly direction: HealthDirection;
  readonly severity: HealthSeverity;
}

/* ------------------------------------------------------------------ *
 * Forward half — planned workouts
 * ------------------------------------------------------------------ */

export type PlannedEventKind = 'workout' | 'race' | 'note';

/**
 * Where a planned item came from. Values mirror the store's `DataSource` so a synced row maps
 * across 1:1; a second provider adds a member, never a field.
 */
export type PlannedSource = 'garmin' | 'strava' | 'withings';

/**
 * A scheduled future item. **Nothing produces these yet** — the sidecar has no
 * `/workout-service/` or `/calendar-service/` call, so `PlannedFeed.status` is `not_synced` and
 * `events` is empty in production. This contract is what the sidecar work must fill; see spec 022
 * §"Planned workouts — the data gap" for the exact endpoint + store shape.
 */
export interface PlannedEvent {
  readonly id: string;
  readonly day: DayKey;
  /** Local `HH:MM` when the plan pins a time, else null. */
  readonly time: string | null;
  readonly kind: PlannedEventKind;
  readonly title: string;
  /** Garmin `typeKey`, so `sportLabel()` renders it like every other sport. */
  readonly sport: string | null;
  readonly description: string | null;
  readonly estimatedDurationS: number | null;
  readonly estimatedDistanceM: number | null;
  /** Planned training load / TSS target, when the plan carries one. */
  readonly targetLoad: number | null;
  readonly source: PlannedSource;
  /**
   * True when the athlete AUTHORED this session here (spec 050) rather than it coming from Garmin's
   * calendar. Only these rows can carry a `push` state.
   */
  readonly authored?: boolean;
  /**
   * How far an authored session has got towards the watch (spec 050): `pending` = saved here only,
   * `pushed` = in the Garmin calendar, `failed` = the last push failed (the next sync retries),
   * `unsupported` = Garmin will not take it. Absent for plans that came FROM Garmin — they are on the
   * watch by definition, and a badge saying otherwise would be a lie.
   */
  readonly push?: 'pending' | 'pushed' | 'failed' | 'unsupported';
}

/**
 * Why the forward half looks the way it does:
 * - `not_synced` — no planned-workout source is wired, or the upstream calendar could not be read
 *   at all (today's honest state: nothing in this repo fetches Garmin's calendar yet).
 * - `empty` — we DID read the calendar and the user simply has nothing scheduled.
 * - `ok` — real plans.
 * The UI renders three different, truthful messages; it never invents a plan.
 */
export type PlannedStatus = 'not_synced' | 'empty' | 'ok';

export interface PlannedFeed {
  readonly from: DayKey;
  readonly to: DayKey;
  readonly status: PlannedStatus;
  readonly events: readonly PlannedEvent[];
}

/* ------------------------------------------------------------------ *
 * Slice payload
 * ------------------------------------------------------------------ */

export interface TimelinePast {
  readonly from: DayKey;
  readonly to: DayKey;
  /** Newest first. Everything in the window; `primary` marks the collapsed selection. */
  readonly events: readonly TimelineEvent[];
  readonly primaryCount: number;
  readonly totalCount: number;
}

export interface TimelineData {
  readonly today: DayKey;
  readonly past: TimelinePast;
  readonly planned: PlannedFeed;
}

/* ------------------------------------------------------------------ *
 * View preference (spec 032)
 * ------------------------------------------------------------------ */

/**
 * How the same stream is drawn: `vertical` is spec 022's rail (newest first, best for reading
 * detail), `horizontal` is a scrollable time axis running oldest → `dziś` → planned (best for seeing
 * span and shape). A device-level view preference, so it lives in `localStorage`, not the URL and
 * not the DB — see `lib/ui/pref.ts`.
 */
export type TimelineOrientation = 'vertical' | 'horizontal';

export const TIMELINE_ORIENTATIONS: readonly TimelineOrientation[] = ['vertical', 'horizontal'];

export const TIMELINE_ORIENTATION_KEY = 'gb-timeline-orientation';

/**
 * Whether the stream shows every event or only the primary ones ("Pokaż wszystkie zdarzenia").
 * Same class of choice as the orientation — how this device likes to read the card — so it is
 * remembered the same way (spec 049).
 */
export const TIMELINE_EXPANDED_KEY = 'gb-timeline-expanded';
