import { tabGroupsListIdItem } from '@/src/storage/items';
import { getKarakeep } from '@/src/karakeep/client';

export const PARENT_LIST_NAME = 'Tab Groups';
export const PARENT_LIST_ICON = '📑';

export async function ensureTabGroupsList(): Promise<string> {
  const cached = await tabGroupsListIdItem.getValue();
  if (cached) return cached;

  const client = getKarakeep();
  const { data, error, response } = await client.GET('/lists');
  if (error || !data) {
    throw new Error(`Failed to list Karakeep lists (HTTP ${response.status}).`);
  }

  const existing = data.lists.find(
    (l) => !l.parentId && l.name === PARENT_LIST_NAME && l.type === 'manual',
  );
  if (existing) {
    await tabGroupsListIdItem.setValue(existing.id);
    return existing.id;
  }

  const created = await client.POST('/lists', {
    body: {
      name: PARENT_LIST_NAME,
      icon: PARENT_LIST_ICON,
      type: 'manual',
    },
  });
  if (created.error || !created.data) {
    throw new Error(
      `Failed to create parent list "${PARENT_LIST_NAME}" (HTTP ${created.response.status}).`,
    );
  }
  await tabGroupsListIdItem.setValue(created.data.id);
  return created.data.id;
}
