/** Contract shared by the update-check API and the Settings card (spec 068). */

/** The newest commit on the tracked branch, as reported by GitHub. */
export interface LatestCommit {
  /** Short sha (7 chars), for display next to the running build's own stamp. */
  readonly sha: string;
  /** ISO instant the commit was made. */
  readonly committedAt: string;
  /** First line of the commit message — enough to tell what landed. */
  readonly subject: string;
  /** Link to the commit on GitHub. */
  readonly url: string;
}

/**
 * Why `latest` is missing:
 * - `ok`               the check ran and `latest` is populated
 * - `not-configured`   no GITHUB_TOKEN, so a private repo cannot be queried
 * - `unreachable`      GitHub refused or could not be reached
 */
export type UpdateCheckState = 'ok' | 'not-configured' | 'unreachable';

export interface UpdateStatus {
  /** ISO instant the RUNNING bundle was built (Vite's `__BUILD_TIME__`). */
  readonly buildTime: string;
  /** Short commit the running bundle was built from; `''` when the build saw no git metadata. */
  readonly buildSha: string;
  readonly state: UpdateCheckState;
  readonly latest: LatestCommit | null;
  /**
   * True when the newest upstream commit is newer than the running build. Compared on TIME, not on
   * sha: the production container builds from a bind mount with no `.git` in it, so `buildSha` is
   * usually empty and a sha comparison would be unanswerable exactly where it matters.
   */
  readonly behind: boolean;
  /** ISO instant this check ran, so the card can say how fresh the answer is. */
  readonly checkedAt: string;
}
