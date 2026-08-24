/**
 * Planner contracts (spec 066) — the boundary shared by the UI and the API handler.
 *
 * `WorkoutStep` deliberately is NOT redefined here. It comes from `$lib/workouts`, which spec 050 put
 * outside `$lib/server` for exactly this reason ("any future builder UI"). A second definition of what
 * a valid workout is would be the one thing this slice must not create.
 */
import type { WorkoutStep } from '$lib/workouts';
import type { WorkoutPushState } from '$lib/server/store/types';

export type { WorkoutStep, WorkoutPushState };

/** An authored session as the planner draws it — the store row minus the ids nothing renders. */
export interface AuthoredWorkoutView {
  readonly id: string;
  /** Local `YYYY-MM-DD`. */
  readonly day: string;
  /** Local `HH:MM`, or null for "sometime that day". */
  readonly time: string | null;
  readonly sport: string;
  readonly title: string;
  readonly steps: readonly WorkoutStep[];
  readonly note: string | null;
  readonly pushState: WorkoutPushState;
  /** Short, secret-free reason for the last failed push. */
  readonly pushError: string | null;
  /** Whether this session has reached Garmin — what the delete confirmation needs to know. */
  readonly onGarmin: boolean;
  /** Estimated seconds, from the step tree; null when no step carries a time or distance. */
  readonly estimatedDurationS: number | null;
  readonly estimatedDistanceM: number | null;
}

/**
 * A session Garmin already knew about (spec 024). Drawn beside the authored ones and marked apart,
 * because only an authored session can be edited and only an authored one has a push state — showing
 * them identically would promise an edit button that cannot exist.
 */
export interface PlannedEventView {
  readonly id: string;
  readonly day: string;
  readonly kind: 'workout' | 'race' | 'note';
  readonly title: string;
  /** Garmin `typeKey`, or null for a plan that names no sport. */
  readonly sport: string | null;
  readonly description: string | null;
  readonly estimatedDurationS: number | null;
  readonly estimatedDistanceM: number | null;
}

/** Everything the planner draws for one visible grid. */
export interface PlannerData {
  readonly workouts: readonly AuthoredWorkoutView[];
  readonly planned: readonly PlannedEventView[];
  /**
   * Whether the athlete has accepted the `workout_write` terms (spec 050). False = the page is
   * read-only and says why, rather than offering buttons that 403.
   */
  readonly canWrite: boolean;
  /** The library (spec 069) — the drag source for the calendar, and CRUD in its own right. */
  readonly templates: readonly WorkoutTemplateView[];
}

/**
 * A reusable session in the library (spec 069) — a workout with the date removed. That absence is the
 * whole difference: this is a session you HAVE, an `AuthoredWorkoutView` is one you have committed to
 * on a day.
 */
export interface WorkoutTemplateView {
  readonly id: string;
  readonly sport: string;
  readonly title: string;
  readonly steps: readonly WorkoutStep[];
  readonly note: string | null;
  readonly estimatedDurationS: number | null;
  readonly estimatedDistanceM: number | null;
}

/** What the library editor submits. Same as `WorkoutDraft` minus the two date fields. */
export interface WorkoutTemplateDraft {
  readonly sport: string;
  readonly title: string;
  readonly steps: readonly WorkoutStep[];
  readonly note: string | null;
}

/** What the editor submits. Validated server-side by `normalizeWorkout` — never trusted from here. */
export interface WorkoutDraft {
  readonly day: string;
  readonly time: string | null;
  readonly sport: string;
  readonly title: string;
  readonly steps: readonly WorkoutStep[];
  readonly note: string | null;
}
