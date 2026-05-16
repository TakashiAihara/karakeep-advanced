import { browser } from 'wxt/browser';
import { configureKarakeep } from '@/src/karakeep/client';
import { saveTabsAsGroup } from '@/src/karakeep/flows/save-tabs-as-group';
import { searchBookmarks } from '@/src/karakeep/flows/search-bookmarks';
import { loadKarakeepConfig } from '@/src/storage/items';
import type { Request, Response } from './schema';

export async function handle(request: Request): Promise<Response> {
  const config = await loadKarakeepConfig();
  if (!config.serverUrl || !config.apiKey) {
    return {
      type: 'ERROR',
      code: 'UNCONFIGURED',
      message: 'Karakeep is not configured. Open Options to set the server URL and API key.',
    };
  }
  configureKarakeep(config);

  if (request.type === 'SAVE_AND_CLOSE' || request.type === 'SAVE_WITHOUT_CLOSING') {
    try {
      const result = await saveTabsAsGroup({
        scope: request.scope,
        closeAfter: request.type === 'SAVE_AND_CLOSE',
      });
      return { type: 'SAVED', result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = /no saveable tabs/i.test(message) ? 'NO_TABS' : 'KARAKEEP';
      return { type: 'ERROR', code, message };
    }
  }

  if (request.type === 'SEARCH') {
    try {
      const page = await searchBookmarks(request.q, { cursor: request.cursor });
      return { type: 'SEARCH_RESULT', hits: page.hits, nextCursor: page.nextCursor };
    } catch (err) {
      return {
        type: 'ERROR',
        code: 'KARAKEEP',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return { type: 'ERROR', message: 'Unknown request type.' };
}

export function registerMessageHandler(): void {
  browser.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    handle(request as Request)
      .then(sendResponse)
      .catch((err) =>
        sendResponse({
          type: 'ERROR',
          message: err instanceof Error ? err.message : String(err),
        } satisfies Response),
      );
    return true;
  });
}
