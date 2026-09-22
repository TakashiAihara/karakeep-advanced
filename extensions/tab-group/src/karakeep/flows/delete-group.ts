import { getKarakeep } from '@/src/karakeep/client';
import { forgetCachedList } from '@/src/karakeep/flows/list-recent-groups';
import { recentGroupIdsItem } from '@/src/storage/items';

export async function deleteGroup(listId: string): Promise<void> {
  const client = getKarakeep();
  const { error, response } = await client.DELETE('/lists/{listId}', {
    params: { path: { listId } },
  });
  if (error && response.status !== 204) {
    throw new Error(`Delete failed (HTTP ${response.status}).`);
  }

  await forgetCachedList(listId);

  const recent = await recentGroupIdsItem.getValue();
  const filtered = recent.filter((id) => id !== listId);
  if (filtered.length !== recent.length) {
    await recentGroupIdsItem.setValue(filtered);
  }
}
