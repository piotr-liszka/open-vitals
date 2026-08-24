const GARMIN_METRICS = [
  "sleep",
  "steps",
  "hrv",
  "body_battery",
  "stress",
  "resting_heart_rate",
  "activities",
  "spo2",
  "respiration",
  "calories",
  "body_composition",
  "training_readiness"
];
class GarminNotAuthenticatedError extends Error {
  failure;
  constructor(message = "Garmin account is not connected", failure) {
    super(message);
    this.name = "GarminNotAuthenticatedError";
    this.failure = failure ?? { code: "not_connected", retryable: false };
  }
}
class GarminUnavailableError extends Error {
  failure;
  constructor(message = "Garmin service is unavailable", failure) {
    super(message);
    this.name = "GarminUnavailableError";
    this.failure = failure ?? { code: "upstream_error", retryable: true };
  }
}
function garminFailureOf(err) {
  if (err instanceof GarminUnavailableError || err instanceof GarminNotAuthenticatedError) {
    return err.failure;
  }
  if (err instanceof Error && err.name === "AbortError") return { code: "timeout", retryable: true };
  return { code: "upstream_error", retryable: true, reason: err instanceof Error ? err.name : "error" };
}

export { GarminUnavailableError as G, GarminNotAuthenticatedError as a, GARMIN_METRICS as b, garminFailureOf as g };
//# sourceMappingURL=interfaces.js-CRv0EuSy.js.map
