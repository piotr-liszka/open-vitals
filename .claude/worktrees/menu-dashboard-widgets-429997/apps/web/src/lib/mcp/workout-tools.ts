/**
 * Workout AUTHORING tools (spec 050) — the write half of the MCP surface, kept in its own module
 * because it depends on things the read tools do not: the local store, an id source, a clock and the
 * consent gate. Read tools still take only a `GarminService`.
 *
 * Shape of the flow: these tools write to the LOCAL store, and the sync engine's push phase projects
 * the rows onto Garmin. That means "create" answers immediately and honestly ("saved, queued for
 * Garmin") instead of blocking on an upstream write that may be unavailable. The exception is delete,
 * which must reach Garmin now — a session left on the watch after the athlete deleted it here is the
 * one failure mode with real-world consequences.
 */
import { z } from 'zod';
import { todayKey, type NowSource } from '$lib/date';
import { sportLabel, sportMeta } from '$lib/sport-labels';
import {
  buildWorkoutPreset,
  WORKOUT_PRESETS,
  type WorkoutPresetName,
  type WorkoutPresetOptions
} from '$lib/workout-presets';
import {
  countWorkoutSteps,
  estimateWorkoutDistanceM,
  estimateWorkoutDurationS,
  normalizeWorkout,
  WORKOUT_DURATION_TYPES,
  WORKOUT_LIMITS,
  WORKOUT_STEP_KINDS,
  WORKOUT_TARGET_TYPES,
  WORKOUT_TARGET_UNITS,
  WorkoutValidationError,
  type WorkoutStep
} from '$lib/workouts';
import type { Clock } from '../server/clock';
import { WORKOUT_WRITE_FEATURE } from '../server/consent/registry';
import type { ConsentService } from '../server/consent/types';
import type { GarminSyncSource } from '../server/interfaces';
import type { Random } from '../server/random';
import type { AuthoredWorkout, LocalStore } from '../server/store/types';
import type { ToolResult } from './tools';

/** Everything the write tools need beyond Garmin reads. All injected (AGENTS.md §4). */
export interface WorkoutToolDeps {
  store: LocalStore;
  /** The ONE user these tools may touch — resolved from the MCP token, never from an argument. */
  userId: string;
  clock: Clock & NowSource;
  timeZone: string;
  random: Random;
  consent: ConsentService;
  /**
   * Write-capable Garmin source, used ONLY to remove a workout upstream on delete. Absent (or without
   * `deleteWorkout`) means an already-pushed workout cannot be cleaned up, and the tool says so rather
   * than deleting the local row and leaving the session on the watch.
   */
  garmin?: GarminSyncSource;
}

export interface WorkoutTool {
  name: string;
  description: string;
  inputShape: z.ZodRawShape;
  handler(deps: WorkoutToolDeps, args: Record<string, unknown>): Promise<ToolResult>;
}

function text(value: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }]
  };
}

function errorText(message: string): ToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

/* ---------------- argument schemas ---------------- */

const dayArg = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'day must be YYYY-MM-DD');
const timeArg = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be HH:MM')
  .nullish();

/**
 * One step as an MCP argument. Recursive (a `repeat` carries children), so the child schema is
 * declared with an explicit type annotation — z.lazy has no inferable type on its own.
 */
const stepArg: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    kind: z.enum(WORKOUT_STEP_KINDS as unknown as [string, ...string[]]),
    durationType: z.enum(WORKOUT_DURATION_TYPES as unknown as [string, ...string[]]).nullish(),
    durationValue: z.number().positive().nullish(),
    target: z
      .object({
        type: z.enum(WORKOUT_TARGET_TYPES as unknown as [string, ...string[]]),
        low: z.number().positive().nullish(),
        high: z.number().positive().nullish()
      })
      .nullish(),
    repeats: z.number().int().min(1).max(WORKOUT_LIMITS.maxRepeats).nullish(),
    steps: z.array(stepArg).max(WORKOUT_LIMITS.maxChildSteps).nullish(),
    note: z.string().max(WORKOUT_LIMITS.maxNote).nullish()
  })
);

