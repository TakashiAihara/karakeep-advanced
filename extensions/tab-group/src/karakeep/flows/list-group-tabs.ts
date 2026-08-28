import { getKarakeep } from '@/src/karakeep/client';
import type { GroupTab } from '@/src/messaging/schema';

const PAGE_LIMIT = 100;
const MAX_PAGES = 20;

/**
 * Read the bookmarks of one group.
 *
 * A bookmark reached this way may belong to several groups at once: Karakeep returns the
 * existing bookmark when the same URL is posted twice, so saving a URL into a second group
 * attaches the same record rather than copying it. Callers that offer a "remove" action must
 * therefore detach from the list rather than delete the bookmark.
 */
export async function listGroupTabs(listId: string): Promise<GroupTab[]> {
  const client = getKarakeep();
  const tabs: GroupTab[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error, response } = await client.GET('/lists/{listId}/bookmarks', {
      params: {
        path: { listId },
        query: { limit: PAGE_LIMIT, cursor, includeContent: false },
      },
    });
    if (error || !data) {
      throw new Error(
        `Failed to load bookmarks for list ${listId} (HTTP ${response.status}).`,
      );
    }
    for (const bookmark of data.bookmarks) {
      if (bookmark.content.type !== 'link') continue;
      tabs.push({
        bookmarkId: bookmark.id,
        url: bookmark.content.url,
        title: bookmark.title || bookmark.content.title || '',
      });
    }
    if (!data.nextCursor) break;
    cursor = data.nextCursor;
  }

  return tabs;
}

/**
 * Remove one bookmark from a group without deleting the bookmark itself.
 */
export async function detachFromGroup(listId: string, bookmarkId: string): Promise<void> {
  const client = getKarakeep();
  const { error, response } = await client.DELETE('/lists/{listId}/bookmarks/{bookmarkId}', {
    params: { path: { listId, bookmarkId } },
  });
  if (error && response.status !== 204) {
    throw new Error(`Failed to detach bookmark (HTTP ${response.status}).`);
  }
}
