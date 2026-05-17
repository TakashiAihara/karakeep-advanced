import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMockServer, type MockServer } from './karakeep-mock';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.resolve(dirname, '../../..', '.output/chrome-mv3');

type Fixtures = {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
  mock: MockServer;
  configuredMock: MockServer;
};

export const test = base.extend<Fixtures>({
  context: async ({}, use, testInfo) => {
    const userDataDir = path.join(testInfo.outputDir, 'profile');
    const ctx = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
    await use(ctx);
    await ctx.close();
  },

  serviceWorker: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) {
      // Wake the MV3 service worker by opening chrome://extensions —
      // launchPersistentContext alone does not always trigger SW registration
      // in headless chromium.
      const wake = await context.newPage();
      await wake.goto('chrome://extensions/').catch(() => undefined);
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        [sw] = context.serviceWorkers();
        if (sw) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      await wake.close().catch(() => undefined);
    }
    if (!sw) throw new Error('extension service worker did not register');
    await use(sw);
  },

  extensionId: async ({ serviceWorker }, use) => {
    const id = new URL(serviceWorker.url()).host;
    await use(id);
  },

  mock: async ({}, use) => {
    const server = await startMockServer();
    await use(server);
    await server.stop();
  },

  configuredMock: async ({ serviceWorker, mock }, use) => {
    await serviceWorker.evaluate(
      (args: { url: string; key: string }) =>
        // @ts-expect-error chrome global is available inside the extension service worker
        chrome.storage.local.set({ serverUrl: args.url, apiKey: args.key }),
      { url: mock.url, key: 'e2e-test-key' },
    );
    await use(mock);
  },
});

export const expect = test.expect;
