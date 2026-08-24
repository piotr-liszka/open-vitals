/**
 * Minimal injectable logger. Never log secrets, tokens, passwords or metric payloads (AGENTS.md §10).
 * Keys matching the redaction list are masked defensively.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const REDACT_KEYS = /pass(word)?|secret|token|cookie|authorization|mfa|email|credential|session/i;

/** Depth beyond which a value is summarised rather than walked (cheap cycle/bomb guard). */
const MAX_DEPTH = 6;

/**
 * Mask sensitive keys anywhere in the metadata tree.
 *
 * Redaction used to apply to top-level keys only, so a secret one level down — the common shape,
 * e.g. `logger.error('failed', { response: { access_token } })` — was written out verbatim
 * (spec 055). Arrays and nested objects are now walked, with a depth cap and a seen-set so a cyclic
 * or pathologically deep object cannot turn a log line into a hang.
 */
function redactValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => redactValue(item, depth + 1, seen));
  // Errors and other exotic objects have no useful enumerable shape — keep their message only.
  if (value instanceof Error) return { name: value.name, message: value.message };

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = REDACT_KEYS.test(k) ? '[redacted]' : redactValue(v, depth + 1, seen);
  }
  return out;
}

function redact(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  return redactValue(meta, 0, new WeakSet()) as Record<string, unknown>;
}

export function createLogger(
  minLevel: LogLevel = 'info',
  sink: Pick<Console, 'log' | 'error'> = console
): Logger {
  const emit = (level: LogLevel, msg: string, meta?: Record<string, unknown>): void => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
    const line = { level, msg, ...(redact(meta) ?? {}) };
    if (level === 'error') sink.error(JSON.stringify(line));
    else sink.log(JSON.stringify(line));
  };
  return {
    debug: (m, meta) => emit('debug', m, meta),
    info: (m, meta) => emit('info', m, meta),
    warn: (m, meta) => emit('warn', m, meta),
    error: (m, meta) => emit('error', m, meta)
  };
}

/** No-op logger for tests. */
export const nullLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
};
