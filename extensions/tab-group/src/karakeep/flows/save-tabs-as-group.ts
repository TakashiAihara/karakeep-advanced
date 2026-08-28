import { browser } from 'wxt/browser';
import {
  ensureTabGroupsList,
  invalidateTabGroupsList,
  PARENT_LIST_NAME,
} from './ensure-tab-groups-list';
import { getKarakeep } from '@/src/karakeep/client';
import type {
  SaveError,
  SaveOverrides,
  SaveResult,
  SaveScope,
} from '@/src/messaging/schema';
import {
  excludePinnedItem,
  lastSaveReportItem,
  recentGroupIdsItem,
  saveJobItem,
  type SaveJob,
  type SaveJobTab,
} from '@/src/storage/items';
import { mapWithConcurrency } from '@/src/util/concurrency';
import { selectSaveableTabs } from '@/src/util/saveable-tabs';

const SUB_LIST_ICON = '📑';
const SOURCE = 'extension' as const;
const REQUEST_CONCURRENCY = 3;
const RECENT_GROUP_HISTORY = 50;

// batched because progress lost between flushes only costs idempotent requests on resume
const PERSIST_EVERY = 5;

function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function describeThrown(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function selectTabs(scope: SaveScope, overrides?: SaveOverrides) {
  const [allTabs, storedExcludePinned] = await Promise.all([
    browser.tabs.query({ currentWindow: true }),
    excludePinnedItem.getValue(),
  ]);
  const excludePinned = overrides?.ignoreExcludePinned ? false : storedExcludePinned;
  return selectSaveableTabs(allTabs, scope, {
    excludePinned,
    tabIds: overrides?.tabIds,
  });
}

async function pushRecentGroup(subListId: string): Promise<void> {
  const recent = await recentGroupIdsItem.getValue();
  const updated = [subListId, ...recent.filter((id) => id !== subListId)].slice(
    0,
    RECENT_GROUP_HISTORY,
  );
  await recentGroupIdsItem.setValue(updated);
}

type JobWriter = {
  flush: () => Promise<void>;
  touch: () => Promise<void>;
};

function createJobWriter(job: SaveJob): JobWriter {
  let sinceFlush = 0;
  let queue: Promise<void> = Promise.resolve();

  const flush = (): Promise<void> => {
    sinceFlush = 0;
    // one chain: the tab workers run concurrently, and losing resumability must not
    // abort a save that is otherwise succeeding
    queue = queue
      .then(() => saveJobItem.setValue(job))
      .catch((err) => {
        console.warn('[karakeep-advanced] save job not persisted:', err);
      });
    return queue;
  };

  return {
    flush,
    async touch() {
      sinceFlush++;
      if (sinceFlush >= PERSIST_EVERY) await flush();
    },
  };
}

type SubListAttempt = { id: string | null; status: number };

async function createSubList(parentId: string, name: string): Promise<SubListAttempt> {
  const created = await getKarakeep().POST('/lists', {
    body: {
      name,
      icon: SUB_LIST_ICON,
      type: 'manual',
      parentId,
    },
  });
  if (created.error || !created.data) {
    return { id: null, status: created.response.status };
  }
  return { id: created.data.id, status: created.response.status };
}

// NOTE: schema.d.ts documents no status for creating a child of a deleted parent, so the
// create failure is not evidence — ask about the parent, and treat anything but a definite
// 404 as unknown
async function parentListIsGone(parentId: string): Promise<boolean> {
  try {
    const { error, response } = await getKarakeep().GET('/lists/{listId}', {
      params: { path: { listId: parentId } },
    });
    return Boolean(error) && response.status === 404;
  } catch {
    return false;
  }
}

async function resolveSubList(name: string): Promise<string> {
  const parentId = await ensureTabGroupsList();
  const first = await createSubList(parentId, name);
  if (first.id) return first.id;

  if (!(await parentListIsGone(parentId))) {
    throw new Error(`Failed to create sub-list "${name}" (HTTP ${first.status}).`);
  }

  await invalidateTabGroupsList();
  const freshParentId = await ensureTabGroupsList();
  const second = await createSubList(freshParentId, name);
  if (second.id) return second.id;

  throw new Error(
    `Failed to create sub-list "${name}" under a re-resolved "${PARENT_LIST_NAME}" (HTTP ${second.status}).`,
  );
}

async function createBookmarks(job: SaveJob, writer: JobWriter): Promise<void> {
  const client = getKarakeep();
  const pending = job.tabs.filter((tab) => tab.state === 'pending');

  await mapWithConcurrency(
    pending,
    async (tab) => {
      try {
        const { data, error, response } = await client.POST('/bookmarks', {
          body: {
            type: 'link',
            url: tab.url,
            title: tab.title || undefined,
            source: SOURCE,
          },
        });
        if (error || !data) {
          tab.state = 'failed';
          tab.reason = `create failed (HTTP ${response.status})`;
        } else {
          tab.bookmarkId = data.id;
          tab.state = 'bookmarked';
          tab.reason = null;
        }
      } catch (err) {
        tab.state = 'failed';
        tab.reason = `create failed (${describeThrown(err)})`;
      }
      await writer.touch();
    },
    REQUEST_CONCURRENCY,
  );

  await writer.flush();
}

async function attachBookmarks(
  job: SaveJob,
  subListId: string,
  writer: JobWriter,
): Promise<void> {
  const client = getKarakeep();
  const bookmarked = job.tabs.filter((tab) => tab.state === 'bookmarked');

  await mapWithConcurrency(
    bookmarked,
    async (tab) => {
      const bookmarkId = tab.bookmarkId;
      if (!bookmarkId) {
        tab.state = 'failed';
        tab.reason = 'attach failed (no bookmark id)';
        return;
      }
      try {
        const { error, response } = await client.PUT(
          '/lists/{listId}/bookmarks/{bookmarkId}',
          { params: { path: { listId: subListId, bookmarkId } } },
        );
        if (error) {
          tab.state = 'failed';
          tab.reason = `attach failed (HTTP ${response.status})`;
        } else {
          tab.state = 'attached';
          tab.reason = null;
        }
      } catch (err) {
        tab.state = 'failed';
        tab.reason = `attach failed (${describeThrown(err)})`;
      }
      await writer.touch();
    },
    REQUEST_CONCURRENCY,
  );

  await writer.flush();
}

async function closeSavedTabs(tabs: readonly SaveJobTab[]): Promise<number> {
  const savedUrlByTabId = new Map<number, string>();
  for (const tab of tabs) {
    if (tab.tabId !== null) savedUrlByTabId.set(tab.tabId, tab.url);
  }
  if (savedUrlByTabId.size === 0) return 0;

  // a resumed job can outlive the window it started from, so match url as well as id
  const live = await browser.tabs.query({});
  const ids: number[] = [];
  for (const tab of live) {
    if (typeof tab.id === 'number' && savedUrlByTabId.get(tab.id) === tab.url) {
      ids.push(tab.id);
    }
  }
  if (ids.length === 0) return 0;

  try {
    await browser.tabs.remove(ids);
    return ids.length;
  } catch (err) {
    console.warn('[karakeep-advanced] closing saved tabs failed:', err);
    return 0;
  }
}

async function runJob(job: SaveJob): Promise<SaveResult> {
  const writer = createJobWriter(job);

  for (const tab of job.tabs) {
    if (tab.state === 'failed') {
      tab.state = tab.bookmarkId ? 'bookmarked' : 'pending';
      tab.reason = null;
    }
  }

  let subListId = job.subListId;
  if (!subListId) {
    try {
      subListId = await resolveSubList(job.subListName);
    } catch (err) {
      await saveJobItem.setValue(null);
      throw err;
    }
    job.subListId = subListId;
    await writer.flush();
  }

  // recentGroupIds is the only index the extension has, so record the group before any
  // bookmark work rather than after it
  await pushRecentGroup(subListId);

  await createBookmarks(job, writer);
  await attachBookmarks(job, subListId, writer);

  const failed: SaveError[] = job.tabs
    .filter((tab) => tab.state === 'failed')
    .map((tab) => ({ url: tab.url, reason: tab.reason ?? 'unknown error' }));
  const savedCount = job.tabs.filter((tab) => tab.state === 'attached').length;

  const closedTabs =
    job.closeAfter && failed.length === 0 ? await closeSavedTabs(job.tabs) : 0;

  const result: SaveResult = {
    jobId: job.jobId,
    subListId,
    subListName: job.subListName,
    totalCount: job.tabs.length,
    savedCount,
    failed,
    closedTabs,
  };

  job.finishedAt = new Date().toISOString();
  await lastSaveReportItem.setValue({
    ...result,
    scope: job.scope,
    finishedAt: job.finishedAt,
  });
  await saveJobItem.setValue(null);

  return result;
}

export type SaveOptions = {
  scope: SaveScope;
  closeAfter: boolean;
  overrides?: SaveOverrides;
};

export async function saveTabsAsGroup(options: SaveOptions): Promise<SaveResult> {
  const tabs = await selectTabs(options.scope, options.overrides);
  if (tabs.length === 0) {
    throw new Error('No saveable tabs (http/https) found in this window.');
  }

  const job: SaveJob = {
    jobId: crypto.randomUUID(),
    scope: options.scope,
    closeAfter: options.closeAfter,
    subListId: null,
    subListName: `${formatTimestamp(new Date())} (${tabs.length} tabs)`,
    tabs: tabs.map(
      (tab): SaveJobTab => ({
        tabId: tab.id ?? null,
        url: tab.url!,
        title: tab.title ?? '',
        bookmarkId: null,
        state: 'pending',
        reason: null,
      }),
    ),
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  await saveJobItem.setValue(job);

  return runJob(job);
}

export async function getPendingJob(): Promise<SaveJob | null> {
  const job = await saveJobItem.getValue();
  if (!job || job.finishedAt) return null;
  return job;
}

export async function resumeSaveJob(): Promise<SaveResult> {
  const job = await getPendingJob();
  if (!job) {
    throw new Error('There is no unfinished save to resume.');
  }
  return runJob(job);
}

/**
 * Re-send only the tabs that failed in the last finished save.
 *
 * The job record is cleared once a save finishes, so the failures are recovered from the
 * saved report instead. The original sub-list is reused rather than created again: bookmark
 * creation is idempotent on the server (a duplicate URL returns the existing bookmark) but
 * list creation is not, so re-running the whole save would leave a second sub-list behind.
 */
export async function retryFailedTabs(): Promise<SaveResult> {
  const report = await lastSaveReportItem.getValue();
  if (!report || report.failed.length === 0) {
    throw new Error('There are no failed tabs to retry.');
  }
  if (!report.subListId) {
    throw new Error('The last save never created a group, so there is nothing to retry into.');
  }

  const job: SaveJob = {
    jobId: crypto.randomUUID(),
    scope: report.scope,
    closeAfter: false,
    subListId: report.subListId,
    subListName: report.subListName,
    tabs: report.failed.map(
      (failure): SaveJobTab => ({
        tabId: null,
        url: failure.url,
        title: '',
        bookmarkId: null,
        state: 'pending',
        reason: null,
      }),
    ),
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
  await saveJobItem.setValue(job);

  return runJob(job);
}