const UNITS = Object.entries(WORKOUT_TARGET_UNITS)
  .filter(([type]) => type !== 'none')
  .map(([type, unit]) => `${type}=${unit}`)
  .join(', ');

/* ---------------- helpers ---------------- */

/** Consent gate. The write tools are dark until the user accepts the workout-write terms. */
async function requireConsent(deps: WorkoutToolDeps): Promise<ToolResult | null> {
  const enabled = await deps.consent.isEnabled(WORKOUT_WRITE_FEATURE);
  if (enabled) return null;
  return errorText(
    'Writing workouts to Garmin is not enabled for this account. Open the web app → Ustawienia and ' +
      'accept "Zapis treningów w Garminie" first. Reading data is unaffected.'
  );
}

/** The compact, content-light view a tool answers with. */
function view(workout: AuthoredWorkout): Record<string, unknown> {
  return {
    id: workout.id,
    day: workout.day,
    time: workout.time,
    sport: workout.sport,
    sportLabel: sportLabel(workout.sport),
    title: workout.title,
    stepCount: countWorkoutSteps(workout.steps),
    estimatedDurationS: estimateWorkoutDurationS(workout.steps),
    estimatedDistanceM: estimateWorkoutDistanceM(workout.steps),
    pushState: workout.pushState,
    ...(workout.pushError ? { pushError: workout.pushError } : {}),
    ...(workout.garminWorkoutId ? { garminWorkoutId: workout.garminWorkoutId } : {})
  };
}

/** What happens next, in words — so the caller never implies the watch already has the session. */
function pushHint(workout: AuthoredWorkout): string {
  switch (workout.pushState) {
    case 'pushed':
      return 'W Garminie (kalendarz + zegarek).';
    case 'failed':
      return 'Zapisane lokalnie; ostatnia wysyłka do Garmina nie powiodła się — kolejna synchronizacja spróbuje ponownie.';
    case 'unsupported':
      return 'Zapisane lokalnie; Garmin nie przyjmie tego treningu (patrz pushError).';
    default:
      return 'Zapisane lokalnie; następna synchronizacja wyśle je do Garmina.';
  }
}

/** Resolve the steps for a create/update: an explicit tree, or a named preset. */
function stepsFrom(args: Record<string, unknown>, sport: string): { title?: string; steps: WorkoutStep[] } {
  const preset = args.preset as WorkoutPresetName | undefined;
  const explicit = args.steps as WorkoutStep[] | undefined;
  if (preset && explicit) {
    throw new WorkoutValidationError('pass either steps or preset, not both');
  }
  if (preset) {
    if (!WORKOUT_PRESETS.includes(preset)) {
      throw new WorkoutValidationError(`unknown preset '${preset}' — use ${WORKOUT_PRESETS.join(', ')}`);
    }
    const options: WorkoutPresetOptions = {
      sport,
      repeats: (args.repeats as number | undefined) ?? null,
      workS: (args.workS as number | undefined) ?? null,
      workM: (args.workM as number | undefined) ?? null,
      recoveryS: (args.recoveryS as number | undefined) ?? null,
      warmupS: (args.warmupS as number | undefined) ?? null,
      cooldownS: (args.cooldownS as number | undefined) ?? null,
      targetType: (args.targetType as WorkoutPresetOptions['targetType']) ?? null,
      targetLow: (args.targetLow as number | undefined) ?? null,
      targetHigh: (args.targetHigh as number | undefined) ?? null
    };
    const built = buildWorkoutPreset(preset, options);
    return { title: built.title, steps: built.steps };
  }
  if (!explicit || explicit.length === 0) {
    throw new WorkoutValidationError('pass steps (a step list) or preset');
  }
  return { steps: explicit };
}

/* ---------------- the tools ---------------- */

