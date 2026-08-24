/** Scriptable in-memory GarminService for tests (AGENTS.md §7). */
import {
  GarminNotAuthenticatedError,
  type GarminLoginInput,
  type GarminLoginResult,
  type GarminMetricName,
  type GarminMetricRange,
  type GarminService,
  type GarminStatus
} from '../interfaces';

/** Inclusive list of YYYY-MM-DD dates from start to end (UTC, order preserved). */
export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  for (let d = s; d.getTime() <= e.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export interface GarminMockOptions {
  status?: GarminStatus;
  /** Force the next login outcome. */
  loginOutcome?: GarminLoginResult['outcome'];
  /** Metric values by name. */
  metrics?: Partial<Record<GarminMetricName, unknown>>;
  /**
   * Per-day range payloads by metric, keyed `YYYY-MM-DD`. When a metric has an entry here, a range
   * read returns `data: null` for every day NOT listed — which is how a real gap in the history
   * looks, and the only way to test gap handling (spec 028).
   */
  rangeDays?: Partial<Record<GarminMetricName, Record<string, unknown>>>;
}

export interface GarminMock extends GarminService {
  /** Inspect recorded calls in assertions. */
  readonly calls: {
    login: GarminLoginInput[];
    getMetric: Array<{ name: GarminMetricName; date?: string }>;
    getMetricRange: Array<{ name: GarminMetricName; start: string; end: string }>;
    disconnect: number;
  };
}

export function createGarminMock(opts: GarminMockOptions = {}): GarminMock {
  let status: GarminStatus = opts.status ?? { authenticated: false };
  const metrics = opts.metrics ?? {};
  const calls: GarminMock['calls'] = { login: [], getMetric: [], getMetricRange: [], disconnect: 0 };

  return {
    calls,
    async login(input: GarminLoginInput): Promise<GarminLoginResult> {
      calls.login.push(input);
      const outcome = opts.loginOutcome ?? 'success';
      if (outcome === 'success') {
        status = { authenticated: true, displayName: status.displayName ?? 'Test User' };
        return { outcome: 'success', status };
      }
      if (outcome === 'mfa_required') return { outcome: 'mfa_required' };
      return { outcome: 'invalid_credentials' };
    },
    async getStatus(): Promise<GarminStatus> {
      return status;
    },
    async getMetric(name: GarminMetricName, date?: string): Promise<unknown> {
      calls.getMetric.push({ name, ...(date ? { date } : {}) });
      if (!status.authenticated) throw new GarminNotAuthenticatedError();
      return metrics[name] ?? { name, date: date ?? null, sample: true };
    },
    async getMetricRange(name: GarminMetricName, start: string, end: string): Promise<GarminMetricRange> {
      calls.getMetricRange.push({ name, start, end });
      if (!status.authenticated) throw new GarminNotAuthenticatedError();
      const scripted = opts.rangeDays?.[name];
      const days = eachDate(start, end).map((date) => ({
        date,
        data: scripted ? (scripted[date] ?? null) : (metrics[name] ?? { name, date, sample: true })
      }));
      return { metric: name, start, end, days };
    },
    async disconnect(): Promise<void> {
      calls.disconnect += 1;
      status = { authenticated: false };
    }
  };
}
