/**
 * Dashboard config persistence (spec 016). Stored in the per-user `settings` bag under `dashboards`.
 * `sanitizeConfig` is the trust boundary: whatever the client POSTs is validated/clamped to known
 * widget types, spans and unique ids before it is saved or rendered.
 *
 * Spec 064 made each dashboard a destination, which put a new demand on ids: an id is now a route
 * segment, so it has to be unique and URL-safe. Both are enforced here rather than trusted from the
 * client — a duplicate id would make two sidebar entries point at the same page, and a slash in an id
 * would point at nothing.
 */
import type { SettingsRepo } from '$lib/server/repo/types';
import type {
  DashboardConfig,
  DashboardDef,
  DashboardNavEntry,
  WidgetInstance,
  WidgetSpan,
  WidgetType
} from './dashboards.types';
import { MAX_DASHBOARD_NAME, WIDGET_TYPES } from './dashboards.types';

const KEY = 'dashboards';
const SPANS: WidgetSpan[] = [4, 6, 8, 12];

/** What a brand-new account starts with: one ordinary dashboard, special only in being first. */
export function defaultConfig(): DashboardConfig {
  return {
    dashboards: [
      {
        id: 'main',
        name: 'Przegląd',
        widgets: [
          { id: 'w-streak', type: 'streak', span: 4 },
          { id: 'w-coverage', type: 'coverage', span: 8 },
          { id: 'w-volume', type: 'weekly-volume', span: 6 },
          { id: 'w-types', type: 'activity-types', span: 6 },
          { id: 'w-recent', type: 'recent-activities', span: 6 },
          { id: 'w-steps', type: 'metric-trend', span: 6, options: { metric: 'steps' } }
        ]
      }
    ]
  };
}

function clampSpan(v: unknown): WidgetSpan {
  return SPANS.includes(v as WidgetSpan) ? (v as WidgetSpan) : 6;
}

/**
 * Route segments under `/dashboard/` that are pages, not dashboards. A dashboard allowed to take one
 * would shadow the page and become unreachable itself — `new` is where you go to create one.
 */
const RESERVED_IDS = new Set(['new']);

/**
 * Reduce an untrusted id to something safe to put in a URL path. Anything outside the allow-list
 * becomes `-`; an id that survives as empty, or collides with a route, falls back to the caller's
 * positional id.
 */
function safeId(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return cleaned && !RESERVED_IDS.has(cleaned) ? cleaned : fallback;
}

function sanitizeWidget(raw: unknown, i: number): WidgetInstance | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!(WIDGET_TYPES as readonly WidgetType[]).includes(o.type as WidgetType)) return null;
  return {
    id: typeof o.id === 'string' && o.id ? o.id : `w${i}`,
    type: o.type as WidgetType,
    span: clampSpan(o.span),
    ...(o.options && typeof o.options === 'object' ? { options: o.options as Record<string, unknown> } : {})
  };
}

function sanitizeDashboard(raw: unknown, i: number): DashboardDef | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name =
    typeof o.name === 'string' && o.name.trim()
      ? o.name.trim().slice(0, MAX_DASHBOARD_NAME)
      : `Panel ${i + 1}`;
  const widgets = Array.isArray(o.widgets)
    ? o.widgets.map((w, wi) => sanitizeWidget(w, wi)).filter((w): w is WidgetInstance => w !== null)
    : [];
  return { id: safeId(o.id, `d${i}`), name, widgets };
}

/**
 * Validate/normalize any candidate config; fall back to the default when it's unusable.
 *
 * Ids are de-duplicated AFTER sanitising, because two different raw ids can reduce to the same safe
 * one. A duplicate would give two sidebar entries the same destination, so the later one is suffixed
 * rather than dropped — losing a dashboard is a worse outcome than renaming its URL.
 */
export function sanitizeConfig(raw: unknown): DashboardConfig {
  if (!raw || typeof raw !== 'object') return defaultConfig();
  const o = raw as Record<string, unknown>;
  const parsed = Array.isArray(o.dashboards)
    ? o.dashboards.map((d, i) => sanitizeDashboard(d, i)).filter((d): d is DashboardDef => d !== null)
    : [];
  if (parsed.length === 0) return defaultConfig();

  const seen = new Set<string>();
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

/** The sidebar's view of the config — id and name, nothing else. */
export function navEntries(config: DashboardConfig): DashboardNavEntry[] {
  return config.dashboards.map((d) => ({ id: d.id, name: d.name }));
}

/** The dashboard a bare `/dashboard` resolves to. Never null: a config always has at least one. */
export function firstDashboardId(config: DashboardConfig): string {
  return config.dashboards[0]!.id;
}

export function findDashboard(config: DashboardConfig, id: string): DashboardDef | null {
  return config.dashboards.find((d) => d.id === id) ?? null;
}

export async function getConfig(settings: SettingsRepo, userId: string): Promise<DashboardConfig> {
  const bag = await settings.get(userId);
  return KEY in bag ? sanitizeConfig(bag[KEY]) : defaultConfig();
}

export async function saveConfig(
  settings: SettingsRepo,
  userId: string,
  raw: unknown
): Promise<DashboardConfig> {
  const clean = sanitizeConfig(raw);
  const bag = await settings.get(userId);
  await settings.set(userId, { ...bag, [KEY]: clean });
  return clean;
}
