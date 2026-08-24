import { b as buildPowerProfile } from "../../../../chunks/power-profile.js";
import { s as sportKeysInGroup } from "../../../../chunks/sport-labels.js";
import { t as toDayKey } from "../../../../chunks/date.js";
function numberSetting(settings, key) {
  const v = settings[key];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}
async function loadPower(deps, req) {
  const query = {
    limit: 1e5,
    ...req.group ? { sports: sportKeysInGroup(req.group) } : {}
  };
  const [activities, userSettings, weighins] = await Promise.all([
    deps.store.listActivities(req.userId, query),
    deps.settings.get(req.userId),
    deps.store.getWeightRange(req.userId, "1900-01-01", "2999-12-31")
  ]);
  const ftpSetting = numberSetting(userSettings, "ftpWatts");
  const weightSetting = numberSetting(userSettings, "weightKg");
  let weightKg = weightSetting;
  let weightSource = weightSetting != null ? "settings" : null;
  if (weightKg == null && weighins.length > 0) {
    weightKg = weighins[weighins.length - 1].weightKg;
    weightSource = "measured";
  }
  const powerById = await deps.store.getStreamField(
    req.userId,
    activities.map((a) => a.activityId),
    "power"
  );
  const powerActs = activities.map((a) => ({
    activityId: a.activityId,
    day: toDayKey(a.startTimeLocal),
    power: powerById.get(a.activityId) ?? null
  }));
  const profile = buildPowerProfile(powerActs, {
    weightKg,
    ...ftpSetting != null ? { ftpOverride: ftpSetting } : {}
  });
  return { ...profile, weightSource };
}
const load = async ({ locals }) => {
  const user = locals.user;
  const c = locals.container;
  const power = await loadPower(
    { store: c.store, settings: c.repo.settings },
    { userId: user.id, group: "ride" }
  );
  return { power };
};
export {
  load
};