const createWorkoutTool: WorkoutTool = {
  name: 'create_workout',
  description:
    'Create a structured training session (any sport: running, cycling, walking, swimming, strength) ' +
    'for a given day. Saved locally first, then pushed to the Garmin calendar by the next sync — so it ' +
    'reaches the watch. Pass an explicit `steps` tree, or a `preset` (' +
    WORKOUT_PRESETS.join(', ') +
    ') with its parameters. Steps: kind (warmup/work/recovery/rest/cooldown/repeat), durationType ' +
    '(time=seconds, distance=metres, lap, calories) + durationValue, and an optional target with ' +
    `low/high in canonical units (${UNITS}). A repeat step carries repeats + child steps. ` +
    'Targets are checked against the sport (no power target on a walk).',
  inputShape: {
    sport: z.string().min(1).describe('Garmin sport type key, e.g. running, cycling, walking'),
    day: dayArg,
    time: timeArg,
    title: z.string().min(1).max(WORKOUT_LIMITS.maxTitle).nullish(),
    steps: z.array(stepArg).max(WORKOUT_LIMITS.maxSteps).nullish(),
    preset: z.enum(WORKOUT_PRESETS as unknown as [string, ...string[]]).nullish(),
    repeats: z.number().int().min(1).max(WORKOUT_LIMITS.maxRepeats).nullish(),
    workS: z.number().positive().nullish(),
    workM: z.number().positive().nullish(),
    recoveryS: z.number().positive().nullish(),
    warmupS: z.number().min(0).nullish(),
    cooldownS: z.number().min(0).nullish(),
    targetType: z.enum(WORKOUT_TARGET_TYPES as unknown as [string, ...string[]]).nullish(),
    targetLow: z.number().positive().nullish(),
    targetHigh: z.number().positive().nullish(),
    note: z.string().max(WORKOUT_LIMITS.maxNote).nullish()
  },
  async handler(deps, args) {
    const gate = await requireConsent(deps);
    if (gate) return gate;
    try {
      const sport = String(args.sport ?? '');
      const wantedTitle = String(args.title ?? '').trim();

      /*
       * THE LIBRARY FIRST (spec 069). When neither `steps` nor `preset` is given but a title is, look
       * the name up in the athlete's library and use the session they already defined. This is the
       * whole reason the library exists on the MCP side: without it, "Interwały 5×1 km on Tuesday"
       * asked twice a month apart builds two subtly different sessions under one name.
       */
      const fromLibrary =
        wantedTitle && !args.steps && !args.preset
          ? await deps.store.findWorkoutTemplateByTitle(deps.userId, sport, wantedTitle)
          : null;

      const built = fromLibrary
        ? { title: fromLibrary.title, steps: fromLibrary.steps as WorkoutStep[] }
        : stepsFrom(args, sport);

      const workout = normalizeWorkout({
        sport,
        title: String(args.title ?? built.title ?? ''),
        steps: built.steps,
        note: (args.note as string | null | undefined) ?? null
      });
      const day = String(args.day ?? '');
      const created = await deps.store.createWorkout(deps.userId, {
        // 12 bytes of CSPRNG from the injected Random — never Math.random, never a timestamp.
        id: `w_${deps.random.token(12)}`,
        day,
        time: (args.time as string | null | undefined) ?? null,
        sport: workout.sport,
        title: workout.title,
        steps: workout.steps,
        note: workout.note,
        createdAt: deps.clock.now().toISOString()
      });
      /*
       * …AND CREATE IF MISSING (spec 069). A session composed here that the library does not hold is
       * added to it, so the library fills up as the assistant is used instead of staying empty until
       * someone remembers to curate it. Best-effort on purpose: the session is already saved, and
       * failing to file a copy must not turn a successful create into an error.
       */
      let libraryAction: 'used' | 'added' | 'none' = fromLibrary ? 'used' : 'none';
      if (!fromLibrary) {
        try {
          const existing = await deps.store.findWorkoutTemplateByTitle(
            deps.userId,
            workout.sport,
            workout.title
          );
          if (!existing) {
            await deps.store.createWorkoutTemplate(deps.userId, {
              id: `wt_${deps.random.token(12)}`,
              sport: workout.sport,
              title: workout.title,
              steps: workout.steps,
              note: workout.note,
              createdAt: deps.clock.now().toISOString()
            });
            libraryAction = 'added';
          }
        } catch {
          // Library bookkeeping is not worth failing a saved session over.
        }
      }

      return text({ ...view(created), library: libraryAction, next: pushHint(created) });
    } catch (err) {
      if (err instanceof WorkoutValidationError) return errorText(err.message);
      throw err;
    }
  }
};

