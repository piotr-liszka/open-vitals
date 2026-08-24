import { a as sportGroupLabel, b as sportGroup } from './sport-labels.js-BKqMzU19.js';

const SPORT_PAGES = ["ride", "run", "walk"];
const SPORT_SLUGS = {
  ride: "rower",
  run: "bieg",
  walk: "marsz"
};
const OVERVIEW = { href: "/training", label: "Przegląd" };
const VOLUME = { href: "/training/objetosc", label: "Objętość" };
const GOALS = { href: "/training/cele", label: "Cele" };
const PLAN = { href: "/training/plan", label: "Plan treningowy" };
function groupCounts(sports) {
  const out = /* @__PURE__ */ new Map();
  for (const s of sports) {
    const g = sportGroup(s.sport);
    out.set(g, (out.get(g) ?? 0) + s.count);
  }
  return out;
}
function trainingTabs(sports) {
  const counts = groupCounts(sports);
  const tabs = [OVERVIEW];
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  if (total > 0) tabs.push(VOLUME);
  for (const group of SPORT_PAGES) {
    const count = counts.get(group) ?? 0;
    if (count === 0) continue;
    tabs.push({ href: `/training/${SPORT_SLUGS[group]}`, label: sportGroupLabel(group), count });
  }
  tabs.push(PLAN, GOALS);
  return tabs;
}
function trainingTitle(pathname) {
  const tab = [
    OVERVIEW,
    VOLUME,
    PLAN,
    GOALS,
    ...SPORT_PAGES.map((g) => ({ href: `/training/${SPORT_SLUGS[g]}`, label: sportGroupLabel(g) }))
  ].find((t) => t.href === pathname);
  return tab && tab.href !== "/training" ? `Trening · ${tab.label}` : "Trening";
}

export { SPORT_SLUGS as S, trainingTitle as a, trainingTabs as t };
//# sourceMappingURL=training-nav.js-D-TPJLDl.js.map
