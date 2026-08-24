const STREAMS_SCHEMA_VERSION = 2;
const BEST_EFFORTS_VERSION = 1;
class DuplicateGoalError extends Error {
  constructor(garminEventId) {
    super("goal already imported for this planned event");
    this.garminEventId = garminEventId;
    this.name = "DuplicateGoalError";
  }
}

export { BEST_EFFORTS_VERSION as B, DuplicateGoalError as D, STREAMS_SCHEMA_VERSION as S };
//# sourceMappingURL=types3.js-EQmY9zkz.js.map
