import { getKarakeep } from '@/src/karakeep/client';
import { updateCachedListName } from '@/src/karakeep/flows/list-recent-groups';
import {
  formatGroupDescription,
  parseGroupDescription,
  readGroupMetadata,
} from '@/src/karakeep/group-metadata';

export async function renameGroup(listId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Name must not be empty.');

  const client = getKarakeep();

  // Renaming is what destroys the tab count on any group saved before the metadata line
  // existed, because the count only lives in the old "(N tabs)" name convention. Reading it
  // here and writing it into the description migrates the group on the way past, so the
  // rename that used to lose the count is what preserves it. Groups that already carry a
  // metadata line are left alone: PATCH is documented as partial, so omitting description
  // is what keeps theirs intact.
  let description: string | undefined;
  const current = await client.GET('/lists/{listId}', { params: { path: { listId } } });
  if (current.data) {
    const stored = parseGroupDescription(current.data.description);
    if (stored.tabCount === null) {
      const migrated = readGroupMetadata(current.data.name, current.data.description);
      if (migrated.tabCount !== null) description = formatGroupDescription(migrated);
    }
  }

  const { error, response } = await client.PATCH('/lists/{listId}', {
    params: { path: { listId } },
    body: description === undefined ? { name: trimmed } : { name: trimmed, description },
  });
  if (error) {
    throw new Error(`Rename failed (HTTP ${response.status}).`);
  }

  await updateCachedListName(listId, trimmed);
}
