import { storage } from 'wxt/utils/storage';

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

export type SaveJobTabState = 'pending' | 'bookmarked' | 'attached' | 'failed';

export type SaveJobTab = {
  tabId: number | null;
  url: string;
  title: string;
  bookmarkId: string | null;
  state: SaveJobTabState;
  reason: string | null;
};

/**
 * A save in flight.
 *
 * This exists because the MV3 service worker can be terminated mid-save. Without a
 * record, the bookmarks and sub-list already created in Karakeep become invisible to
 * the extension (recentGroupIds is only written at the very end) and a re-run creates
 * a second sub-list. Held in `session:` so it survives worker restarts but not a
 * browser restart — a job older than the browser session is not worth resuming.
 */
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

export const saveJobItem = storage.defineItem<SaveJob | null>('session:saveJob', {
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

export type CachedList = {
  id: string;
  name: string;
  parentId: string | null;
  description: string | null;
};

export type ListIndexCache = {
  lists: CachedList[];
  syncedAt: string;
};

/**
 * Mirror of GET /lists.
 *
 * `GET /lists` takes no query parameters at all (schema.d.ts: `query?: never`), so the
 * server cannot filter or paginate and every Recent render would otherwise refetch the
 * entire list set. This is a cache, never the authority — revalidate replaces it whole.
 */
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
