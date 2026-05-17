import { test, expect } from '../fixtures/extension';

test('Search returns matching bookmarks and Enter opens them', async ({
  context,
  extensionId,
  configuredMock,
}) => {
  // Seed the mock with a couple of bookmarks
  configuredMock.store.bookmarks.set('bm-seed-1', {
    id: 'bm-seed-1',
    createdAt: new Date().toISOString(),
    modifiedAt: null,
    title: 'My research notes',
    archived: false,
    favourited: false,
    taggingStatus: null,
    summarizationStatus: null,
    note: null,
    summary: null,
    source: 'extension',
    userId: 'u1',
    tags: [],
    content: {
      type: 'link',
      url: `${configuredMock.url}/page/research`,
      title: 'My research notes',
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

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  await popup.getByRole('tab', { name: 'Search' }).click();

  await popup.getByPlaceholder('Search Karakeep bookmarks…').fill('research');

  await expect(popup.locator('[cmdk-item]')).toHaveCount(1);
  await expect(popup.locator('[cmdk-item]')).toContainText('My research notes');

  const newTabPromise = context.waitForEvent('page');
  await popup.locator('[cmdk-item]').first().click();
  const opened = await newTabPromise;
  await opened.waitForLoadState();
  expect(opened.url()).toBe(`${configuredMock.url}/page/research`);
});
