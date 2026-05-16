# @karakeep-advanced/tab-group

OneTab-compatible Chromium extension that stores tab groups in a Karakeep instance.

Stack: WXT 0.20 + React 19 + TypeScript 5.9 + openapi-typescript + openapi-fetch.

See [../../docs/karakeep-advanced.md](../../docs/karakeep-advanced.md) for the full project rationale and [../../docs/design/phase-1-tab-group-save.md](../../docs/design/phase-1-tab-group-save.md) for the Phase 1 design.

## Scripts (run from the workspace root)

```bash
bun --filter '@karakeep-advanced/tab-group' typecheck
bun --filter '@karakeep-advanced/tab-group' build           # outputs .output/chrome-mv3/
bun --filter '@karakeep-advanced/tab-group' dev             # HMR, launches Chrome
bun --filter '@karakeep-advanced/tab-group' generate:api    # regenerate src/karakeep/schema.d.ts
```

## Load the extension in Chrome (manual smoke test for PR1)

1. `bun --filter '@karakeep-advanced/tab-group' build`
2. Open `chrome://extensions/` and turn on **Developer mode**
3. Click **Load unpacked** and select `extensions/tab-group/.output/chrome-mv3/`
4. Right-click the extension icon &rsaquo; **Options**
5. Enter your Karakeep server URL (e.g. `http://192.168.0.113`) and API key (`ak2_…`)
6. Click **Test connection & save**
7. Grant host permission when prompted &mdash; on success you should see `Connected as <name>. Settings saved.`

## Manual smoke test for PR2

After PR1 setup (options saved with a working server URL + API key):

1. Open a few `http(s)` tabs in a window.
2. Click the Karakeep Advanced toolbar icon.
3. The popup shows the count of saveable tabs.
4. **Save & close all** &rarr; tabs are bookmarked into a new sub-list under `Tab Groups`; on full success the tabs in the window are closed.
5. **Save without closing** &rarr; same but the tabs stay open.
6. Confirm in Karakeep that the parent list `Tab Groups` exists and contains a new sub-list named `YYYY-MM-DD HH:MM (N tabs)`.

## Status

PR2 (popup save flow + Karakeep tab-groups data model). Keyboard shortcuts, search, recent groups list, and OneTab import land in later PRs &mdash; see the design doc.
