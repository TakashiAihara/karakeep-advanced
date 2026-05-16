import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Karakeep Advanced — Tab Group',
    short_name: 'KA Tab Group',
    description:
      'Save tab groups to your Karakeep instance. OneTab-compatible UX, multi-device sync via Karakeep.',
    permissions: ['tabs', 'storage', 'contextMenus'],
    optional_host_permissions: ['<all_urls>'],
    commands: {
      'save-tab-group': {
        suggested_key: { default: 'Ctrl+Shift+E' },
        description: 'Save all tabs to Karakeep and close them',
      },
      'save-without-closing': {
        suggested_key: { default: 'Ctrl+Shift+S' },
        description: 'Save all tabs to Karakeep without closing them',
      },
    },
  },
});
