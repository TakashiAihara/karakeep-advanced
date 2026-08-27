import { test, expect } from '../fixtures/extension';
import type { Worker } from '@playwright/test';

async function seedTabGroupsListId(serviceWorker: Worker, parentId: string): Promise<void> {
  await serviceWorker.evaluate(
    (args: { id: string }) =>
      // @ts-expect-error chrome global is available inside the extension service worker
      chrome.storage.local.set({ tabGroupsListId: args.id }),
    { id: parentId },
  );
}

test('Selected scope saves only highlighted tabs', async ({
  context,
  extensionId,
  serviceWorker,
  configuredMock,
}) => {
  const a = await context.newPage();
  await a.goto(`${configuredMock.url}/page/a`);
  const b = await context.newPage();
  await b.goto(`${configuredMock.url}/page/b`);
  const c = await context.newPage();
  await c.goto(`${configuredMock.url}/page/c`);

  // Under Playwright the popup runs as an ordinary tab, so opening it after
  // highlighting would reset the highlighted set to the popup alone. Open it
  // blank first, then highlight [popup, a, b] in one call: the first index
  // stays active (so Playwright keeps driving a foreground tab) and the
  // popup's chrome-extension:// URL is dropped by the saveable-URL filter,
  // leaving exactly a and b as the selected scope. Navigate to popup.html
  // only afterwards, because the popup snapshots tabs on mount.
  const popup = await context.newPage();

  const highlighted = await serviceWorker.evaluate(async () => {
    // @ts-expect-error chrome global is available inside the extension service worker
    const win = await chrome.windows.getCurrent();
    const all: Array<{ index: number; url?: string; active?: boolean }> =
      // @ts-expect-error chrome global
      await chrome.tabs.query({ windowId: win.id });
    const popupTab = all.find((t) => t.active);
    if (!popupTab) throw new Error('no active tab to use as the popup host');
    const pageTabs = all.filter((t) => /\/page\/(a|b)$/.test(t.url ?? ''));
    // @ts-expect-error chrome global
    await chrome.tabs.highlight({
      windowId: win.id,
      tabs: [popupTab.index, ...pageTabs.map((t) => t.index)],
    });
    const after: Array<{ url?: string }> =
      // @ts-expect-error chrome global
      await chrome.tabs.query({ windowId: win.id, highlighted: true });
    return after.map((t) => t.url ?? '');
  });

  // Guard the fixture itself: only a and b may reach the extension as
  // http(s) highlighted tabs, otherwise the assertion below proves nothing.
  expect(highlighted.filter((u) => u.startsWith('http')).sort()).toEqual(
    [`${configuredMock.url}/page/a`, `${configuredMock.url}/page/b`].sort(),
  );

  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  await popup.getByRole('radio', { name: /Selected/ }).click();
  await expect(popup.locator('.count')).toContainText('2 selected tabs will be saved');

  await popup.getByRole('button', { name: 'Save without closing' }).click();
  await expect(popup.locator('.status.success')).toContainText(/Saved 2\/2/);

  const subLists = [...configuredMock.store.lists.values()].filter((l) => l.parentId != null);
  expect(subLists).toHaveLength(1);
  const attached = configuredMock.store.listBookmarks.get(subLists[0]!.id);
  const urls = [...attached!]
    .map((bid) => configuredMock.store.bookmarks.get(bid)!.content.url)
    .sort();
  expect(urls).toEqual(
    [`${configuredMock.url}/page/a`, `${configuredMock.url}/page/b`].sort(),
  );
});

test('Rename updates the sub-list name via PATCH', async ({
  context,
  extensionId,
  serviceWorker,
  configuredMock,
}) => {
  // Seed a sub-list with a known starting name.
  const parentId = 'list-parent';
  configuredMock.store.lists.set(parentId, {
    id: parentId,
    name: 'Tab Groups',
    description: null,
    icon: '📑',
    parentId: null,
    type: 'manual',
    query: null,
    public: false,
    hasCollaborators: false,
    userRole: 'owner',
  });
  configuredMock.store.listBookmarks.set(parentId, new Set());
  const subId = 'list-sub';
  configuredMock.store.lists.set(subId, {
    id: subId,
    name: '2026-05-17 10:00 (3 tabs)',
    description: null,
    icon: '📑',
    parentId,
    type: 'manual',
    query: null,
    public: false,
    hasCollaborators: false,
    userRole: 'owner',
  });
  configuredMock.store.listBookmarks.set(subId, new Set());
  await seedTabGroupsListId(serviceWorker, parentId);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('tab', { name: 'Recent' }).click();

  const row = popup.locator('.recent-item').first();
  await expect(row).toContainText('(3 tabs)');

  await row.getByRole('button', { name: 'Rename' }).click();
  const input = row.locator('input.recent-edit');
  await input.fill('Renamed group');
  await input.press('Enter');

  await expect(popup.locator('.recent-item').first()).toContainText('Renamed group');
  expect(configuredMock.store.lists.get(subId)?.name).toBe('Renamed group');
});

