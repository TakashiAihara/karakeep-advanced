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
  subListId: string;
  subListName: string;
  totalCount: number;
  savedCount: number;
  failed: SaveError[];
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
  | { type: 'LIST_RECENT_GROUPS'; limit?: number }
  | { type: 'OPEN_GROUP'; listId: string }
  | { type: 'IMPORT_ONETAB'; text: string }
  | { type: 'RENAME_GROUP'; listId: string; name: string }
  | { type: 'DELETE_GROUP'; listId: string };

export type Response =
  | { type: 'SAVED'; result: SaveResult }
  | { type: 'SEARCH_RESULT'; hits: SearchHit[]; nextCursor: string | null }
  | { type: 'RECENT_GROUPS'; groups: GroupSummary[] }
  | { type: 'OPENED'; opened: number; total: number }
  | { type: 'IMPORTED'; summary: ImportSummary }
  | { type: 'RENAMED'; listId: string; name: string }
  | { type: 'DELETED'; listId: string }
  | { type: 'ERROR'; message: string; code?: 'UNCONFIGURED' | 'NO_TABS' | 'KARAKEEP' };
