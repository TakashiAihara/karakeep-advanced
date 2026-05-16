import { getKarakeep } from '@/src/karakeep/client';

export async function renameGroup(listId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Name must not be empty.');

  const client = getKarakeep();
  const { error, response } = await client.PATCH('/lists/{listId}', {
    params: { path: { listId } },
    body: { name: trimmed },
  });
  if (error) {
    throw new Error(`Rename failed (HTTP ${response.status}).`);
  }
}
