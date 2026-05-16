import { browser } from 'wxt/browser';
import { getKarakeep } from '@/src/karakeep/client';

const PAGE_LIMIT = 100;
const MAX_PAGES = 20;

export type OpenGroupTarget = 'current' | 'new';

export type OpenGroupResult = {
  opened: number;
  total: number;
  target: OpenGroupTarget;
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

export async function openGroup(
  listId: string,
  target: OpenGroupTarget = 'current',
): Promise<OpenGroupResult> {
  const urls = await fetchUrls(listId);
  if (urls.length === 0) {
    return { opened: 0, total: 0, target };
  }

  if (target === 'new') {
    await browser.windows.create({ url: urls });
    return { opened: urls.length, total: urls.length, target };
  }

  let opened = 0;
  for (const url of urls) {
    await browser.tabs.create({ url, active: false });
    opened++;
  }
  return { opened, total: urls.length, target };
}
