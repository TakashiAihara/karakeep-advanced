/**
 * The shape of an in-flight save, and the rule for when one is still worth resuming.
 *
 * Deliberately free of any browser or storage import so it can be unit tested directly.
 * Importing the storage binding pulls in @wxt-dev/storage, which reaches for
 * chrome.runtime at module load and throws outside an extension context.
 */

export type SaveJobTabState = 'pending' | 'bookmarked' | 'attached' | 'failed';

export type SaveJobTab = {
  tabId: number | null;
  url: string;
  title: string;
  bookmarkId: string | null;
  state: SaveJobTabState;
  reason: string | null;
};

export type SaveJob = {
  jobId: string;
  scope: string;
  closeAfter: boolean;
  subListId: string | null;
  subListName: string;
  tabs: SaveJobTab[];
  startedAt: string;
  finishedAt: string | null;
};

/** How long an unfinished job stays resumable. */
export const SAVE_JOB_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Whether an unfinished job is too old to offer for resume.
 *
 * An unparseable timestamp counts as stale: a job whose age cannot be established is not
 * one to act on. A timestamp in the future does not, because clock skew between the
 * machine that wrote the job and the one reading it should not discard real work.
 */
export function isJobStale(startedAt: string, now: number): boolean {
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return true;
  return now - started > SAVE_JOB_MAX_AGE_MS;
}
