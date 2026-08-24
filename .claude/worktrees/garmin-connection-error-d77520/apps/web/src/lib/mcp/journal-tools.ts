/**
 * Subjective-journal tools (spec 062) — the only writes here that record something no device saw.
 *
 * Garmin does not know that a knee hurts. For an athlete with a history of knee and back trouble
 * that is the single most important signal in the plan, and until now there was none of it in the
 * system: an RPE of 9 on a threshold session written as RPE 7 is the sentence that gets volume cut
 * two weeks before it would otherwise become an injury.
 *
 * Writes go through the SAME validator the HTTP boundary uses, the rule specs 060 and 073 set.
 */
import { z } from 'zod';
import type { Clock } from '../server/clock';
import type { Random } from '../server/random';
import type { JournalEntry, LocalStore } from '../server/store/types';
import { loadJournal, logEntry, type JournalDeps } from '$modules/journal/journal.api';
import { SORENESS_ALERT } from '$modules/journal/journal.types';
import type { ToolResult } from './tools';

/** Everything the journal tools need. All injected (AGENTS.md §2 rule 4). */
export interface JournalToolDeps {
  store: LocalStore;
  /** The ONE user these tools may touch — resolved from the MCP token, never from an argument. */
  userId: string;
  clock: Clock;
  random: Random;
  timeZone?: string;
}

export interface JournalTool {
  name: string;
  description: string;
  inputShape: z.ZodRawShape;
  handler(deps: JournalToolDeps, args: Record<string, unknown>): Promise<ToolResult>;
}

function text(value: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }]
  };
}

function errorText(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

const api = (deps: JournalToolDeps): JournalDeps => ({
  store: deps.store,
  clock: deps.clock,
  random: deps.random,
  ...(deps.timeZone ? { timeZone: deps.timeZone } : {})
});

const scoreArg = z.number().int().min(1).max(10);

/** An entry flattened for a model: nulls dropped, so an empty field reads as absent rather than as zero. */
function view(entry: JournalEntry): Record<string, unknown> {
  return {
    id: entry.id,
    day: entry.day,
    scope: entry.activityId ? 'session' : 'day',
    ...(entry.activityId ? { activityId: entry.activityId } : {}),
    ...(entry.rpe !== null ? { rpe: entry.rpe } : {}),
    ...(entry.soreness !== null ? { soreness: entry.soreness } : {}),
    ...(entry.location !== null ? { location: entry.location } : {}),
    ...(entry.mood !== null ? { mood: entry.mood } : {}),
    ...(entry.note !== null ? { note: entry.note } : {}),
    ...(entry.illness ? { illness: true } : {}),
    ...(entry.injury ? { injury: true } : {})
  };
}

const logNoteTool: JournalTool = {
  name: 'log_note',
  description:
    'Record how the athlete FELT — the data no watch produces. `rpe` (1–10) describes ONE SESSION, ' +
    'so pass `activityId` with it; `soreness` (1–10), `mood`, `location` ("lewe kolano") and `note` ' +
    'describe the DAY, so leave `activityId` out. Both kinds of entry can exist for the same day. ' +
    'Logging the same day again CORRECTS it: fields you pass are written, fields you omit keep ' +
    'their stored value, and an explicit null clears one. Back-filling past days is fine; future ' +
    'days are refused. Scores outside 1–10 are rejected rather than rounded.',
  inputShape: {
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
    rpe: scoreArg.nullish().describe('Perceived exertion of ONE session, 1–10. Needs activityId.'),
    soreness: scoreArg.nullish().describe('How sore the athlete is that day, 1–10.'),
    location: z.string().max(120).nullish().describe('Where it hurts, in their words'),
    mood: scoreArg.nullish(),
    note: z.string().max(1000).nullish(),
    illness: z.boolean().nullish(),
    injury: z.boolean().nullish(),
    activityId: z.string().max(120).nullish().describe('The session an RPE belongs to')
  },
  async handler(deps, args) {
    // Only keys the caller actually sent reach the validator — `undefined` spread into the body
    // would be indistinguishable from an explicit null clear.
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args)) if (value !== undefined) body[key] = value;

    const result = await logEntry(api(deps), deps.userId, body);
    if (!result.ok) return errorText(result.error);
    return text({
      written: view(result.entry),
      fieldsTouched: result.fields,
      note: 'Fields not listed in fieldsTouched keep whatever they already held.'
    });
  }
};

const getNotesTool: JournalTool = {
  name: 'get_notes',
  description:
    'What the athlete reported over a span: per-day soreness, mood, notes, illness/injury flags, and ' +
    'per-session RPE. Read this alongside the training data before judging a session — an easy run ' +
    'that felt like RPE 8 and a threshold session that felt like RPE 5 are both worth more than ' +
    'their heart-rate averages. `soreness` in the reply is the worst recent score at or above ' +
    `${SORENESS_ALERT}, the level at which cutting volume is the conservative call.`,
  inputShape: {
    start: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullish(),
    end: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullish()
  },
  async handler(deps, args) {
    const range: { from?: string; to?: string } = {};
    if (args.start != null) range.from = String(args.start);
    if (args.end != null) range.to = String(args.end);

    const data = await loadJournal(api(deps), deps.userId, range);
    if (data.entries.length === 0) {
      return text({
        from: data.from,
        to: data.to,
        count: 0,
        message: 'Nothing logged in this range. Say so rather than inferring how they felt.'
      });
    }
    return text({
      from: data.from,
      to: data.to,
      count: data.entries.length,
      entries: data.entries.map(view),
      ...(data.soreness ? { soreness: data.soreness } : {})
    });
  }
};

export const JOURNAL_TOOLS: readonly JournalTool[] = [logNoteTool, getNotesTool];
