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

## Status

PR1 (options + Karakeep API client foundation). Tab saving, shortcuts, search, recent groups, and OneTab import land in later PRs &mdash; see the design doc.
