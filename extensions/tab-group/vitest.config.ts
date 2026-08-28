import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const extensionRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Mirrors the `@` / `@/*` paths WXT generates into .wxt/tsconfig.json.
    alias: { '@': extensionRoot },
  },
  test: {
    // Narrow on purpose: tests/e2e/**/*.spec.ts belongs to Playwright, not vitest.
    include: ['src/**/*.test.ts'],
  },
});
