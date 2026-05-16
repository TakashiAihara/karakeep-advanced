import { browser } from 'wxt/browser';
import { handle } from '@/src/messaging/handler';
import type { Response } from '@/src/messaging/schema';

const SAVE_PAGE_ID = 'karakeep-advanced:save-page';
const SAVE_SELECTED_ID = 'karakeep-advanced:save-selected';

function iconUrl(): string {
  return browser.runtime.getURL('/icon/128.png');
}

async function notify(title: string, message: string): Promise<void> {
  try {
    await browser.notifications.create({
      type: 'basic',
      iconUrl: iconUrl(),
      title,
      message,
    });
  } catch {
    console.warn('[karakeep-advanced] notification suppressed:', title, message);
  }
}

function describeSaveResponse(response: Response): string {
  if (response.type !== 'SAVED') {
    return response.type === 'ERROR' ? response.message : 'Unexpected response.';
  }
  const { result } = response;
  const base = `Saved ${result.savedCount}/${result.totalCount} → ${result.subListName}`;
  const failed = result.failed.length > 0 ? `, ${result.failed.length} failed` : '';
  return `${base}${failed}`;
}

async function saveCurrentPage(tabId: number): Promise<void> {
  const response = await handle({
    type: 'SAVE_WITHOUT_CLOSING',
    scope: 'single',
    overrides: { tabIds: [tabId], ignoreExcludePinned: true },
  });
  await notify('Karakeep Advanced', describeSaveResponse(response));
}

async function saveSelectedTabs(): Promise<void> {
  const response = await handle({
    type: 'SAVE_WITHOUT_CLOSING',
    scope: 'selected',
  });
  await notify('Karakeep Advanced', describeSaveResponse(response));
}

function createMenus(): void {
  browser.contextMenus.removeAll(() => {
    browser.contextMenus.create({
      id: SAVE_PAGE_ID,
      title: 'Save this page to Karakeep',
      contexts: ['page', 'frame'],
    });
    browser.contextMenus.create({
      id: SAVE_SELECTED_ID,
      title: 'Save selected tabs to Karakeep',
      contexts: ['page'],
    });
  });
}

export function registerContextMenus(): void {
  createMenus();
  browser.runtime.onInstalled.addListener(createMenus);

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === SAVE_PAGE_ID && tab?.id != null) {
      void saveCurrentPage(tab.id);
    } else if (info.menuItemId === SAVE_SELECTED_ID) {
      void saveSelectedTabs();
    }
  });
}
