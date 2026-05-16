# Karakeep Advanced

Chromium extensions that use [Karakeep](https://github.com/karakeep-app/karakeep) as backend.

The first product in this line is a **Tab Group manager** — an OneTab-compatible UX that stores tab sessions as Karakeep lists, so groups survive machine swaps and become reachable from every device through your own Karakeep instance.

Future siblings (Highlight saver, Omnibox search, etc.) will share the same `karakeep-advanced-*` brand and this repository.

## Status

WIP — scaffolding has not started yet. See [docs/karakeep-advanced.md](docs/karakeep-advanced.md) for the full Why / What / scope.

## Docs

- [docs/karakeep-advanced.md](docs/karakeep-advanced.md) — project overview (Why / What / Phase plan / API spec notes)
- `docs/design/` — per-phase implementation design docs (TBD)

## Relation to the official extension

The official [`karakeep-app/karakeep` browser extension](https://github.com/karakeep-app/karakeep/tree/main/apps/browser-extension) targets single-page bookmarking. Karakeep Advanced extensions complement it (tab groups, highlights, omnibox search, ...) and are intended to be installed alongside the official one.

## License

TBD.
