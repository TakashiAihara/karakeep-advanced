import { getKarakeep } from '@/src/karakeep/client';
import type { SearchHit } from '@/src/messaging/schema';

export type SearchPageResult = {
  hits: SearchHit[];
  nextCursor: string | null;
};

export async function searchBookmarks(
  q: string,
  options: { cursor?: string; limit?: number } = {},
): Promise<SearchPageResult> {
  const client = getKarakeep();
  const { data, error, response } = await client.GET('/bookmarks/search', {
    params: {
      query: {
        q,
        limit: options.limit ?? 50,
        cursor: options.cursor,
        includeContent: false,
      },
    },
  });
  if (error || !data) {
    throw new Error(`Bookmark search failed (HTTP ${response.status}).`);
  }

  const hits: SearchHit[] = [];
  for (const bookmark of data.bookmarks) {
    if (bookmark.content.type !== 'link') continue;
    const link = bookmark.content;
    hits.push({
      id: bookmark.id,
      title: bookmark.title ?? link.title ?? link.url,
      url: link.url,
      faviconUrl: link.favicon ?? null,
    });
  }
  return { hits, nextCursor: data.nextCursor };
}
