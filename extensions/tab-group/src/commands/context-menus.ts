import { browser } from 'wxt/browser';
import { handle } from '@/src/messaging/handler';

const SAVE_PAGE_ID = 'karakeep-advanced:save-page';
const SAVE_SELECTED_ID = 'karakeep-advanced:save-selected';

async function saveCurrentPage(tabId: number): Promise<void> {
  // handle() notifies; announcing here as well produced two toasts per click
  await handle({
    type: 'SAVE_WITHOUT_CLOSING',
    scope: 'single',
    overrides: { tabIds: [tabId], ignoreExcludePinned: true },
  });
}

async function saveSelectedTabs(): Promise<void> {
  await handle({
    type: 'SAVE_WITHOUT_CLOSING',
    scope: 'selected',
  });
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
