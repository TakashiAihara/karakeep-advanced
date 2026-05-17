import { test, expect } from '../fixtures/extension';

test('Recent tab lists saved groups and Open all reopens them', async ({
  context,
  extensionId,
  configuredMock,
}) => {
  const a = await context.newPage();
  await a.goto(`${configuredMock.url}/page/one`);
  const b = await context.newPage();
  await b.goto(`${configuredMock.url}/page/two`);

  // Save the two pages first
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('button', { name: 'Save without closing' }).click();
  await expect(popup.locator('.status.success')).toContainText('Saved 2/2');

  // Move to Recent
  await popup.getByRole('tab', { name: 'Recent' }).click();

  const row = popup.locator('.recent-item').first();
  await expect(row).toBeVisible();
  await expect(row).toContainText('(2 tabs)');

  // Open all in the current window — auto-accept the confirm()
  popup.once('dialog', (dialog) => void dialog.accept());
  const pagesBefore = new Set(context.pages());
  await row.getByRole('button', { name: /Open all/ }).click();
  await expect(popup.locator('.status.success')).toContainText('Opened 2/2 tabs');

  // Poll briefly — `chrome.tabs.create` resolves on the SW side a tick
  // before Playwright wires the new pages into context.pages().
  await expect
    .poll(
      () =>
        context
          .pages()
          .filter(
            (p) => !pagesBefore.has(p) && p.url().startsWith(`${configuredMock.url}/page/`),
          ).length,
      { timeout: 5_000 },
    )
    .toBe(2);

  const newPages = context
    .pages()
    .filter((p) => !pagesBefore.has(p) && p.url().startsWith(`${configuredMock.url}/page/`));
  const openedUrls = newPages.map((p) => p.url()).sort();
  expect(openedUrls).toEqual(
    [`${configuredMock.url}/page/one`, `${configuredMock.url}/page/two`].sort(),
  );
});
