/**
 * Permanent redirects for routes that have been renamed.
 *
 * Route segments used to be written in the UI language (`/training/objetosc`, `/activities/mapa`).
 * They are English now — a URL is an identifier read by bookmarks, logs, MCP clients and anyone
 * sharing a link, none of which speak Polish. The old paths stay alive as 308s so nothing that was
 * ever linked 404s.
 *
 * The query string travels with the redirect for the same reason the `/heatmap` shim carries it: a
 * shared `?sport=cycling&year=2025` link must land on that same filtered view, not on the default.
 *
 * Pure — no I/O, no clock. `URLSearchParams.toString()` re-encodes, so a hand-typed `?range=a b`
 * arrives as a valid URL rather than being spliced in raw.
 */

/** `to` with `from`'s query string appended, or bare `to` when there is none. */
export function movedTo(to: string, from: URL): string {
  const query = from.searchParams.toString();
  return query ? `${to}?${query}` : to;
}
