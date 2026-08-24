import { describe, it, expect } from 'vitest';
import { getMcpUrl, rotateMcpUrl } from './mcpUrl.api';
import { createTestContainer } from '$lib/server/container';
import { sequenceRandom } from '$lib/server/random';

/** A container whose in-memory repo mints deterministic tokens so URLs are assertable. */
function container() {
  return createTestContainer({ random: sequenceRandom('mcp') });
}

describe('getMcpUrl', () => {
  it('combines the public base URL, /mcp path and the user’s minted token', async () => {
    const c = container();
    const url = await getMcpUrl(c, 'alice');
    expect(url).toBe('http://localhost:3000/mcp?token=mcp-1');
  });

  it('is stable for a user (get-or-create returns the same token)', async () => {
    const c = container();
    const first = await getMcpUrl(c, 'alice');
    const second = await getMcpUrl(c, 'alice');
    expect(first).toBe(second);
  });

  it('gives different users different tokens (per-user isolation)', async () => {
    const c = container();
    const alice = await getMcpUrl(c, 'alice');
    const bob = await getMcpUrl(c, 'bob');
    expect(alice).not.toBe(bob);
  });

  it('rotate issues a new token and invalidates the old URL', async () => {
    const c = container();
    const before = await getMcpUrl(c, 'alice');
    const after = await rotateMcpUrl(c, 'alice');
    expect(after).not.toBe(before);
    // getMcpUrl now returns the rotated token.
    expect(await getMcpUrl(c, 'alice')).toBe(after);
  });
});
