import type { SaveJob, SaveReport } from '@/src/storage/items';

export type SaveScope = 'all' | 'others' | 'selected' | 'single';

export type SaveOverrides = {
  tabIds?: number[];
  ignoreExcludePinned?: boolean;
};

export type SaveError = {
  url: string;
  reason: string;
};

export type SaveResult = {
  jobId: string;
  subListId: string;
  subListName: string;
  totalCount: number;
  savedCount: number;
  failed: SaveError[];
  /** Whether the caller asked for the tabs to be closed, not whether any were. */
  closeAfter: boolean;
  closedTabs: number;
};

export type SearchHit = {
  id: string;
  title: string;
  url: string;
  faviconUrl: string | null;
};

export type GroupSummary = {
  id: string;
  name: string;
  tabCount: number | null;
  savedAt: string | null;
  lastOpenedAt: string | null;
};

export type GroupTab = {
  bookmarkId: string;
  url: string;
  title: string;
};

export type ImportFailure = {
  url: string;
  reason: string;
};

export type ImportSummary = {
  groupsImported: number;
  bookmarksCreated: number;
  failed: ImportFailure[];
};

export type Request =
  | { type: 'SAVE_AND_CLOSE'; scope: SaveScope; overrides?: SaveOverrides }
  | { type: 'SAVE_WITHOUT_CLOSING'; scope: SaveScope; overrides?: SaveOverrides }
  | { type: 'SEARCH'; q: string; cursor?: string }
  | { type: 'LIST_RECENT_GROUPS'; limit?: number; refresh?: boolean }
  | { type: 'LIST_GROUP_TABS'; listId: string }
  | { type: 'OPEN_GROUP'; listId: string; target?: 'current' | 'new'; consume?: boolean }
  | { type: 'IMPORT_ONETAB'; text: string }
  | { type: 'RENAME_GROUP'; listId: string; name: string }
  | { type: 'DELETE_GROUP'; listId: string }
  | { type: 'GET_PENDING_JOB' }
  | { type: 'RESUME_JOB' }
  | { type: 'DISCARD_JOB' }
  | { type: 'RETRY_FAILED' }
  | { type: 'GET_LAST_REPORT' };

export type Response =
  | { type: 'SAVED'; result: SaveResult }
  | { type: 'SEARCH_RESULT'; hits: SearchHit[]; nextCursor: string | null }
  | { type: 'RECENT_GROUPS'; groups: GroupSummary[]; stale: boolean }
  | { type: 'GROUP_TABS'; listId: string; tabs: GroupTab[] }
  | { type: 'OPENED'; opened: number; total: number; consumed: boolean }
  | { type: 'IMPORTED'; summary: ImportSummary }
  | { type: 'RENAMED'; listId: string; name: string }
  | { type: 'DELETED'; listId: string }
  | { type: 'PENDING_JOB'; job: SaveJob | null }
  | { type: 'LAST_REPORT'; report: SaveReport | null }
  | { type: 'ERROR'; message: string; code?: 'UNCONFIGURED' | 'NO_TABS' | 'KARAKEEP' };
