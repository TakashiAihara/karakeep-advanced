# Phase 1 — Tab Group Save MVP

`extensions/tab-group` の Phase 1 (MVP) 設計ドキュメント。プロジェクト全体方針は [../karakeep-advanced.md](../karakeep-advanced.md) を参照。

## ゴール

OneTab を Karakeep Advanced に完全に置き換えられる状態にする。具体的には:

- 既存 OneTab データを Karakeep に移行済み
- 全タブ保存 + close が 1 click で動く
- 「閉じずに保存」と「保存 + close」が両方 keyboard shortcut で叩ける
- 過去保存したタブを popup から検索 → クリックで新タブ open

## 機能スコープ

| ID | 機能 | 動線 |
|----|------|------|
| F1 | options 画面で Karakeep server URL + API key を設定 | 初回起動時の必須セットアップ |
| F2 | ツールバーアイコンの popup から「全タブ保存 + close」 | 1 click、進捗 UI |
| F3 | shortcut で「全タブ保存 + close」 | `Ctrl+Shift+E` (default) |
| F4 | shortcut で「閉じずに保存」 | `Ctrl+Shift+S` (default) |
| F5 | popup で Karakeep 全 bookmark を fuzzy 検索 → クリックで新タブ open | cmdk ベース |
| F6 | popup から最近の sub-list 一覧 + 「Open all」 (確認ダイアログ付き) | recent N 件 |
| F7 | OneTab Export 形式のテキストを import (貼り付け or `.txt` 投入) | options or popup の Import タブ |

## アーキテクチャ

### ファイルレイアウト (実装後)

```
extensions/tab-group/
├── wxt.config.ts                 manifest (permissions, commands)
├── entrypoints/
│   ├── background.ts             メッセージルータ + commands listener + 保存 flow 実行
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx               タブ切替 (Save / Recent / Search / Import)
│   │   └── components/
│   │       ├── SaveButton.tsx
│   │       ├── RecentGroups.tsx
│   │       ├── SearchCommand.tsx (cmdk)
│   │       └── ImportPanel.tsx
│   └── options/
│       ├── index.html
│       ├── main.tsx
│       └── App.tsx               server URL + API key + permission 要求
└── src/
    ├── karakeep/
    │   ├── schema.d.ts           openapi-typescript 生成
    │   ├── client.ts             createClient<paths>() + Bearer middleware
    │   └── flows/
    │       ├── ensure-tab-groups-list.ts
    │       ├── save-tabs-as-group.ts
    │       ├── search-bookmarks.ts
    │       ├── list-sub-groups.ts
    │       ├── open-group.ts
    │       └── import-onetab.ts
    ├── storage/
    │   └── items.ts              wxt defineItem (serverUrl, apiKey, tabGroupsListId, recentGroupIds)
    ├── messaging/
    │   ├── schema.ts             type-safe message 定義
    │   ├── send.ts               popup 側 helper
    │   └── handler.ts            background 側 handler
    ├── parsers/
    │   └── one-tab-export.ts
    └── ui/                       cmdk 含む共有 UI コンポーネント
```

### entrypoints の役割

- **background (service worker)**: タブ操作 + Karakeep API 呼び出しの実行主体。popup は trigger と表示のみ
  - `chrome.commands.onCommand` で shortcut を受ける → flow 呼び出し
  - `chrome.runtime.onMessage` で popup からの要求を受ける
  - storage の watchers で apiKey / serverUrl 変更を検知して client を再生成
- **popup**: UI 専用、API 呼び出しはしない。background に message 送信して結果待ち
- **options**: server URL + API key の入力。`chrome.permissions.request` で host permission をランタイム要求

### message passing スキーマ

`src/messaging/schema.ts` で discriminated union で定義。`webext-bridge` などは使わず自前 (依存最小化、型は厳密)。

```ts
type Request =
  | { type: 'SAVE_AND_CLOSE'; scope: 'all' | 'others' | 'selected' }
  | { type: 'SAVE_WITHOUT_CLOSING'; scope: 'all' | 'others' | 'selected' }
  | { type: 'SEARCH_BOOKMARKS'; q: string; cursor?: string }
  | { type: 'LIST_RECENT_GROUPS'; limit: number }
  | { type: 'OPEN_GROUP'; listId: string }
  | { type: 'IMPORT_ONETAB'; text: string };

type Response =
  | { type: 'SAVED'; subListId: string; savedCount: number; failed: SaveError[] }
  | { type: 'SEARCH_RESULT'; bookmarks: Bookmark[]; nextCursor: string | null }
  | { type: 'RECENT_GROUPS'; groups: SubListSummary[] }
  | { type: 'OPENED'; count: number }
  | { type: 'IMPORTED'; createdSubListCount: number; bookmarkCount: number }
  | { type: 'ERROR'; message: string; code?: string };
```

popup 側は `send(request): Promise<Response>` の薄い helper、background 側は `handler.ts` で discriminator switch。

### Karakeep API クライアント

