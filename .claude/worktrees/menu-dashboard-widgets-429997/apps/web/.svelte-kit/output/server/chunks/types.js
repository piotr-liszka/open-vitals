class UnknownFeatureError extends Error {
  constructor(featureId) {
    super(`unknown feature: ${featureId}`);
    this.name = "UnknownFeatureError";
  }
}
class TermsVersionMismatchError extends Error {
  constructor() {
    super("terms version mismatch — re-fetch the current terms before accepting");
    this.name = "TermsVersionMismatchError";
  }
}
export {
  TermsVersionMismatchError as T,
  UnknownFeatureError as U
};
