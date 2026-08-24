/** Update check (spec 068) — every branch driven through a mock fetch; never touches the network. */
import { describe, it, expect, vi } from 'vitest';
import { nullLogger } from '$lib/server/logger';
import { fixedClock } from '$lib/server/clock';
import type { FetchLike } from '$lib/server/garmin/http-adapter';
import { checkForUpdate, type UpdateCheckDeps } from './version.api';

const NOW = new Date('2026-08-15T12:00:00.000Z');
const BUILD_TIME = '2026-08-15T10:00:00.000Z';

/** GitHub's payload, trimmed to the fields this reads. */
function commitPayload(overrides: Record<string, unknown> = {}): unknown {
  return {
    sha: 'abcdef1234567890',
    html_url: 'https://github.com/owner/repo/commit/abcdef1234567890',
    commit: {
      message: 'feat: a new thing\n\nwith a body that must not reach the card',
      committer: { date: '2026-08-15T11:00:00.000Z' }
    },
    ...overrides
  };
}

function deps(over: Partial<UpdateCheckDeps> = {}): UpdateCheckDeps {
  return {
    fetch: (async () => new Response('{}', { status: 200 })) as FetchLike,
    clock: fixedClock(NOW),
    logger: nullLogger,
    repo: 'owner/repo',
    branch: 'main',
    token: 'test-token',
    buildTime: BUILD_TIME,
    buildSha: 'deadbee',
    ...over
  };
}

describe('checkForUpdate', () => {
  it('reports not-configured without calling GitHub when there is no token', async () => {
    const fetch = vi.fn();
    const status = await checkForUpdate(deps({ token: '', fetch: fetch as unknown as FetchLike }));

    expect(status.state).toBe('not-configured');
    expect(status.latest).toBeNull();
    expect(status.behind).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports behind when the newest commit is newer than the running build', async () => {
    const status = await checkForUpdate(
      deps({ fetch: (async () => Response.json(commitPayload())) as FetchLike })
    );

    expect(status.state).toBe('ok');
    expect(status.behind).toBe(true);
    expect(status.latest).toEqual({
      sha: 'abcdef1',
      committedAt: '2026-08-15T11:00:00.000Z',
      subject: 'feat: a new thing',
      url: 'https://github.com/owner/repo/commit/abcdef1234567890'
    });
    expect(status.buildTime).toBe(BUILD_TIME);
    expect(status.checkedAt).toBe(NOW.toISOString());
  });

  it('reports up to date when the build is newer than the newest commit', async () => {
    const older = commitPayload({
      commit: { message: 'old', committer: { date: '2026-08-15T09:00:00.000Z' } }
    });
    const status = await checkForUpdate(deps({ fetch: (async () => Response.json(older)) as FetchLike }));

    expect(status.state).toBe('ok');
    expect(status.behind).toBe(false);
  });

  it('sends the token and asks for the configured repo and branch', async () => {
    const fetch = vi.fn(async () => Response.json(commitPayload()));
    await checkForUpdate(
      deps({ fetch: fetch as unknown as FetchLike, repo: 'me/app', branch: 'release/v2' })
    );

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/me/app/commits/release%2Fv2');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
  });

  it('degrades to unreachable on a rejected request instead of throwing', async () => {
    const status = await checkForUpdate(
      deps({ fetch: (async () => new Response('nope', { status: 404 })) as FetchLike })
    );

    expect(status.state).toBe('unreachable');
    expect(status.latest).toBeNull();
    expect(status.behind).toBe(false);
    // The build stamp still has to come back — it is the half of the card that always works.
    expect(status.buildSha).toBe('deadbee');
  });

  it('degrades to unreachable when the network throws', async () => {
    const status = await checkForUpdate(
      deps({
        fetch: (() => Promise.reject(new Error('getaddrinfo ENOTFOUND'))) as unknown as FetchLike
      })
    );

    expect(status.state).toBe('unreachable');
  });

  it('degrades to unreachable on a payload that is not a commit', async () => {
    const status = await checkForUpdate(
      deps({ fetch: (async () => Response.json({ message: 'Not Found' })) as FetchLike })
    );

    expect(status.state).toBe('unreachable');
  });

  it('never logs the token', async () => {
    const warn = vi.fn();
    await checkForUpdate(
      deps({
        fetch: (async () => new Response('', { status: 401 })) as FetchLike,
        token: 'super-secret-token',
        logger: { ...nullLogger, warn }
      })
    );

    expect(JSON.stringify(warn.mock.calls)).not.toContain('super-secret-token');
  });
});
