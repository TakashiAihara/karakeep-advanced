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

## Manual smoke test for PR3 (keyboard shortcuts)

Default keys (configurable in `chrome://extensions/shortcuts`):

- **`Ctrl+Shift+E`** &rarr; "Save all tabs to Karakeep and close them" (`save-tab-group`)
- **`Ctrl+Shift+S`** &rarr; "Save all tabs to Karakeep without closing them" (`save-without-closing`)

Result is announced via a desktop notification (`Saved M/N → <subListName>`); errors are also notified.

## Manual smoke test for PR4 (search & restore)

1. In the popup, switch to the **Search** tab.
2. Type a query &mdash; results stream in after a short debounce.
3. Click or press Enter on a hit &rarr; opens the URL in a new active tab and closes the popup.
4. Hold Cmd (mac) / Ctrl (other) while hitting Enter / clicking &rarr; opens in a background tab; the popup stays open.

## Manual smoke test for PR5 (recent groups & Open all)

1. Save at least one tab group via the **Save** tab first.
2. Switch to the **Recent** tab in the popup.
3. Recent sub-lists under `Tab Groups` show up with their saved-tab count.
4. Click **Open all (N)** on a row &rarr; a confirm dialog appears (`Open N tabs from "<name>"?`).
5. Confirm &rarr; the bookmarks are reopened as background tabs in the current window.

## Manual smoke test for PR6 (OneTab import)

1. From OneTab, **Export / Import URLs** &rarr; **Export URLs** and copy the text.
2. In the popup, switch to the **Import** tab.
3. Paste the export into the textarea (or pick a `.txt` file via the file input).
4. The button shows `Import N groups (M URLs)`. Click it.
5. Each non-empty paragraph becomes a sub-list named `Imported from OneTab #i (N tabs)` under `Tab Groups`, populated with the URLs.

## Status

Phase 1 MVP complete: save (popup + 2 shortcuts), search & restore, recent groups with Open all, OneTab import. Phase 2 (selected/others/right-only save, pinned exclusion, group rename/delete UI) is next &mdash; see the design doc.
