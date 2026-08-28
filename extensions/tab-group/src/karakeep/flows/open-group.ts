import { browser } from 'wxt/browser';
import { getKarakeep } from '@/src/karakeep/client';
import { formatGroupDescription, readGroupMetadata } from '@/src/karakeep/group-metadata';
import { deleteGroup } from './delete-group';

const PAGE_LIMIT = 100;
const MAX_PAGES = 20;

export type OpenGroupTarget = 'current' | 'new';

export type OpenGroupResult = {
  opened: number;
  total: number;
  target: OpenGroupTarget;
  consumed: boolean;
};

async function fetchUrls(listId: string): Promise<string[]> {
  const client = getKarakeep();
  const urls: string[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error, response } = await client.GET('/lists/{listId}/bookmarks', {
      params: {
        path: { listId },
        query: { limit: PAGE_LIMIT, cursor, includeContent: false },
      },
    });
    if (error || !data) {
      throw new Error(`Failed to load bookmarks for list ${listId} (HTTP ${response.status}).`);
    }
    for (const bookmark of data.bookmarks) {
      if (bookmark.content.type === 'link') urls.push(bookmark.content.url);
    }
    if (!data.nextCursor) break;
    cursor = data.nextCursor;
  }

  return urls;
}

async function touchLastOpened(listId: string, openedAt: string): Promise<void> {
  const client = getKarakeep();
  const current = await client.GET('/lists/{listId}', { params: { path: { listId } } });
  if (current.error || !current.data) return;

  const meta = readGroupMetadata(current.data.name, current.data.description);
  await client.PATCH('/lists/{listId}', {
    params: { path: { listId } },
    body: {
      description: formatGroupDescription({ ...meta, lastOpenedAt: openedAt }),
    },
  });
}

export type OpenGroupOptions = {
  target?: OpenGroupTarget;
  consume?: boolean;
};

export async function openGroup(
  listId: string,
  options: OpenGroupOptions = {},
): Promise<OpenGroupResult> {
  const target = options.target ?? 'current';
  const urls = await fetchUrls(listId);
  if (urls.length === 0) {
    return { opened: 0, total: 0, target, consumed: false };
  }

  let opened = 0;
  if (target === 'new') {
    await browser.windows.create({ url: urls });
    opened = urls.length;
  } else {
    for (const url of urls) {
      await browser.tabs.create({ url, active: false });
      opened++;
    }
  }

  // Only consume once every tab is actually open. Deleting first would turn a failure
  // halfway through opening into a group that is gone and only partly restored.
  let consumed = false;
  if (options.consume && opened === urls.length) {
    await deleteGroup(listId);
    consumed = true;
  } else {
    // Recording this is what lets auto-archive tell a group that is still in use from one
    // that has been sitting untouched. Failing to record it must not fail the restore.
    try {
      await touchLastOpened(listId, new Date().toISOString());
    } catch (err) {
      console.error('[karakeep-advanced] failed to record lastOpenedAt', err);
    }
  }

  return { opened, total: urls.length, target, consumed };
}