- `openapi-typescript` で型生成: `bunx openapi-typescript ./karakeep-openapi-spec.json -o src/karakeep/schema.d.ts`
- `openapi-fetch` で `createClient<paths>({ baseUrl: serverUrl })`
- middleware で `Authorization: Bearer ${apiKey}` をセット
- 429 ハンドリング: middleware で `Retry-After` 相当を読んで指数バックオフ (max 3 リトライ)

### storage schema

`wxt/utils/storage` の `defineItem`:

```ts
export const serverUrl   = storage.defineItem<string>('local:serverUrl');
export const apiKey      = storage.defineItem<string>('local:apiKey');
export const tabGroupsListId = storage.defineItem<string | null>('local:tabGroupsListId', { fallback: null });
export const recentGroupIds  = storage.defineItem<string[]>('local:recentGroupIds', { fallback: [] });
```

`tabGroupsListId` は親 list の id をキャッシュ。background 起動時に `null` ならサーバ問い合わせ → なければ作成。

### bulk 保存 flow (`save-tabs-as-group.ts`)

```
1. const parentId = await ensureTabGroupsList()
2. const subList  = await POST /lists  { name: autoName(N), icon: "📑", parentId, type: "manual" }
3. const tabs     = await chrome.tabs.query({ ...scope })
   (pinned 除外は Phase 2、ここでは全件)
4. const created  = await Promise.all (concurrency 3) → POST /bookmarks each tab
5. await Promise.all (concurrency 3) → PUT /lists/{subList.id}/bookmarks/{id} each created
6. if scope に "close" 含む → chrome.tabs.remove(ids)
7. return { subListId: subList.id, savedCount, failed }
```

エラーポリシー:
- 失敗した bookmark は `failed[]` に積んで popup に返す
- sub-list 作成が失敗したら abort、close もしない (タブ消失防止)
- bookmark 作成途中で全件失敗したら close はしない (= 1 件でも保存できた時のみ close する)。Phase 1 では「全件成功時のみ close」の保守的な挙動にする

### OneTab import (`import-onetab.ts`)

parser 仕様:
- 連続非空行 = 1 group
- 各行を ` | ` で split → `[url, ...titleParts]` → title は空でも許容
- 空行で group 区切り

flow:
1. parse text → `Group[]` (各 group は `{ urls: { url, title }[] }`)
2. 各 group について順に sub-list を作成 (`name: "Imported from OneTab #1"`, ...)
3. 各 URL を bookmark create → sub-list put
4. 進捗 + 結果を返す

## 実装順序 (PR 分割案)

各 PR は単体で動作する状態を保つ ([CLAUDE.md 規約](../../README.md) に従う)。

| # | PR タイトル | 動作する状態 | 概算行数 |
|---|------|-------|-------|
| PR1 | feat(tab-group): options page + Karakeep client foundation | options で URL+key 保存 → typecheck OK | ~600 |
| PR2 | feat(tab-group): save & close all tabs from popup | popup ボタンで保存 + close | ~500 |
| PR3 | feat(tab-group): keyboard shortcuts for save flows | shortcut 2 種が動く | ~150 |
| PR4 | feat(tab-group): search Karakeep bookmarks from popup (cmdk) | popup 検索 + クリック restore | ~700 |
| PR5 | feat(tab-group): recent groups list + open all | sub-list 一覧 + Open all | ~400 |
| PR6 | feat(tab-group): OneTab export import | テキスト貼付け → import | ~500 |

PR1 で `karakeep-openapi-spec.json` のローカルコピー or git submodule 戦略を決める。生成物 (`schema.d.ts`) は commit する方針 (build 時生成より読みやすさ優先)。

## 動作確認方法

- typecheck: `bun --filter '@karakeep-advanced/tab-group' typecheck`
- build: `bun --filter '@karakeep-advanced/tab-group' build` → `.output/chrome-mv3/`
- 実機: Chrome で `chrome://extensions` → デベロッパーモード ON → 「パッケージ化されていない拡張機能を読み込む」で `.output/chrome-mv3/`
- dev HMR: `bun --filter '@karakeep-advanced/tab-group' dev` → 自動で Chrome 起動 + 拡張ロード

E2E テストは Phase 1 ではスキップ (CLAUDE.md「アジャイルに進めつつ動作保証は E2E」原則だが、Chrome 拡張の E2E は puppeteer / playwright での setup コストが高く Phase 2 以降に回す)。代わりに手動スモークチェックリストを PR ごとに README に追記。

## スコープ外 / 未決事項

- Pinned タブ除外 → Phase 2
- 選択タブのみ / 他のタブのみ → Phase 2
- 一括 restore → Phase 2 (Phase 1 は個別クリック restore のみ)
- 共有 URL / auto-cleanup → Phase 3
- Firefox ビルド検証 (build は通るが手元での動作確認は Phase 2 以降)
- 多言語化 (i18n) → Phase 2、Phase 1 は英語のみ

## 承認

このドキュメントを基に PR1 から着手する。