/** The library itself, so the assistant can offer what the athlete already has (spec 069). */
const listWorkoutTemplatesTool: WorkoutTool = {
  name: 'list_workout_templates',
  description:
    'List the athlete REUSABLE workout library — sessions saved without a date, which can be ' +
    'scheduled onto any day. Use this before composing a new session: if one of these matches what ' +
    'the athlete asked for, schedule it by passing its exact title to create_workout with no steps ' +
    'and no preset, and the stored step tree is reused verbatim.',
  inputShape: {},
  async handler(deps) {
    const templates = await deps.store.listWorkoutTemplates(deps.userId);
    return text({
      count: templates.length,
      templates: templates.map((t) => ({
        title: t.title,
        sport: t.sport,
        sportLabel: sportLabel(t.sport),
        steps: countWorkoutSteps(t.steps),
        estimatedDurationS: estimateWorkoutDurationS(t.steps),
        estimatedDistanceM: estimateWorkoutDistanceM(t.steps),
        note: t.note
      }))
    });
  }
};

const listWorkoutsTool: WorkoutTool = {
  name: 'list_workouts',
  description:
    'List training sessions authored here, with their push state (pending = not on Garmin yet, ' +
    'pushed = in the Garmin calendar, failed = will retry, unsupported = Garmin will not take it). ' +
    'Defaults to today onwards. Does NOT list plans that came FROM Garmin — those are in the timeline.',
  inputShape: {
    from: dayArg.nullish(),
    to: dayArg.nullish(),
    pushState: z.enum(['pending', 'pushed', 'failed', 'unsupported']).nullish()
  },
  async handler(deps, args) {
    const from = (args.from as string | undefined) ?? todayKey(deps.clock, deps.timeZone);
    const workouts = await deps.store.listWorkouts(deps.userId, {
      from,
      ...(args.to ? { to: String(args.to) } : {}),
      ...(args.pushState ? { pushState: args.pushState as AuthoredWorkout['pushState'] } : {}),
      limit: 100
    });
    return text({ from, count: workouts.length, workouts: workouts.map(view) });
  }
};

