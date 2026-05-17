import { test, expect } from '../fixtures/extension';

test('Save & close stores all http tabs as a sub-list and closes them', async ({
  context,
  extensionId,
  configuredMock,
}) => {
  const a = await context.newPage();
  await a.goto(`${configuredMock.url}/page/alpha`);
  const b = await context.newPage();
  await b.goto(`${configuredMock.url}/page/beta`);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(popup.locator('.scope-item.active')).toContainText('All');
  await expect(popup.locator('.count')).toContainText('2 all tabs will be saved');

  await popup.getByRole('button', { name: 'Save & close' }).click();
  await expect(popup.locator('.status.success')).toContainText('Saved 2/2');

  const subLists = [...configuredMock.store.lists.values()].filter(
    (l) => l.parentId != null,
  );
  expect(subLists.length).toBe(1);

  const attached = configuredMock.store.listBookmarks.get(subLists[0]!.id);
  expect(attached?.size).toBe(2);

  const urls = [...attached!]
    .map((bid) => configuredMock.store.bookmarks.get(bid)!.content.url)
    .sort();
  expect(urls).toEqual(
    [`${configuredMock.url}/page/alpha`, `${configuredMock.url}/page/beta`].sort(),
  );

  await popup.waitForTimeout(300);
  expect(a.isClosed()).toBe(true);
  expect(b.isClosed()).toBe(true);
});

test('Save without closing keeps the original tabs open', async ({
  context,
  extensionId,
  configuredMock,
}) => {
  const a = await context.newPage();
  await a.goto(`${configuredMock.url}/page/gamma`);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  await popup.getByRole('button', { name: 'Save without closing' }).click();
  await expect(popup.locator('.status.success')).toContainText('Saved 1/1');

  expect(a.isClosed()).toBe(false);
});
