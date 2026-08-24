/**
 * Contracts for the training block (spec 073) — shared by the API handler, the MCP tools and the UI.
 */
import type {
  BlockPaces,
  PaceKey,
  SorenessSignal,
  TrainingBlock,
  TrainingBlockWeek
} from '$lib/server/store/types';

export type {
  BlockPaces,
  PaceKey,
  PaceRange,
  TrainingBlock,
  TrainingBlockWeek
} from '$lib/server/store/types';

/** Where today sits relative to a block's span. */
export type BlockPosition = 'before' | 'live' | 'done';

/** One session in the week: an authored workout (spec 050), flattened. */
export interface WeekSession {
  readonly id: string;
  readonly day: string;
  readonly time: string | null;
  readonly sport: string;
  readonly sportLabel: string;
  readonly title: string;
  readonly estimatedDistanceM: number | null;
  readonly estimatedDurationS: number | null;
  /** Whether it has reached the watch yet — the athlete's real question about a planned session. */
  readonly pushState: string;
  readonly note: string | null;
}

/** The goal a block builds towards, only the parts a week view needs. */
export interface WeekGoal {
  readonly id: string;
  readonly title: string;
  readonly day: string;
  readonly daysOut: number;
}

/**
 * One week of a block, resolved against a day. This is the payload `get_current_week` returns and
 * the card renders — plan and reality in one object, so nobody has to make a second call to find out
 * whether the week is going as written.
 */
export interface BlockWeek {
  readonly blockId: string;
  readonly blockName: string;
  readonly weekNumber: number;
  /** Total weeks in the block, so "week 7" can be read as "7 of 16". */
  readonly weeks: number;
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly position: BlockPosition;
  /** Days until the block starts; 0 once it has. */
  readonly startsInDays: number;
  readonly phase: string;
  readonly phaseLabel: string;
  /** True when the phase came from the goal countdown rather than a per-week override. */
  readonly phaseDerived: boolean;
  readonly volumeTargetKm: number | null;
  readonly volumeActualKm: number;
  readonly focus: string | null;
  readonly note: string | null;
  readonly sessions: readonly WeekSession[];
  readonly paces: BlockPaces;
  readonly constraints: readonly string[];
  readonly goal: WeekGoal | null;
  /**
   * Soreness worth acting on in the last seven days, or null (spec 062). It rides along in the week
   * payload rather than waiting to be asked for, because the whole point of logging it is that the
   * person reading the week sees it without knowing to look.
   */
  readonly soreness: SorenessSignal | null;
}

/** What `/api/block/current` answers. `week` is null when no block covers today. */
export interface CurrentWeekData {
  readonly today: string;
  readonly block: TrainingBlock | null;
  readonly week: BlockWeek | null;
}

/** A block in a list, with its span already worked out. */
export interface BlockSummary {
  readonly block: TrainingBlock;
  readonly endDay: string;
  readonly position: BlockPosition;
  /** Which week today falls in, or null when the block is not live. */
  readonly currentWeek: number | null;
  readonly weekTargets: readonly TrainingBlockWeek[];
}

/** Create input, after validation. */
export interface NewBlockInput {
  readonly name: string;
  readonly startDay: string;
  readonly weeks: number;
  readonly goalId: string | null;
  readonly paces: BlockPaces;
  readonly constraints: readonly string[];
  readonly note: string | null;
}

/** Patch input, after validation. Only keys present are applied. */
export interface BlockPatchInput {
  readonly name?: string;
  readonly startDay?: string;
  readonly weeks?: number;
  readonly goalId?: string | null;
  readonly paces?: BlockPaces;
  readonly constraints?: readonly string[];
  readonly note?: string | null;
  /** Per-week targets to upsert alongside the block fields. */
  readonly weekTargets?: readonly {
    readonly weekNumber: number;
    readonly phase?: string | null;
    readonly volumeTargetKm?: number | null;
    readonly focus?: string | null;
    readonly note?: string | null;
  }[];
}

/** The handler result shape the season module established: never throw for a user mistake. */
export type HandlerResult<T> = ({ ok: true } & T) | { ok: false; status: number; error: string };
