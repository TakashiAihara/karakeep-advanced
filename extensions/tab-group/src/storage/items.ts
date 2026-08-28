import { storage } from 'wxt/utils/storage';
import type { SaveJob } from './save-job';
import type { ListIndexCache } from './list-cache';

export type { SaveJob, SaveJobTab, SaveJobTabState } from './save-job';
export { isJobStale, SAVE_JOB_MAX_AGE_MS } from './save-job';
export type { CachedList, ListIndexCache } from './list-cache';
export { isCacheFresh, LIST_CACHE_TTL_MS } from './list-cache';

export const serverUrlItem = storage.defineItem<string>('local:serverUrl', {
  fallback: '',
});

export const apiKeyItem = storage.defineItem<string>('local:apiKey', {
  fallback: '',
});

export const tabGroupsListIdItem = storage.defineItem<string | null>(
  'local:tabGroupsListId',
  { fallback: null },
);

export const recentGroupIdsItem = storage.defineItem<string[]>(
  'local:recentGroupIds',
  { fallback: [] },
);

export const excludePinnedItem = storage.defineItem<boolean>('local:excludePinned', {
  fallback: true,
});

/**
 * Whether "Open all" removes the group afterwards.
 *
 * Default is false (keep). Karakeep is an archive first: losing a group because a
 * restore misfired is worse than accumulating groups, and D04 gives the user an
 * explicit per-row consume action instead. See docs/design/decisions.md D01.
 */
export const consumeOnOpenItem = storage.defineItem<boolean>('local:consumeOnOpen', {
  fallback: false,
});

export const saveJobItem = storage.defineItem<SaveJob | null>('local:saveJob', {
  fallback: null,
});

export type SaveReport = {
  jobId: string;
  subListId: string | null;
  subListName: string;
  scope: string;
  savedCount: number;
  totalCount: number;
  closedTabs: number;
  failed: { url: string; reason: string }[];
  finishedAt: string;
};

/**
 * The last finished save, kept so a half-failure is still diagnosable after the popup
 * closes. The popup is destroyed whenever "save and close" takes the whole window with
 * it, so the in-popup result UI is unreachable on the most common path.
 */
export const lastSaveReportItem = storage.defineItem<SaveReport | null>(
  'local:lastSaveReport',
  { fallback: null },
);

export const listIndexCacheItem = storage.defineItem<ListIndexCache | null>(
  'local:listIndexCache',
  { fallback: null },
);

export async function loadKarakeepConfig(): Promise<{ serverUrl: string; apiKey: string }> {
  const [serverUrl, apiKey] = await Promise.all([
    serverUrlItem.getValue(),
    apiKeyItem.getValue(),
  ]);
  return { serverUrl, apiKey };
}
