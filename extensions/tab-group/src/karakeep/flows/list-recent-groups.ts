import { getKarakeep } from '@/src/karakeep/client';
import { readGroupMetadata } from '@/src/karakeep/group-metadata';
import type { components } from '@/src/karakeep/schema';
import type { GroupSummary } from '@/src/messaging/schema';
import {
  isCacheFresh,
  listIndexCacheItem,
  recentGroupIdsItem,
  tabGroupsListIdItem,
  type CachedList,
} from '@/src/storage/items';

type List = components['schemas']['List'];

const DEFAULT_LIMIT = 20;

export type RecentGroups = {
  groups: GroupSummary[];
  stale: boolean;
};

export type ListRecentGroupsOptions = {
  limit?: number;
  refresh?: boolean;
};

export function summarizeGroup(list: CachedList): GroupSummary {
  const meta = readGroupMetadata(list.name, list.description);
  return {
    id: list.id,
    name: list.name,
    tabCount: meta.tabCount,
    savedAt: meta.savedAt,
    lastOpenedAt: meta.lastOpenedAt,
  };
}

function toCachedList(list: List): CachedList {
  return {
    id: list.id,
    name: list.name,
    parentId: list.parentId,
    description: list.description ?? null,
  };
}

function orderGroups(
  lists: CachedList[],
  parentId: string,
  recentIds: string[],
  limit: number,
): GroupSummary[] {
  const subLists = new Map<string, CachedList>();
  for (const list of lists) {
    if (list.parentId === parentId) subLists.set(list.id, list);
  }

  const ordered: CachedList[] = [];
  const seen = new Set<string>();
  for (const id of recentIds) {
    const list = subLists.get(id);
    if (list && !seen.has(id)) {
      ordered.push(list);
      seen.add(id);
    }
  }
  for (const [id, list] of subLists) {
    if (!seen.has(id)) {
      ordered.push(list);
      seen.add(id);
    }
  }

  return ordered.slice(0, limit).map(summarizeGroup);
}

async function fetchLists(): Promise<CachedList[]> {
  const client = getKarakeep();
  const { data, error, response } = await client.GET('/lists');
  if (error || !data) {
    throw new Error(`Failed to fetch lists (HTTP ${response.status}).`);
  }
  return data.lists.map(toCachedList);
}

// GET /lists takes no query parameters, so every Recent render would otherwise refetch every
// list. Serve the cache while it is fresh and let the caller force a refetch; `stale` says
// which of the two it got. A cached render also beats an error when the server is unreachable.
export async function listRecentGroups(
  options: ListRecentGroupsOptions = {},
): Promise<RecentGroups> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const [parentId, recentIds, cache] = await Promise.all([
    tabGroupsListIdItem.getValue(),
    recentGroupIdsItem.getValue(),
    listIndexCacheItem.getValue(),
  ]);
  if (!parentId) return { groups: [], stale: false };

  if (!options.refresh && cache && isCacheFresh(cache.syncedAt, Date.now())) {
    return { groups: orderGroups(cache.lists, parentId, recentIds, limit), stale: true };
  }

  let lists: CachedList[];
  try {
    lists = await fetchLists();
  } catch (e) {
    if (!cache) throw e;
    return { groups: orderGroups(cache.lists, parentId, recentIds, limit), stale: true };
  }

  await listIndexCacheItem.setValue({ lists, syncedAt: new Date().toISOString() });
  return { groups: orderGroups(lists, parentId, recentIds, limit), stale: false };
}

export async function updateCachedListName(listId: string, name: string): Promise<void> {
  const cache = await listIndexCacheItem.getValue();
  if (!cache) return;

  let changed = false;
  const lists = cache.lists.map((list) => {
    if (list.id !== listId || list.name === name) return list;
    changed = true;
    return { ...list, name };
  });
  if (!changed) return;

  await listIndexCacheItem.setValue({ ...cache, lists });
}

/**
 * Drop one list from the cached index.
 *
 * orderGroups appends every cached sub-list under the parent regardless of recentGroupIds,
 * so pruning that array is not enough to stop a deleted group from being offered — clicking
 * it then 404s on GET /lists/{id}/bookmarks.
 */
export async function forgetCachedList(listId: string): Promise<void> {
  const cache = await listIndexCacheItem.getValue();
  if (!cache) return;

  const lists = cache.lists.filter((list) => list.id !== listId);
  if (lists.length === cache.lists.length) return;

  await listIndexCacheItem.setValue({ ...cache, lists });
}
