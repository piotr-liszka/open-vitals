const ADVANCED_FEATURE = "detailed_analytics";
async function isAdvanced(consent) {
  return consent.isEnabled(ADVANCED_FEATURE);
}
async function resolveTier(consent) {
  return await isAdvanced(consent) ? "advanced" : "base";
}
export {
  ADVANCED_FEATURE as A,
  isAdvanced as i,
  resolveTier as r
};
