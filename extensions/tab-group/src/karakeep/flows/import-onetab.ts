import { getKarakeep } from '@/src/karakeep/client';
import { ensureTabGroupsList } from './ensure-tab-groups-list';
import { mapWithConcurrency } from '@/src/util/concurrency';
import { parseOneTabExport, type OneTabGroup } from '@/src/parsers/one-tab-export';
import { recentGroupIdsItem } from '@/src/storage/items';

const SUB_LIST_ICON = '📑';
const SOURCE = 'import' as const;
const REQUEST_CONCURRENCY = 3;
const RECENT_GROUP_HISTORY = 50;

export type ImportFailure = {
  url: string;
  reason: string;
};

export type ImportResult = {
  groupsImported: number;
  bookmarksCreated: number;
  failed: ImportFailure[];
};

async function pushRecentGroups(subListIds: readonly string[]): Promise<void> {
  if (subListIds.length === 0) return;
  const existing = await recentGroupIdsItem.getValue();
  const filtered = existing.filter((id) => !subListIds.includes(id));
  const updated = [...subListIds, ...filtered].slice(0, RECENT_GROUP_HISTORY);
  await recentGroupIdsItem.setValue(updated);
}

function subListNameFor(group: OneTabGroup, groupIndex: number): string {
  return `Imported from OneTab #${groupIndex + 1} (${group.entries.length} tabs)`;
}

async function loadSubListsByName(parentId: string): Promise<Map<string, string>> {
  const { data, error, response } = await getKarakeep().GET('/lists');
  if (error || !data) {
    throw new Error(`Failed to list Karakeep lists (HTTP ${response.status}).`);
  }

  const byName = new Map<string, string>();
  for (const list of data.lists) {
    if (list.parentId === parentId && !byName.has(list.name)) {
      byName.set(list.name, list.id);
    }
  }
  return byName;
}

async function importGroup(
  parentId: string,
  group: OneTabGroup,
  groupIndex: number,
  existingByName: ReadonlyMap<string, string>,
): Promise<{ subListId: string | null; createdCount: number; failed: ImportFailure[] }> {
  const client = getKarakeep();

  const subListName = subListNameFor(group, groupIndex);
  // bookmarks and attaches are idempotent but list creation is not, so re-running the
  // same export must land in the sub-list it already produced
  let subListId = existingByName.get(subListName) ?? null;

  if (!subListId) {
    const created = await client.POST('/lists', {
      body: {
        name: subListName,
        icon: SUB_LIST_ICON,
        type: 'manual',
        parentId,
      },
    });
    if (created.error || !created.data) {
      return {
        subListId: null,
        createdCount: 0,
        failed: group.entries.map((entry) => ({
          url: entry.url,
          reason: `sub-list create failed (HTTP ${created.response.status})`,
        })),
      };
    }
    subListId = created.data.id;
  }

  const listId = subListId;
  const failed: ImportFailure[] = [];
  let createdCount = 0;

  await mapWithConcurrency(
    group.entries,
    async (entry) => {
      const bookmark = await client.POST('/bookmarks', {
        body: {
          type: 'link',
          url: entry.url,
          title: entry.title,
          source: SOURCE,
        },
      });
      if (bookmark.error || !bookmark.data) {
        failed.push({
          url: entry.url,
          reason: `bookmark create failed (HTTP ${bookmark.response.status})`,
        });
        return;
      }

      const attach = await client.PUT('/lists/{listId}/bookmarks/{bookmarkId}', {
        params: { path: { listId, bookmarkId: bookmark.data.id } },
      });
      if (attach.error) {
        failed.push({
          url: entry.url,
          reason: `attach failed (HTTP ${attach.response.status})`,
        });
        return;
      }
      createdCount++;
    },
    REQUEST_CONCURRENCY,
  );

  return { subListId: listId, createdCount, failed };
}

export async function importOneTabExport(text: string): Promise<ImportResult> {
  const groups = parseOneTabExport(text);
  if (groups.length === 0) {
    throw new Error('No groups found in the OneTab export.');
  }

  const parentId = await ensureTabGroupsList();
  const existingByName = await loadSubListsByName(parentId);

  const failed: ImportFailure[] = [];
  let bookmarksCreated = 0;
  const newSubListIds: string[] = [];
  let groupsImported = 0;

  for (let i = 0; i < groups.length; i++) {
    const outcome = await importGroup(parentId, groups[i]!, i, existingByName);
    if (outcome.subListId) {
      groupsImported++;
      newSubListIds.push(outcome.subListId);
    }
    bookmarksCreated += outcome.createdCount;
    failed.push(...outcome.failed);
  }

  await pushRecentGroups(newSubListIds);

  return { groupsImported, bookmarksCreated, failed };
}
