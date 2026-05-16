import { getKarakeep } from '@/src/karakeep/client';
import type { components } from '@/src/karakeep/schema';
import { recentGroupIdsItem, tabGroupsListIdItem } from '@/src/storage/items';
import type { GroupSummary } from '@/src/messaging/schema';

type List = components['schemas']['List'];

const DEFAULT_LIMIT = 20;
const TAB_COUNT_PATTERN = /\((\d+)\s*tabs?\)\s*$/;

function summarize(list: List): GroupSummary {
  const match = list.name.match(TAB_COUNT_PATTERN);
  return {
    id: list.id,
    name: list.name,
    tabCount: match ? Number(match[1]) : null,
  };
}

export async function listRecentGroups(limit = DEFAULT_LIMIT): Promise<GroupSummary[]> {
  const [parentId, recentIds] = await Promise.all([
    tabGroupsListIdItem.getValue(),
    recentGroupIdsItem.getValue(),
  ]);
  if (!parentId) return [];

  const client = getKarakeep();
  const { data, error, response } = await client.GET('/lists');
  if (error || !data) {
    throw new Error(`Failed to fetch lists (HTTP ${response.status}).`);
  }

  const subLists = new Map<string, List>();
  for (const list of data.lists) {
    if (list.parentId === parentId) subLists.set(list.id, list);
  }

  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const id of recentIds) {
    if (subLists.has(id) && !seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }
  for (const id of subLists.keys()) {
    if (!seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }

  return ordered.slice(0, limit).map((id) => summarize(subLists.get(id)!));
}
