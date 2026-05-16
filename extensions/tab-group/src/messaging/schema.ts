export type SaveScope = 'all' | 'others' | 'selected';

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

export type Request =
  | { type: 'SAVE_AND_CLOSE'; scope: SaveScope }
  | { type: 'SAVE_WITHOUT_CLOSING'; scope: SaveScope }
  | { type: 'SEARCH'; q: string; cursor?: string };

export type Response =
  | { type: 'SAVED'; result: SaveResult }
  | { type: 'SEARCH_RESULT'; hits: SearchHit[]; nextCursor: string | null }
  | { type: 'ERROR'; message: string; code?: 'UNCONFIGURED' | 'NO_TABS' | 'KARAKEEP' };
