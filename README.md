# Karakeep Advanced

Chromium extensions that use [Karakeep](https://github.com/karakeep-app/karakeep) as backend.

The first product in this line is a **Tab Group manager** — an OneTab-compatible UX that stores tab sessions as Karakeep lists, so groups survive machine swaps and become reachable from every device through your own Karakeep instance.

Future siblings (Highlight saver, Omnibox search, etc.) will share the same `karakeep-advanced-*` brand and this repository.

## Status

The Tab Group extension (`extensions/tab-group/`) covers Phase 1 and 2: save / save & close, keyboard shortcuts, search, recent groups, OneTab import, context menus, rename / delete, and recovery of interrupted or half-failed saves. Install it unpacked by following [extensions/tab-group/README.md](extensions/tab-group/README.md#load-the-extension-in-chrome-manual-smoke-test-for-pr1). See [docs/design/roadmap.md](docs/design/roadmap.md) for what comes next.

## Docs

- [docs/karakeep-advanced.md](docs/karakeep-advanced.md) — project overview (Why / What / Phase plan / API spec notes)
- `docs/design/` — per-phase implementation design docs (TBD)

## Relation to the official extension

The official [`karakeep-app/karakeep` browser extension](https://github.com/karakeep-app/karakeep/tree/main/apps/browser-extension) targets single-page bookmarking. Karakeep Advanced extensions complement it (tab groups, highlights, omnibox search, ...) and are intended to be installed alongside the official one.

## License

[MIT](LICENSE)
