import { test, expect } from '../fixtures/extension';

test('options accepts URL + API key and reports connected', async ({
  context,
  extensionId,
  mock,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  await page.getByPlaceholder('http://192.168.0.113').fill(mock.url);
  await page.getByPlaceholder('ak2_xxxxxxxxxxxx_xxxxxxxxxxxx').fill('e2e-test-key');

  await page.getByRole('button', { name: 'Test connection & save' }).click();

  await expect(page.locator('.status.success')).toContainText('Connected as');
  await expect(page.locator('.status.success')).toContainText('Settings saved.');
});

test('options surfaces a network failure with a clear message', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  await page.getByPlaceholder('http://192.168.0.113').fill('http://127.0.0.1:1');
  await page.getByPlaceholder('ak2_xxxxxxxxxxxx_xxxxxxxxxxxx').fill('any');

  await page.getByRole('button', { name: 'Test connection & save' }).click();

  await expect(page.locator('.status.error')).toContainText('Connection failed');
});
