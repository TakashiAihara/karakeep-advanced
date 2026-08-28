import { getKarakeep } from '@/src/karakeep/client';
import { updateCachedListName } from '@/src/karakeep/flows/list-recent-groups';

export async function renameGroup(listId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Name must not be empty.');

  const client = getKarakeep();
  // schema.d.ts updateList documents the body as partial ("Only the fields you want to change
  // need to be provided"), so leaving description out is what preserves the metadata line.
  const { error, response } = await client.PATCH('/lists/{listId}', {
    params: { path: { listId } },
    body: { name: trimmed },
  });
  if (error) {
    throw new Error(`Rename failed (HTTP ${response.status}).`);
  }

  await updateCachedListName(listId, trimmed);
}
