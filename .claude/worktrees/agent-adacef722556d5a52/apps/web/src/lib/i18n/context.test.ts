/**
 * A guard for the one i18n mistake that type-checks, passes review, and then throws at runtime.
 *
 * `getI18n()` reads Svelte context, which is only legal during component initialisation. A
 * `<script module>` block runs at IMPORT time — before any component exists — so a context read
 * there raises `lifecycle_outside_component` and takes down every page that imports the component.
 * It bit three components during spec 074, each time silently until the suite ran, so the rule is
 * now enforced rather than remembered: module blocks carry message KEYS, and the instance script
 * does the reading.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function svelteFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return svelteFiles(path);
    return path.endsWith('.svelte') ? [path] : [];
  });
}

/** The body of a `<script … module>` block, comments stripped, or `null` when there is none. */
function moduleBlock(source: string): string | null {
  const match = /<script[^>]*\bmodule\b[^>]*>([\s\S]*?)<\/script>/.exec(source);
  if (!match) return null;
  return match[1]!
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments — the rule itself is documented in one
    .replace(/\/\/.*$/gm, '');
}

describe('i18n context usage', () => {
  it('is never read from a `<script module>` block', () => {
    const offenders = svelteFiles('src').filter((path) => {
      const block = moduleBlock(readFileSync(path, 'utf8'));
      return block !== null && /\bgetI18n\s*\(/.test(block);
    });

    expect(offenders).toEqual([]);
  });
});
