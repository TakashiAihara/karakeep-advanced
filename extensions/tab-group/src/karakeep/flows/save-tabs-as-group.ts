import { browser } from 'wxt/browser';
import { ensureTabGroupsList } from './ensure-tab-groups-list';
import { getKarakeep } from '@/src/karakeep/client';
import type { SaveError, SaveResult, SaveScope } from '@/src/messaging/schema';
import { excludePinnedItem, recentGroupIdsItem } from '@/src/storage/items';
import { mapWithConcurrency } from '@/src/util/concurrency';
import { selectSaveableTabs } from '@/src/util/saveable-tabs';

const SUB_LIST_ICON = '📑';
const SOURCE = 'extension' as const;
const REQUEST_CONCURRENCY = 3;
const RECENT_GROUP_HISTORY = 50;

function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

async function selectTabs(scope: SaveScope) {
  const [allTabs, excludePinned] = await Promise.all([
    browser.tabs.query({ currentWindow: true }),
    excludePinnedItem.getValue(),
  ]);
  return selectSaveableTabs(allTabs, scope, { excludePinned });
}

async function pushRecentGroup(subListId: string): Promise<void> {
  const recent = await recentGroupIdsItem.getValue();
  const updated = [subListId, ...recent.filter((id) => id !== subListId)].slice(
    0,
    RECENT_GROUP_HISTORY,
  );
  await recentGroupIdsItem.setValue(updated);
}

export type SaveOptions = {
  scope: SaveScope;
  closeAfter: boolean;
};

export async function saveTabsAsGroup(options: SaveOptions): Promise<SaveResult> {
  const tabs = await selectTabs(options.scope);
  if (tabs.length === 0) {
    throw new Error('No saveable tabs (http/https) found in this window.');
  }

  const parentId = await ensureTabGroupsList();
  const client = getKarakeep();

  const subListName = `${formatTimestamp(new Date())} (${tabs.length} tabs)`;
  const created = await client.POST('/lists', {
    body: {
      name: subListName,
      icon: SUB_LIST_ICON,
      type: 'manual',
      parentId,
    },
  });
  if (created.error || !created.data) {
    throw new Error(
      `Failed to create sub-list "${subListName}" (HTTP ${created.response.status}).`,
    );
  }
  const subListId = created.data.id;

  type BookmarkOutcome = { tabId: number | undefined; url: string; bookmarkId?: string; error?: string };

  const bookmarks = await mapWithConcurrency<typeof tabs[number], BookmarkOutcome>(
    tabs,
    async (tab) => {
      const url = tab.url!;
      const { data, error, response } = await client.POST('/bookmarks', {
        body: {
          type: 'link',
          url,
          title: tab.title || undefined,
          source: SOURCE,
        },
      });
      if (error || !data) {
        return {
          tabId: tab.id,
          url,
          error: `create failed (HTTP ${response.status})`,
        };
      }
      return { tabId: tab.id, url, bookmarkId: data.id };
    },
    REQUEST_CONCURRENCY,
  );

  const failed: SaveError[] = [];

  await mapWithConcurrency(
    bookmarks,
    async (outcome) => {
      if (!outcome.bookmarkId) {
        failed.push({ url: outcome.url, reason: outcome.error ?? 'unknown error' });
        return;
      }
      const { error, response } = await client.PUT(
        '/lists/{listId}/bookmarks/{bookmarkId}',
        {
          params: { path: { listId: subListId, bookmarkId: outcome.bookmarkId } },
        },
      );
      if (error) {
        failed.push({
          url: outcome.url,
          reason: `attach failed (HTTP ${response.status})`,
        });
      }
    },
    REQUEST_CONCURRENCY,
  );

  await pushRecentGroup(subListId);

  let closedTabs = 0;
  if (options.closeAfter && failed.length === 0) {
    const ids = tabs
      .map((t) => t.id)
      .filter((id): id is number => typeof id === 'number');
    if (ids.length > 0) {
      await browser.tabs.remove(ids);
      closedTabs = ids.length;
    }
  }

  return {
    subListId,
    subListName,
    totalCount: tabs.length,
    savedCount: tabs.length - failed.length,
    failed,
    closedTabs,
  };
}
