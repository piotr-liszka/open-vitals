import { M as MAX_DASHBOARD_NAME, W as WIDGET_TYPES } from './dashboards.types.js-BpwEQDmq.js';

const KEY = "dashboards";
const SPANS = [4, 6, 8, 12];
function defaultConfig() {
  return {
    dashboards: [
      {
        id: "main",
        name: "Przegląd",
        widgets: [
          { id: "w-streak", type: "streak", span: 4 },
          { id: "w-coverage", type: "coverage", span: 8 },
          { id: "w-volume", type: "weekly-volume", span: 6 },
          { id: "w-types", type: "activity-types", span: 6 },
          { id: "w-recent", type: "recent-activities", span: 6 },
          { id: "w-steps", type: "metric-trend", span: 6, options: { metric: "steps" } }
        ]
      }
    ]
  };
}
function clampSpan(v) {
  return SPANS.includes(v) ? v : 6;
}
const RESERVED_IDS = /* @__PURE__ */ new Set(["new"]);
function safeId(raw, fallback) {
  if (typeof raw !== "string") return fallback;
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return cleaned && !RESERVED_IDS.has(cleaned) ? cleaned : fallback;
}
function sanitizeWidget(raw, i) {
  if (!raw || typeof raw !== "object") return null;
  const o = raw;
  if (!WIDGET_TYPES.includes(o.type)) return null;
  return {
    id: typeof o.id === "string" && o.id ? o.id : `w${i}`,
    type: o.type,
    span: clampSpan(o.span),
    ...o.options && typeof o.options === "object" ? { options: o.options } : {}
  };
}
function sanitizeDashboard(raw, i) {
  if (!raw || typeof raw !== "object") return null;
  const o = raw;
  const name = typeof o.name === "string" && o.name.trim() ? o.name.trim().slice(0, MAX_DASHBOARD_NAME) : `Panel ${i + 1}`;
  const widgets = Array.isArray(o.widgets) ? o.widgets.map((w, wi) => sanitizeWidget(w, wi)).filter((w) => w !== null) : [];
  return { id: safeId(o.id, `d${i}`), name, widgets };
}
function sanitizeConfig(raw) {
  if (!raw || typeof raw !== "object") return defaultConfig();
  const o = raw;
  const parsed = Array.isArray(o.dashboards) ? o.dashboards.map((d, i) => sanitizeDashboard(d, i)).filter((d) => d !== null) : [];
  if (parsed.length === 0) return defaultConfig();
  const seen = /* @__PURE__ */ new Set();
  const dashboards = parsed.map((d) => {
    if (!seen.has(d.id)) {
      seen.add(d.id);
      return d;
    }
    let n = 2;
    while (seen.has(`${d.id}-${n}`)) n++;
    const id = `${d.id}-${n}`;
    seen.add(id);
    return { ...d, id };
  });
  return { dashboards };
}
function navEntries(config) {
  return config.dashboards.map((d) => ({ id: d.id, name: d.name }));
}
function firstDashboardId(config) {
  return config.dashboards[0].id;
}
function findDashboard(config, id) {
  return config.dashboards.find((d) => d.id === id) ?? null;
}
async function getConfig(settings, userId) {
  const bag = await settings.get(userId);
  return KEY in bag ? sanitizeConfig(bag[KEY]) : defaultConfig();
}
async function saveConfig(settings, userId, raw) {
  const clean = sanitizeConfig(raw);
  const bag = await settings.get(userId);
  await settings.set(userId, { ...bag, [KEY]: clean });
  return clean;
}

export { firstDashboardId as a, findDashboard as f, getConfig as g, navEntries as n, saveConfig as s };
//# sourceMappingURL=dashboards.api.js-rpZOmEGy.js.map
