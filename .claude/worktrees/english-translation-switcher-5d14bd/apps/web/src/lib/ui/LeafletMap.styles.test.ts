import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * A source-level guard, not a render test (spec 034).
 *
 * Leaflet assigns its panes and controls z-index 200–800 against the nearest stacking context. With
 * no stacking context on the map frame that is the ROOT one, and a route thumbnail paints straight
 * over the app chrome — the mobile nav drawer most visibly. `isolation: isolate` is what stops it.
 *
 * Mounting the component to assert this would boot Leaflet (dynamic import, tiles, a real layout
 * engine) to check a single declaration that jsdom does not even resolve, so the rule is asserted
 * where it lives.
 */
const source = readFileSync(fileURLToPath(new URL('./LeafletMap.svelte', import.meta.url)), 'utf8');

describe('LeafletMap stacking', () => {
  it('isolates its own stacking context so Leaflet layers cannot escape the card', () => {
    const frame = source.slice(source.indexOf('<style>'));
    expect(frame).toMatch(/\.map\s*\{[^}]*isolation:\s*isolate/s);
  });

  it('declares no z-index of its own — the isolation is the mechanism, not a bare number', () => {
    expect(source.slice(source.indexOf('<style>'))).not.toMatch(/z-index:\s*\d/);
  });
});
