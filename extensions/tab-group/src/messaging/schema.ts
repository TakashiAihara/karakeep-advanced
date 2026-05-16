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

export type Request =
  | { type: 'SAVE_AND_CLOSE'; scope: SaveScope }
  | { type: 'SAVE_WITHOUT_CLOSING'; scope: SaveScope };

export type Response =
  | { type: 'SAVED'; result: SaveResult }
  | { type: 'ERROR'; message: string; code?: 'UNCONFIGURED' | 'NO_TABS' | 'KARAKEEP' };
