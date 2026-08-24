/**
 * "Is this deployment current?" (spec 068).
 *
 * The production stack builds from a bind-mounted working tree, so the app has no way to know what
 * upstream looks like — it cannot even read its own `.git` (only `apps/web` is mounted). The one
 * source of truth it CAN reach is GitHub, so this asks GitHub for the newest commit on the tracked
 * branch and compares it with the moment the running bundle was built.
 *
 * This answers the question; it deliberately does NOT apply the update. Pulling and running new code
 * from a request handler would turn any authenticated session into remote code execution on the host.
 */
import type { Clock } from '$lib/server/clock';
import type { Logger } from '$lib/server/logger';
import type { FetchLike } from '$lib/server/garmin/http-adapter';
import type { LatestCommit, UpdateStatus } from './version.types';

export interface UpdateCheckDeps {
  readonly fetch: FetchLike;
  readonly clock: Clock;
  readonly logger: Logger;
  /** `owner/name` of the repository to check. */
  readonly repo: string;
  /** Branch that production tracks. */
  readonly branch: string;
  /** GitHub token with read access. Empty = not configured (the repo is private, so no anonymous read). */
  readonly token: string;
  /** ISO instant the running bundle was built (`__BUILD_TIME__`, passed in by the route). */
  readonly buildTime: string;
  /** Short sha of the running bundle (`__BUILD_SHA__`); `''` when the build had no git metadata. */
  readonly buildSha: string;
}

/** Shape of the slice of GitHub's commit payload this uses. */
interface GitHubCommitResponse {
  sha?: unknown;
  html_url?: unknown;
  commit?: { message?: unknown; committer?: { date?: unknown } };
}

/** Narrow GitHub's response to our contract. Returns null if it is not the shape we need. */
function toLatestCommit(body: unknown, repo: string): LatestCommit | null {
  if (typeof body !== 'object' || body === null) return null;
  const c = body as GitHubCommitResponse;
  const sha = typeof c.sha === 'string' ? c.sha : '';
  const committedAt = typeof c.commit?.committer?.date === 'string' ? c.commit.committer.date : '';
  if (!sha || !committedAt) return null;
  const message = typeof c.commit?.message === 'string' ? c.commit.message : '';
  return {
    sha: sha.slice(0, 7),
    committedAt,
    // Only the subject line: commit bodies here run to paragraphs and the card shows one row.
    subject: message.split('\n', 1)[0] ?? '',
    url: typeof c.html_url === 'string' ? c.html_url : `https://github.com/${repo}/commit/${sha}`
  };
}

export async function checkForUpdate(deps: UpdateCheckDeps): Promise<UpdateStatus> {
  const base = {
    buildTime: deps.buildTime,
    buildSha: deps.buildSha,
    checkedAt: deps.clock.now().toISOString()
  };

  // No token: the repository is private, so there is nothing to ask. Say so rather than reporting a
  // failure — "you have not set this up" and "GitHub is down" need different reactions.
  if (!deps.token) return { ...base, state: 'not-configured', latest: null, behind: false };

  const url = `https://api.github.com/repos/${deps.repo}/commits/${encodeURIComponent(deps.branch)}`;
  try {
    const res = await deps.fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${deps.token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    if (!res.ok) {
      // Status only — a body can echo back the request, and the request carries the token.
      deps.logger.warn('update check rejected by GitHub', { status: res.status, repo: deps.repo });
      return { ...base, state: 'unreachable', latest: null, behind: false };
    }
    const latest = toLatestCommit(await res.json(), deps.repo);
    if (!latest) {
      deps.logger.warn('update check got an unexpected payload from GitHub', { repo: deps.repo });
      return { ...base, state: 'unreachable', latest: null, behind: false };
    }
    return {
      ...base,
      state: 'ok',
      latest,
      // A commit made after this bundle was built is a commit this bundle does not contain.
      behind: Date.parse(latest.committedAt) > Date.parse(deps.buildTime)
    };
  } catch (err) {
    // Never fail the Settings page over this; an unreachable GitHub is a normal offline condition.
    deps.logger.warn('update check could not reach GitHub', {
      repo: deps.repo,
      reason: err instanceof Error ? err.message : 'unknown'
    });
    return { ...base, state: 'unreachable', latest: null, behind: false };
  }
}
