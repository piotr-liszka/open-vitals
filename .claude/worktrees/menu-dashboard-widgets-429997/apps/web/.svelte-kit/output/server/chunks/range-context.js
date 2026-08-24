import { a as todayKey, D as DEFAULT_TIME_ZONE } from "./date.js";
import { p as parseRange, R as RANGE_PARAM, r as resolveRange } from "./range.js";
async function resolveRangeForUser(deps, userId, key) {
  const today = todayKey(deps.clock, deps.timeZone ?? DEFAULT_TIME_ZONE);
  const earliest = key === "all" ? (await deps.store.coverage(userId)).earliest : null;
  return resolveRange(key, today, earliest);
}
function loadRange(deps, userId, url) {
  return resolveRangeForUser(deps, userId, parseRange(url.searchParams.get(RANGE_PARAM)));
}
export {
  loadRange as l
};
