/**
 * Contracts for the subjective journal (spec 062) — shared by the API handler, the MCP tools and the UI.
 */
import type { JournalEntry, SorenessSignal } from '$lib/server/store/types';

export type { JournalEntry, SorenessSignal } from '$lib/server/store/types';

/** Scores are 1–10 throughout: RPE is a 1–10 measure, and two scales in one form is how a 7 lands on the wrong one. */
export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

/** How sore is sore enough to act on. The coach's cut-the-volume threshold. */
export const SORENESS_ALERT = 4;

/** An entry after validation. Only the keys the caller sent are present. */
export interface JournalInput {
  readonly day: string;
  readonly activityId: string | null;
  readonly rpe?: number | null;
  readonly soreness?: number | null;
  readonly location?: string | null;
  readonly mood?: number | null;
  readonly note?: string | null;
  readonly illness?: boolean;
  readonly injury?: boolean;
}

/** What `/api/journal` answers over a range. */
export interface JournalData {
  readonly today: string;
  readonly from: string;
  readonly to: string;
  readonly entries: readonly JournalEntry[];
  /** The soreness worth acting on in this range, or null. */
  readonly soreness: SorenessSignal | null;
}

/** The handler result shape the season and block modules established: never throw for a user mistake. */
export type HandlerResult<T> = ({ ok: true } & T) | { ok: false; status: number; error: string };