const updateWorkoutTool: WorkoutTool = {
  name: 'update_workout',
  description:
    'Change an authored session (day, time, title, note, or the whole step tree). Any change resets ' +
    'the push state so the next sync re-sends it to Garmin. Only fields you pass are changed.',
  inputShape: {
    id: z.string().min(1),
    day: dayArg.nullish(),
    time: timeArg,
    title: z.string().min(1).max(WORKOUT_LIMITS.maxTitle).nullish(),
    sport: z.string().min(1).nullish(),
    steps: z.array(stepArg).max(WORKOUT_LIMITS.maxSteps).nullish(),
    note: z.string().max(WORKOUT_LIMITS.maxNote).nullish()
  },
  async handler(deps, args) {
    const gate = await requireConsent(deps);
    if (gate) return gate;
    const id = String(args.id ?? '');
    const current = await deps.store.getWorkout(deps.userId, id);
    if (!current) return errorText(`No authored workout with id '${id}'.`);
    try {
      const sport = (args.sport as string | undefined) ?? current.sport;
      if (args.sport !== undefined && args.sport !== null && !sportMeta(sport)) {
        return errorText(`unknown sport '${sport}'`);
      }
      // Re-validate the WHOLE workout, not just the patch: changing the sport can invalidate a target
      // that was legal before (a power target is fine on a ride, not on a walk).
      const validated = normalizeWorkout({
        sport,
        title: (args.title as string | undefined) ?? current.title,
        steps: (args.steps as WorkoutStep[] | undefined) ?? current.steps,
        note: args.note !== undefined ? ((args.note as string | null) ?? null) : current.note
      });
      const updated = await deps.store.updateWorkout(deps.userId, id, {
        ...(args.day !== undefined && args.day !== null ? { day: String(args.day) } : {}),
        ...(args.time !== undefined ? { time: (args.time as string | null) ?? null } : {}),
        sport: validated.sport,
        title: validated.title,
        steps: validated.steps,
        note: validated.note,
        // Content changed, so whatever is in Garmin is now stale: queue a re-push. The existing
        // garminWorkoutId is kept, so the push phase updates rather than duplicating.
        pushState: 'pending',
        pushError: null,
        updatedAt: deps.clock.now().toISOString()
      });
      if (!updated) return errorText(`No authored workout with id '${id}'.`);
      return text({ ...view(updated), next: pushHint(updated) });
    } catch (err) {
      if (err instanceof WorkoutValidationError) return errorText(err.message);
      throw err;
    }
  }
};

const deleteWorkoutTool: WorkoutTool = {
  name: 'delete_workout',
  description:
    'Delete an authored session. If it already reached Garmin it is removed there too, in the same ' +
    'call — the local row is kept (and the failure reported) if Garmin cannot be reached, so a session ' +
    'is never silently left on the watch.',
  inputShape: { id: z.string().min(1) },
  async handler(deps, args) {
    const gate = await requireConsent(deps);
    if (gate) return gate;
    const id = String(args.id ?? '');
    const current = await deps.store.getWorkout(deps.userId, id);
    if (!current) return errorText(`No authored workout with id '${id}'.`);

    // Nothing upstream: a purely local row goes straight away.
    if (!current.garminWorkoutId) {
      await deps.store.deleteWorkout(deps.userId, id);
      return text({ id, deleted: true, upstreamRemoved: false });
    }
    if (!deps.garmin?.deleteWorkout) {
      return errorText(
        `'${current.title}' is in Garmin (id ${current.garminWorkoutId}) and this connection cannot ` +
          'remove it. Delete it in Garmin Connect, or retry once the Garmin service is reachable.'
      );
    }
    try {
      const result = await deps.garmin.deleteWorkout(current.garminWorkoutId);
      if (!result.supported) {
        // Endpoint refused it: keep the row so the athlete can see it is still out there.
        await deps.store.updateWorkout(deps.userId, id, {
          pushState: 'failed',
          pushError: 'nie udało się usunąć treningu w Garminie',
          updatedAt: deps.clock.now().toISOString()
        });
        return errorText(
          `Could not remove '${current.title}' from Garmin, so it was NOT deleted here either. ` +
            'Remove it in Garmin Connect, or try again later.'
        );
      }
      await deps.store.deleteWorkout(deps.userId, id);
      return text({ id, deleted: true, upstreamRemoved: result.removed });
    } catch {
      await deps.store.updateWorkout(deps.userId, id, {
        pushState: 'failed',
        pushError: 'Garmin nie odpowiedział przy usuwaniu treningu',
        updatedAt: deps.clock.now().toISOString()
      });
      return errorText(
        `Garmin did not respond, so '${current.title}' was NOT deleted (here or there). Try again shortly.`
      );
    }
  }
};

export const WORKOUT_TOOLS: readonly WorkoutTool[] = [
  createWorkoutTool,
  listWorkoutTemplatesTool,
  listWorkoutsTool,
  updateWorkoutTool,
  deleteWorkoutTool
];
