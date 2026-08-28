import { browser } from 'wxt/browser';
import { configureKarakeep } from '@/src/karakeep/client';
import { deleteGroup } from '@/src/karakeep/flows/delete-group';
import { importOneTabExport } from '@/src/karakeep/flows/import-onetab';
import { listGroupTabs } from '@/src/karakeep/flows/list-group-tabs';
import { listRecentGroups } from '@/src/karakeep/flows/list-recent-groups';
import { openGroup } from '@/src/karakeep/flows/open-group';
import { renameGroup } from '@/src/karakeep/flows/rename-group';
import {
  getPendingJob,
  resumeSaveJob,
  retryFailedTabs,
  saveTabsAsGroup,
} from '@/src/karakeep/flows/save-tabs-as-group';
import { searchBookmarks } from '@/src/karakeep/flows/search-bookmarks';
import { describeSaveResult, notify, NOTIFY_TITLE } from '@/src/util/notify';
import {
  consumeOnOpenItem,
  lastSaveReportItem,
  loadKarakeepConfig,
  saveJobItem,
} from '@/src/storage/items';
import type { Request, Response, SaveResult } from './schema';

function toErrorResponse(err: unknown): Extract<Response, { type: 'ERROR' }> {
  return {
    type: 'ERROR',
    code: 'KARAKEEP',
    message: err instanceof Error ? err.message : String(err),
  };
}

/**
 * Saves are reported by notification rather than only by the popup's own result UI.
 *
 * "Save and close" with scope=all takes the whole window down, which destroys the popup
 * before it can render anything, so on the most common path the in-popup result is
 * unreachable. The shortcut and context-menu paths already notified; this makes the popup
 * path behave the same.
 */
async function announceSave(result: SaveResult): Promise<void> {
  await notify(NOTIFY_TITLE, describeSaveResult(result));
}

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

  try {
    switch (request.type) {
      case 'SAVE_AND_CLOSE':
      case 'SAVE_WITHOUT_CLOSING': {
        try {
          const result = await saveTabsAsGroup({
            scope: request.scope,
            closeAfter: request.type === 'SAVE_AND_CLOSE',
            overrides: request.overrides,
          });
          await announceSave(result);
          return { type: 'SAVED', result };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          const code = /no saveable tabs/i.test(message) ? 'NO_TABS' : 'KARAKEEP';
          if (code === 'KARAKEEP') await notify(NOTIFY_TITLE, message);
          return { type: 'ERROR', code, message };
        }
      }

      case 'SEARCH': {
        const page = await searchBookmarks(request.q, { cursor: request.cursor });
        return { type: 'SEARCH_RESULT', hits: page.hits, nextCursor: page.nextCursor };
      }

      case 'LIST_RECENT_GROUPS': {
        const { groups, stale } = await listRecentGroups({
          limit: request.limit,
          refresh: request.refresh,
        });
        return { type: 'RECENT_GROUPS', groups, stale };
      }

      case 'LIST_GROUP_TABS': {
        const tabs = await listGroupTabs(request.listId);
        return { type: 'GROUP_TABS', listId: request.listId, tabs };
      }

      case 'OPEN_GROUP': {
        const consume = request.consume ?? (await consumeOnOpenItem.getValue());
        const result = await openGroup(request.listId, {
          target: request.target ?? 'current',
          consume,
        });
        return {
          type: 'OPENED',
          opened: result.opened,
          total: result.total,
          consumed: result.consumed,
        };
      }

      case 'IMPORT_ONETAB': {
        const summary = await importOneTabExport(request.text);
        return { type: 'IMPORTED', summary };
      }

      case 'RENAME_GROUP': {
        await renameGroup(request.listId, request.name);
        return { type: 'RENAMED', listId: request.listId, name: request.name.trim() };
      }

      case 'DELETE_GROUP': {
        await deleteGroup(request.listId);
        return { type: 'DELETED', listId: request.listId };
      }

      case 'GET_PENDING_JOB': {
        return { type: 'PENDING_JOB', job: await getPendingJob() };
      }

      case 'RESUME_JOB': {
        const result = await resumeSaveJob();
        await announceSave(result);
        return { type: 'SAVED', result };
      }

      case 'DISCARD_JOB': {
        await saveJobItem.setValue(null);
        return { type: 'PENDING_JOB', job: null };
      }

      case 'RETRY_FAILED': {
        const result = await retryFailedTabs();
        await announceSave(result);
        return { type: 'SAVED', result };
      }

      case 'GET_LAST_REPORT': {
        return { type: 'LAST_REPORT', report: await lastSaveReportItem.getValue() };
      }
    }
  } catch (err) {
    console.error('[karakeep-advanced] request failed', request.type, err);
    return toErrorResponse(err);
  }

  return { type: 'ERROR', message: 'Unknown request type.' };
}

export function registerMessageHandler(): void {
  browser.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    handle(request as Request)
      .then(sendResponse)
      .catch((err) => sendResponse(toErrorResponse(err)));
    return true;
  });
}
