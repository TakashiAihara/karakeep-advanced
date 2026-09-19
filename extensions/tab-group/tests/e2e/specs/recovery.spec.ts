import { test, expect } from '../fixtures/extension';

test('Retry failed finishes a half-failed Save & close and closes every tab', async ({
  context,
  extensionId,
  configuredMock,
}) => {
  const okUrl = `${configuredMock.url}/page/ok`;
  const flakyUrl = `${configuredMock.url}/page/flaky`;
  const a = await context.newPage();
  await a.goto(okUrl);
  const b = await context.newPage();
  await b.goto(flakyUrl);
  configuredMock.store.failBookmarkUrls.add(flakyUrl);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('button', { name: 'Save & close' }).click();

  await expect(popup.locator('.status.success')).toContainText('Saved 1/2');
  const recovery = popup.locator('.status.recovery');
  await expect(recovery).toContainText('1 of 2 failed');
  await expect(recovery).toContainText(flakyUrl);
  // nothing is closed while a tab is still unsaved
  expect(a.isClosed()).toBe(false);
  expect(b.isClosed()).toBe(false);

  configuredMock.store.failBookmarkUrls.clear();
  await popup.getByRole('button', { name: 'Retry failed (1)' }).click();
  await expect(recovery).toHaveCount(0);

  const subLists = [...configuredMock.store.lists.values()].filter((l) => l.parentId != null);
  expect(subLists.length).toBe(1);
  expect(configuredMock.store.listBookmarks.get(subLists[0]!.id)?.size).toBe(2);

  await expect.poll(() => a.isClosed() && b.isClosed()).toBe(true);
});

async function seedUnfinishedJob(
  serviceWorker: import('@playwright/test').Worker,
  urls: string[],
): Promise<void> {
  await serviceWorker.evaluate((jobUrls: string[]) => {
    const job = {
      jobId: 'seeded-job',
      scope: 'all',
      closeAfter: false,
      subListId: null,
      subListName: 'Seeded unfinished',
      tabs: jobUrls.map((url) => ({
        tabId: null,
        url,
        title: '',
        bookmarkId: null,
        state: 'pending',
        reason: null,
      })),
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };
    // @ts-expect-error chrome global is available inside the extension service worker
    return chrome.storage.local.set({ saveJob: job });
  }, urls);
}

test('An unfinished save blocks new saves until Resume finishes it', async ({
  context,
  extensionId,
  serviceWorker,
  configuredMock,
}) => {
  const urls = [`${configuredMock.url}/page/one`, `${configuredMock.url}/page/two`];
  await seedUnfinishedJob(serviceWorker, urls);
  const tab = await context.newPage();
  await tab.goto(`${configuredMock.url}/page/other`);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const recovery = popup.locator('.status.recovery');
  await expect(recovery).toContainText('Seeded unfinished');
  await expect(recovery).toContainText('0/2 saved');

  await popup.getByRole('button', { name: 'Save without closing' }).click();
  await expect(popup.locator('.status.error')).toContainText('still unfinished');

  await popup.getByRole('button', { name: 'Resume' }).click();
  await expect(recovery).toHaveCount(0);

  const seeded = [...configuredMock.store.lists.values()].find((l) =>
    l.name.startsWith('Seeded unfinished'),
  );
  expect(seeded).toBeDefined();
  expect(configuredMock.store.listBookmarks.get(seeded!.id)?.size).toBe(2);
});

test('Discard clears an unfinished save without writing it', async ({
  context,
  extensionId,
  serviceWorker,
  configuredMock,
}) => {
  await seedUnfinishedJob(serviceWorker, [`${configuredMock.url}/page/one`]);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  popup.on('dialog', (dialog) => void dialog.accept());
  await popup.getByRole('button', { name: 'Discard' }).click();

  await expect(popup.locator('.status.recovery')).toHaveCount(0);
  expect(configuredMock.store.bookmarks.size).toBe(0);
  const stored = await serviceWorker.evaluate(
    // @ts-expect-error chrome global is available inside the extension service worker
    () => chrome.storage.local.get('saveJob'),
  );
  expect((stored as { saveJob?: unknown }).saveJob ?? null).toBeNull();
});