test('Delete removes the sub-list via DELETE and drops it from Recent', async ({
  context,
  extensionId,
  serviceWorker,
  configuredMock,
}) => {
  const parentId = 'list-parent';
  configuredMock.store.lists.set(parentId, {
    id: parentId,
    name: 'Tab Groups',
    description: null,
    icon: '📑',
    parentId: null,
    type: 'manual',
    query: null,
    public: false,
    hasCollaborators: false,
    userRole: 'owner',
  });
  configuredMock.store.listBookmarks.set(parentId, new Set());
  const subId = 'list-sub';
  configuredMock.store.lists.set(subId, {
    id: subId,
    name: '2026-05-17 11:00 (2 tabs)',
    description: null,
    icon: '📑',
    parentId,
    type: 'manual',
    query: null,
    public: false,
    hasCollaborators: false,
    userRole: 'owner',
  });
  configuredMock.store.listBookmarks.set(subId, new Set());
  await seedTabGroupsListId(serviceWorker, parentId);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('tab', { name: 'Recent' }).click();

  await expect(popup.locator('.recent-item')).toHaveCount(1);

  popup.once('dialog', (d) => void d.accept());
  await popup.locator('.recent-item').first().getByRole('button', { name: 'Delete' }).click();

  await expect(popup.locator('.recent-item')).toHaveCount(0);
  expect(configuredMock.store.lists.has(subId)).toBe(false);
});

test('Open all into a new window pops a fresh chromium window', async ({
  context,
  extensionId,
  serviceWorker,
  configuredMock,
}) => {
  // Seed a sub-list with two bookmarks attached so Open all has something to open.
  const parentId = 'list-parent';
  configuredMock.store.lists.set(parentId, {
    id: parentId,
    name: 'Tab Groups',
    description: null,
    icon: '📑',
    parentId: null,
    type: 'manual',
    query: null,
    public: false,
    hasCollaborators: false,
    userRole: 'owner',
  });
  configuredMock.store.listBookmarks.set(parentId, new Set());
  const subId = 'list-sub';
  configuredMock.store.lists.set(subId, {
    id: subId,
    name: '2026-05-17 12:00 (2 tabs)',
    description: null,
    icon: '📑',
    parentId,
    type: 'manual',
    query: null,
    public: false,
    hasCollaborators: false,
    userRole: 'owner',
  });
  configuredMock.store.listBookmarks.set(subId, new Set(['bm-x', 'bm-y']));
  const baseBookmark = {
    createdAt: new Date().toISOString(),
    modifiedAt: null,
    title: null,
    archived: false,
    favourited: false,
    taggingStatus: null,
    summarizationStatus: null,
    note: null,
    summary: null,
    source: 'extension' as const,
    userId: 'u1',
    tags: [] as never[],
  };
  configuredMock.store.bookmarks.set('bm-x', {
    id: 'bm-x',
    ...baseBookmark,
    content: {
      type: 'link',
      url: `${configuredMock.url}/page/x`,
      title: null,
      description: null,
      imageUrl: null,
      imageAssetId: null,
      screenshotAssetId: null,
      pdfAssetId: null,
      fullPageArchiveAssetId: null,
      precrawledArchiveAssetId: null,
      videoAssetId: null,
      favicon: null,
      htmlContent: null,
      contentAssetId: null,
      crawledAt: null,
      crawlStatus: null,
      author: null,
      publisher: null,
      datePublished: null,
      dateModified: null,
    },
  });
  configuredMock.store.bookmarks.set('bm-y', {
    id: 'bm-y',
    ...baseBookmark,
    content: {
      type: 'link',
      url: `${configuredMock.url}/page/y`,
      title: null,
      description: null,
      imageUrl: null,
      imageAssetId: null,
      screenshotAssetId: null,
      pdfAssetId: null,
      fullPageArchiveAssetId: null,
      precrawledArchiveAssetId: null,
      videoAssetId: null,
      favicon: null,
      htmlContent: null,
      contentAssetId: null,
      crawledAt: null,
      crawlStatus: null,
      author: null,
      publisher: null,
      datePublished: null,
      dateModified: null,
    },
  });
  await seedTabGroupsListId(serviceWorker, parentId);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('tab', { name: 'Recent' }).click();

  // Switch the Open in: target to "New window"
  await popup.getByRole('radio', { name: 'New window' }).click();

  popup.once('dialog', (d) => void d.accept());
  await popup.locator('.recent-item').first().getByRole('button', { name: /Open all/ }).click();
  await expect(popup.locator('.status.success')).toContainText('Opened 2/2 tabs');

  // The new window will surface as new pages in the same persistent context.
  await expect
    .poll(
      () =>
        context.pages().filter((p) => p.url().startsWith(`${configuredMock.url}/page/`)).length,
      { timeout: 5_000 },
    )
    .toBe(2);
});
