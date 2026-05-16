# E2E Tests — Tab Group Extension

`extensions/tab-group` を end-to-end でテストする方針と最初の実装計画。

## なぜ E2E ファースト

CLAUDE.md の指針: 「アジャイルに進めつつ動作保証は **E2E で取る**。unit test は壊れやすい箇所・複雑な分岐・共有ロジックに絞る」。

- 拡張の正しさは「Chrome に load されて期待通り動くか」が最終ゴール。
- popup / background / options / context menu / commands の各 entrypoint と `chrome.tabs` / `chrome.windows` / `chrome.notifications` / `chrome.permissions` の合成は unit/component では再現しきれない。
- Karakeep API との往復も真の動作保証ポイント。
- → 最初に **happy path を一通り E2E で押さえる**。unit はそこから漏れる pure ロジック (`saveable-tabs`, `one-tab-export`, name parser) に絞って後追い。

## スコープと非スコープ

**スコープ (今やる)**:

- Chrome (chromium) に unpacked load した extension に対する E2E。
- Karakeep を `Bun.serve` の **in-memory mock** で stub。
  - real Karakeep CT 113 を叩くと state drift で flaky になるので避ける。
- happy path のみ。エラー系は最小 (`/users/me` 401 で options が "Connection failed" を出す程度)。
- Firefox は対象外 (Phase 2 以降)。

**非スコープ (やらない)**:

- Unit test。E2E がカバーする範囲では現状不要。pure ロジック (`saveable-tabs.ts`, `one-tab-export.ts` 等) は別 PR で vitest を後追い。
- Component test (popup の React 単体)。
- CI で常時実行 (chromium head 必須 / 拡張 build 重い)。当面はローカル手動。
- mock の API 完全互換。実装側で叩いている endpoint だけ実装する。

## Mock Karakeep の責任範囲

最低限こちらだけ実装すれば Phase 1 + 2 を回せる:

- `GET  /api/v1/users/me` → 固定の `{ id, email }` (auth ok 判定用)
- `GET  /api/v1/lists` → 全 list を一括返却 (ページネーションなし)
- `POST /api/v1/lists` → store に追加、`{ id, … }` を返却
- `PATCH /api/v1/lists/{listId}` → 部分更新 (name)
- `DELETE /api/v1/lists/{listId}` → 削除 + child bookmarks の attach 解除
- `POST /api/v1/bookmarks` → store に追加、source は `extension` / `import` のみ受理 (validation は緩く)
- `PUT  /api/v1/lists/{listId}/bookmarks/{bookmarkId}` → idempotent attach
- `DELETE /api/v1/lists/{listId}/bookmarks/{bookmarkId}` → detach
- `GET  /api/v1/lists/{listId}/bookmarks` → cursor 1 ページで全件返却 (cursor は無視)
- `GET  /api/v1/bookmarks/search?q=...` → store を ad-hoc filter で返却

Bearer auth は `Authorization` header の存在チェックのみ。トークン値の照合はしない。

## Playwright セットアップ

- パッケージ: `@playwright/test` (workspace の devDependency)
- 拡張ロード: `chromium.launchPersistentContext` + `--disable-extensions-except=` / `--load-extension=` で `.output/chrome-mv3/` を指定。
- 拡張 ID は test 起動時に `context.serviceWorkers()` から取得して `chrome-extension://<id>/options.html` のような URL で開く。
- mock サーバはテスト前に立ち上げ、`MOCK_BASE_URL` を Playwright fixture 経由で extension の storage に **直接書き込んで** 起動する (options 入力を毎回 UI で行うとフレーキー)。
  - `await context.serviceWorkers()[0].evaluate((url) => chrome.storage.local.set({ serverUrl: url, apiKey: 'test' }), MOCK_BASE_URL)` 相当。
- 拡張は host permission ランタイム要求するので、`browser.permissions.request` を mock サーバ origin に対して `await chrome.permissions.contains` で OK になるよう **マニフェストで `optional_host_permissions: ['*://*/*']`** の上、テスト fixture で `chrome.permissions.request({ origins: ['<mock-origin>/*'] })` を呼び付けて grant 済みにする。
  - 既に拡張側は `optional_host_permissions: ['<all_urls>']` なので追加対応は不要。

## ディレクトリ構造 (extension 配下)

```
extensions/tab-group/
└── tests/
    └── e2e/
        ├── playwright.config.ts
        ├── fixtures/
        │   ├── extension.ts         chromium with extension + serviceWorker / extensionId 取得
        │   └── karakeep-mock.ts     Bun in-memory mock server
        ├── helpers/
        │   └── storage.ts           ext storage への配信 helper
        └── specs/
            ├── options.spec.ts      PR1
            ├── save.spec.ts         PR2
            ├── search.spec.ts       PR2
            ├── recent.spec.ts       PR2 / PR3 (rename / delete / new window)
            └── context-menu.spec.ts PR3
```

## PR 分割案

| # | タイトル | 内容 |
|---|---|---|
| E2E / PR1 | tests(tab-group): Playwright + Karakeep mock の足場 | install / config / fixture / mock server + options happy path 1 件 |
| E2E / PR2 | tests(tab-group): save / recent / search の E2E | popup の Save → mock の list/bookmark を verify / Recent / Search のクリック restore |
| E2E / PR3 | tests(tab-group): Phase 2 機能の E2E | scope (Others/Selected), context menu, rename, delete, Open in new window |

## CI

Phase 1 / 2 と同様、CI はまだ未設定。ローカルで `bun --filter '@karakeep-advanced/tab-group' test:e2e` 一発で全件回せる状態を目指す。CI 化は Phase 3 以降に GitHub Actions で chromium を入れてやる候補。

## 承認

このドキュメントを基に PR1 から着手する。
