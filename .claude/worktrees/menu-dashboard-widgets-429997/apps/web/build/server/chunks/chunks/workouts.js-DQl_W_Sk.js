import { c as sportMeta, b as sportGroup } from './sport-labels.js-BKqMzU19.js';

const WORKOUT_STEP_KINDS = [
  "warmup",
  "work",
  "recovery",
  "rest",
  "cooldown",
  "repeat"
];
const WORKOUT_DURATION_TYPES = ["time", "distance", "lap", "calories"];
const WORKOUT_TARGET_TYPES = [
  "none",
  "pace",
  "speed",
  "power",
  "hr",
  "cadence"
];
const WORKOUT_TARGET_UNITS = {
  none: "",
  pace: "s_per_km",
  speed: "kph",
  power: "w",
  hr: "bpm",
  cadence: "rpm"
};
const WORKOUT_TARGETS_BY_GROUP = {
  run: ["none", "pace", "speed", "hr", "cadence"],
  ride: ["none", "power", "speed", "hr", "cadence"],
  swim: ["none", "pace", "hr"],
  walk: ["none", "pace", "speed", "hr"],
  strength: ["none", "hr"],
  other: ["none", "hr"]
};
const WORKOUT_LIMITS = {
  maxTitle: 80,
  maxNote: 512,
  maxSteps: 50,
  maxChildSteps: 40,
  maxRepeats: 50,
  /** 24 h in seconds / 500 km in metres — anything past this is a typo, not a session. */
  maxDurationS: 86400,
  maxDistanceM: 5e5,
  maxCalories: 1e4
};
class WorkoutValidationError extends Error {
}
function normalizeWorkout(input) {
  const sport = (input.sport ?? "").trim();
  if (!sportMeta(sport)) {
    throw new WorkoutValidationError(
      `unknown sport '${sport}' — use a Garmin type key such as running, cycling, walking`
    );
  }
  const title = (input.title ?? "").trim();
  if (!title) throw new WorkoutValidationError("title is required");
  if (title.length > WORKOUT_LIMITS.maxTitle) {
    throw new WorkoutValidationError(`title is longer than ${WORKOUT_LIMITS.maxTitle} characters`);
  }
  const steps = input.steps ?? [];
  if (steps.length === 0) throw new WorkoutValidationError("a workout needs at least one step");
  if (steps.length > WORKOUT_LIMITS.maxSteps) {
    throw new WorkoutValidationError(`a workout cannot have more than ${WORKOUT_LIMITS.maxSteps} steps`);
  }
  const group = sportGroup(sport);
  return {
    sport,
    title,
    steps: steps.map((step) => normalizeStep(step, group, 0)),
    note: cleanNote(input.note)
  };
}
function normalizeStep(step, group, depth) {
  if (!step || typeof step !== "object") throw new WorkoutValidationError("each step must be an object");
  const kind = step.kind;
  if (!WORKOUT_STEP_KINDS.includes(kind)) {
    throw new WorkoutValidationError(`unknown step kind '${kind}' — use ${WORKOUT_STEP_KINDS.join(", ")}`);
  }
  if (kind === "repeat") return normalizeRepeat(step, group, depth);
  const durationType = step.durationType ?? "lap";
  if (!WORKOUT_DURATION_TYPES.includes(durationType)) {
    throw new WorkoutValidationError(
      `unknown duration type '${durationType}' — use ${WORKOUT_DURATION_TYPES.join(", ")}`
    );
  }
  let durationValue = null;
  if (durationType !== "lap") {
    const value = numberOrNull(step.durationValue);
    if (value === null || value <= 0) {
      throw new WorkoutValidationError(`a ${durationType} step needs a positive durationValue`);
    }
    const max = durationType === "time" ? WORKOUT_LIMITS.maxDurationS : durationType === "distance" ? WORKOUT_LIMITS.maxDistanceM : WORKOUT_LIMITS.maxCalories;
    if (value > max) {
      throw new WorkoutValidationError(`${durationType} step value ${value} is beyond the ${max} limit`);
    }
    durationValue = value;
  }
  return {
    kind,
    durationType,
    durationValue,
    target: normalizeTarget(step.target, group),
    repeats: null,
    steps: null,
    note: cleanNote(step.note)
  };
}
function normalizeRepeat(step, group, depth) {
  if (depth > 0) {
    throw new WorkoutValidationError("repeat blocks cannot be nested");
  }
  const repeats = numberOrNull(step.repeats);
  if (repeats === null || !Number.isInteger(repeats) || repeats < 1) {
    throw new WorkoutValidationError('a repeat block needs a positive whole "repeats"');
  }
  if (repeats > WORKOUT_LIMITS.maxRepeats) {
    throw new WorkoutValidationError(
      `a repeat block cannot repeat more than ${WORKOUT_LIMITS.maxRepeats} times`
    );
  }
  const children = step.steps ?? [];
  if (children.length === 0) {
    throw new WorkoutValidationError("a repeat block needs at least one child step");
  }
  if (children.length > WORKOUT_LIMITS.maxChildSteps) {
    throw new WorkoutValidationError(
      `a repeat block cannot hold more than ${WORKOUT_LIMITS.maxChildSteps} steps`
    );
  }
  return {
    kind: "repeat",
    durationType: null,
    durationValue: null,
    target: null,
    repeats,
    steps: children.map((child) => normalizeStep(child, group, depth + 1)),
    note: cleanNote(step.note)
  };
}
function normalizeTarget(target, group) {
  if (!target) return null;
  const type = target.type ?? "none";
  if (!WORKOUT_TARGET_TYPES.includes(type)) {
    throw new WorkoutValidationError(
      `unknown target type '${type}' — use ${WORKOUT_TARGET_TYPES.join(", ")}`
    );
  }
  if (type === "none") return null;
  const allowed = WORKOUT_TARGETS_BY_GROUP[group];
  if (!allowed.includes(type)) {
    throw new WorkoutValidationError(
      `target '${type}' does not apply to this sport — allowed: ${allowed.filter((t) => t !== "none").join(", ")}`
    );
  }
  const low = positiveOrNull(target.low);
  const high = positiveOrNull(target.high);
  if (low === null && high === null) {
    throw new WorkoutValidationError(
      `target '${type}' needs a low and/or high value in ${WORKOUT_TARGET_UNITS[type]}`
    );
  }
  if (low !== null && high !== null && low > high) {
    throw new WorkoutValidationError(`target '${type}' has low above high`);
  }
  return { type, low, high };
}
function cleanNote(note) {
  if (typeof note !== "string") return null;
  const text = note.trim();
  if (!text) return null;
  if (text.length > WORKOUT_LIMITS.maxNote) {
    throw new WorkoutValidationError(`a note is longer than ${WORKOUT_LIMITS.maxNote} characters`);
  }
  return text;
}
function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function positiveOrNull(value) {
  const number = numberOrNull(value);
  return number !== null && number > 0 ? number : null;
}
function estimateWorkoutDurationS(steps) {
  let total = 0;
  let known = false;
  for (const step of steps) {
    if (step.kind === "repeat") {
      const inner = estimateWorkoutDurationS(step.steps ?? []);
      if (inner !== null) {
        total += inner * (step.repeats ?? 1);
        known = true;
      }
      continue;
    }
    if (step.durationType === "time" && step.durationValue) {
      total += step.durationValue;
      known = true;
      continue;
    }
    if (step.durationType === "distance" && step.durationValue && step.target) {
      const speed = targetSpeedMs(step.target);
      if (speed) {
        total += step.durationValue / speed;
        known = true;
      }
    }
  }
  return known ? Math.round(total) : null;
}
function estimateWorkoutDistanceM(steps) {
  let total = 0;
  let known = false;
  for (const step of steps) {
    if (step.kind === "repeat") {
      const inner = estimateWorkoutDistanceM(step.steps ?? []);
      if (inner !== null) {
        total += inner * (step.repeats ?? 1);
        known = true;
      }
      continue;
    }
    if (step.durationType === "distance" && step.durationValue) {
      total += step.durationValue;
      known = true;
    }
  }
  return known ? Math.round(total) : null;
}
function targetSpeedMs(target) {
  const values = [target.low, target.high].filter((v) => typeof v === "number" && v > 0);
  if (values.length === 0) return null;
  const mid = values.reduce((a, b) => a + b, 0) / values.length;
  if (target.type === "pace") return 1e3 / mid;
  if (target.type === "speed") return mid / 3.6;
  return null;
}

export { WorkoutValidationError as W, estimateWorkoutDurationS as a, WORKOUT_TARGET_UNITS as b, WORKOUT_LIMITS as c, WORKOUT_DURATION_TYPES as d, estimateWorkoutDistanceM as e, WORKOUT_STEP_KINDS as f, WORKOUT_TARGETS_BY_GROUP as g, normalizeWorkout as n };
//# sourceMappingURL=workouts.js-DQl_W_Sk.js.map
