/**
 * The switch registry — single source of truth for what Settings can turn on and off (spec 071).
 *
 * Every switch here MUST have a consumer that reads it. A decorative toggle is worse than no toggle:
 * the `mcp` entry sat in this list for four specs while nothing on the `/mcp` path ever asked
 * whether it was on.
 */
import type { Feature } from './types';

export const FEATURES: readonly Feature[] = [
  {
    // Read by `runScheduledSync` (lib/server/sync/scheduler.ts).
    id: 'auto_sync',
    title: 'Automatyczne pobieranie danych',
    summary:
      'Pobieraj nowe dane z Garmina w tle, bez otwierania aplikacji. Po wyłączeniu dane odświeżysz ' +
      'ręcznie na stronie „Twoje dane”.',
    integration: 'garmin',
    defaultEnabled: true
  },
  {
    // Read by the sync engine's push phase and by every workout WRITE path (spec 050).
    // Id kept from the consent era so existing rows keep meaning the same thing.
    id: 'workout_write',
    title: 'Automatyczny zapis treningów do Garmina',
    summary:
      'Wysyłaj treningi ułożone tutaj do kalendarza Garmina (i na zegarek). To jedyna funkcja, ' +
      'która cokolwiek zapisuje na Twoim koncie Garmin.',
    integration: 'garmin',
    defaultEnabled: true
  },
  {
    // Read by `mcpGate` (lib/mcp/http.ts).
    id: 'mcp',
    title: 'Serwer MCP',
    summary:
      'Udostępniaj swoje dane klientom AI pod osobistym adresem MCP. Po wyłączeniu adres przestaje ' +
      'odpowiadać, ale token pozostaje ten sam.',
    integration: 'mcp',
    defaultEnabled: true
  }
] as const;

/** The switch every workout WRITE path checks (spec 050). */
export const WORKOUT_WRITE_FEATURE = 'workout_write';
/** The switch the background scheduler checks per user (spec 071). */
export const AUTO_SYNC_FEATURE = 'auto_sync';
/** The switch `/mcp` checks for the resolved user (spec 071). */
export const MCP_FEATURE = 'mcp';

export function getFeature(id: string): Feature | undefined {
  return FEATURES.find((f) => f.id === id);
}
