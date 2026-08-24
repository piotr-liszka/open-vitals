import { j as json } from '../../../../chunks/utils.js-D6eaf5bT.js';
import '../../../../chunks/utils2.js-BQzn9ikS.js';
import '../../../../chunks/uneval.js-BnYgIxRU.js';

function toLatestCommit(body, repo) {
  if (typeof body !== "object" || body === null) return null;
  const c = body;
  const sha = typeof c.sha === "string" ? c.sha : "";
  const committedAt = typeof c.commit?.committer?.date === "string" ? c.commit.committer.date : "";
  if (!sha || !committedAt) return null;
  const message = typeof c.commit?.message === "string" ? c.commit.message : "";
  return {
    sha: sha.slice(0, 7),
    committedAt,
    // Only the subject line: commit bodies here run to paragraphs and the card shows one row.
    subject: message.split("\n", 1)[0] ?? "",
    url: typeof c.html_url === "string" ? c.html_url : `https://github.com/${repo}/commit/${sha}`
  };
}
async function checkForUpdate(deps) {
  const base = {
    buildTime: deps.buildTime,
    buildSha: deps.buildSha,
    checkedAt: deps.clock.now().toISOString()
  };
  if (!deps.token) return { ...base, state: "not-configured", latest: null, behind: false };
  const url = `https://api.github.com/repos/${deps.repo}/commits/${encodeURIComponent(deps.branch)}`;
  try {
    const res = await deps.fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${deps.token}`,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });
    if (!res.ok) {
      deps.logger.warn("update check rejected by GitHub", { status: res.status, repo: deps.repo });
      return { ...base, state: "unreachable", latest: null, behind: false };
    }
    const latest = toLatestCommit(await res.json(), deps.repo);
    if (!latest) {
      deps.logger.warn("update check got an unexpected payload from GitHub", { repo: deps.repo });
      return { ...base, state: "unreachable", latest: null, behind: false };
    }
    return {
      ...base,
      state: "ok",
      latest,
      // A commit made after this bundle was built is a commit this bundle does not contain.
      behind: Date.parse(latest.committedAt) > Date.parse(deps.buildTime)
    };
  } catch (err) {
    deps.logger.warn("update check could not reach GitHub", {
      repo: deps.repo,
      reason: err instanceof Error ? err.message : "unknown"
    });
    return { ...base, state: "unreachable", latest: null, behind: false };
  }
}
const GET = async ({ locals, fetch }) => {
  if (!locals.user) return json({ error: "unauthorized" }, { status: 401 });
  const c = locals.container;
  return json(
    await checkForUpdate({
      fetch,
      clock: c.clock,
      logger: c.logger,
      repo: c.config.updateCheckRepo,
      branch: c.config.updateCheckBranch,
      token: c.config.githubToken,
      buildTime: "2026-08-16T07:46:31.713Z",
      buildSha: "a9d13ec"
    })
  );
};

export { GET };
//# sourceMappingURL=_server.ts.js-CUGIyMLm.js.map
