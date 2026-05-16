---
title: "Karakeep Advanced — Tab Group 拡張 (Karakeep バックエンド)"
type: project
lifecycle: stock
status: draft
tags:
  - karakeep
  - karakeep-advanced
  - browser-extension
  - chromium
  - onetab
  - wxt
  - typescript
created: 2026-05-16
updated: 2026-05-16
related:
  - "[[karakeep-setup]]"
  - "[[bookmark-manager-comparison]]"
---

## Why — なぜ作るか

### コンセプト名

**Karakeep Advanced** — Karakeep をストアとして使う、公式とは別系統の Chromium 拡張ライン。本ノートはその初代プロダクトである **Tab Group 拡張** (OneTab 互換 UX) を扱う。

> "Advanced" は「公式に含まれない、運用者向けの拡張機能」のニュアンス。`karakeep-advanced` を傘ブランドにして、将来 OneTab 系以外のクライアント (Highlight, Omnibox, etc.) も同じ命名空間で扱える設計にする。

### 課題

OneTab を長年メインで使ってきたが構造的な不満がある:

- **データがローカル保存**。マシン故障 / プロファイル吹き飛ばし / 機種変で消失リスク。実際に過去ロストしている
- **マルチデバイスで同じグループを開けない**。仕事中に「自宅で見てたあの調査タブ」を呼び戻せない
- 「公式の同期」相当が無い（Pro の Cloud Backup は別契約 + データは OneTab 社）
- グループ命名・検索・タグ・AI 整理が貧弱。タブ数が万件規模になるとほぼ閲覧不能

### なぜ Karakeep をバックエンドに置きたいか

[[karakeep-setup]] で LXC CT 113 上に Karakeep を AI 自動タグ付け込みで運用中。

- 自宅 LAN 上で常時稼働、API key 1 本で全デバイスから読み書き
- list の階層構造、tag、Meilisearch 全文検索が既に揃っている
- AI 自動タグ付けがインポートしただけで走る → タブグループから「投げっぱなし」しても後で検索できる
- backup / dump も Karakeep CLI で取れる

OneTab の保存・restore UX をそのまま、ストア層だけ Karakeep に置き換えるのが最短で課題解決する。

### 公式拡張との関係

公式 Chromium 拡張 (`karakeep-app/karakeep` の `apps/browser-extension`) は **単一ページ保存** に特化したクライアント。Karakeep Advanced はそこを補完するポジション。

| | 公式拡張 | Karakeep Advanced (Tab Group) |
|---|---|---|
| 対象 | アクティブタブ 1 件 | 開いている全 (or 選択) タブ |
| 保存後 | bookmark 1 件追加 | sub-list として束ねて保存 |
| 想定動線 | 「これ後で読む」 | 「ウィンドウごと一旦退避」 |

機能領域が被らないので公式と併用する想定（公式 = ピンポイント保存 / Advanced = タブグループ管理）。

---

## What — 何を作るか

### Karakeep 上のデータモデル

**Hybrid**: 親 list `"Tab Groups"` + 各保存セッションを **sub-list** として親配下に作成。

```
Tab Groups (parent list)
├── 2026-05-16 15:00 (12 tabs)         ← sub-list, auto-named
│    ├── bookmark: https://example.com
│    ├── bookmark: https://github.com/...
│    └── ...
├── 2026-05-16 11:32 (5 tabs)
└── PR レビュー集中ウィンドウ (renamed)
```

- 親 list で他の bookmark と隔離 → Karakeep 本体 UI を汚さない
- sub-list 単位で操作（rename / delete / open all）
- 各 bookmark は通常の Karakeep bookmark なので **AI 自動タグ付けがそのまま効く** → タブグループ内の各 URL に tag が付いて検索容易になる
- Karakeep の list は階層対応済みなので追加実装不要

sub-list 命名規約:
- デフォルト: `YYYY-MM-DD HH:MM (N tabs)`
- リネーム可能（拡張側 UI から PUT `/lists/{id}` で name 更新）

### 機能スコープ

**Phase 1 (MVP) — 自分が OneTab を完全に置き換えられる状態**

| 機能 | 実装メモ |
|------|----------|
| ツールバーアイコン 1 クリックで「全タブ保存 + 全タブ閉じる」 | OneTab デフォルト挙動を踏襲。`chrome.tabs.query` → bulk POST → `chrome.tabs.remove` |
| 「閉じずに保存」shortcut | コマンド `save-without-closing` を `chrome.commands` に登録。デフォルト `Ctrl+Shift+S` 案 |
| popup で Karakeep 全 bookmark を fuzzy 検索 → クリックで新タブ open | `cmdk` ベース。検索は Karakeep の `GET /bookmarks/search?q=...` (Meilisearch backed) |
| OneTab Export 形式のインポート | UI から貼り付け or テキストファイル投入。後述の形式を parse して `Tab Groups` 配下に sub-list として再構築 |
| popup から sub-list 一覧（最近の保存セッション） | 親 list 配下を `GET /lists/{tab-groups-id}/children` で列挙、開いた件数つきで表示 |

**Phase 2 — OneTab の右クリック相当 + restore UX**

- 選択タブのみ / 他のタブのみ / 左右のタブのみ 保存（context menu + popup）
- グループ一括 restore（"Open all"、N 件警告ダイアログ付き）
- Pinned タブ除外オプション（デフォルト除外）
- グループ名のリネーム / 削除 UI

**Phase 3 — 拡張機能**

- 共有 URL 生成（Karakeep の public bookmark / list 公開機能で代替できるか要検証）
- Auto-cleanup: N 日以上 restore されていないグループを自動アーカイブ (別 parent list "Archived Tab Groups" に移動)
- Tab group の split / merge
- 統計（よく restore するグループ、未 restore のグループ等）

### 成功基準

| Phase | Done の定義 |
|-------|-------------|
| Phase 1 | OneTab をアンインストールして Karakeep Advanced に完全移行できる。既存 OneTab データが Karakeep に移行済み。1 click 保存 + close、shortcut の「閉じずに保存」、popup 検索 restore が動く |
| Phase 2 | OneTab の主要 context menu 操作（選択タブのみ等）が網羅されている。グループ一括 restore で 50 タブを誤爆なく開ける |
| Phase 3 | 1 年放置したグループの整理が自動で進み、グループ数が爆発しない |

### スコープ外

- 単一ページに tag/list を指定して保存する公式拡張的 UX（公式に任せる）
- Web UI 本体の改修
- Chrome Web Store 配布（unpacked / dev mode で自分 + 周辺のみ）
- Firefox 配布（WXT で同時ビルドは出力されるが配布作業は未定）
- OneTab Pro の共有 URL 完全互換（Karakeep public 機能で代替できる範囲のみ）

---

## 技術選定

### スタック

| 層 | 採用 | 理由 / メモ |
|----|------|------|
| Framework | **WXT** (内部 Vite 7) | entrypoints/ ファイル規約、`wxt.config.ts` の `manifest` で permissions / commands 集約、`.output/chrome-mv3/` + `.output/firefox-mv2/` 自動振り分け |
| Language | **TypeScript** | WXT デフォルト、auto-imports あり |
| UI | 素の **React 19 + Tailwind 3**、検索は **`cmdk` v1.1.1** | popup と options の 2 画面のみ。Radix 全部入りは popup には重い |
| Karakeep client | **`openapi-typescript` v7 + `openapi-fetch`** | spec: `packages/open-api/karakeep-openapi-spec.json` (OpenAPI 3.0.0) を型生成、`openapi-fetch` の middleware で Bearer header |
| Storage | **`wxt/utils/storage` の `defineItem`** | versioning + migrations + watchers が組み込み。`chrome.storage.local` 直叩きは避ける |
| Auth | API key 直入力 (`ak2_{keyId}_{secret}`) | options 画面で server URL + API key を保存。`defineItem('apiKey')` 経由 |

### WXT 実装方針の要点

- **popup ↔ background は message passing が原則**。popup を 1 click で閉じながら bulk 保存が走るので、`chrome.tabs.query` → `POST` 群 → `chrome.tabs.remove` は **background service worker に逃がす**。popup は trigger と進捗 UI に専念
- shortcut は `wxt.config.ts` の `manifest.commands` で定義 + background で `chrome.commands.onCommand.addListener` 登録（popup 側にハンドラを置かない、popup が閉じる流れと相性悪い）
- host permissions は `manifest.host_permissions` に Karakeep server URL を **動的** には書けない（manifest は静的）。`<all_urls>` を要求するか、options 画面で「URL 確定後に reload して permission をユーザーが許可する」flow にする → **後者**: `optional_host_permissions` + `chrome.permissions.request` のランタイム要求
- HMR: popup React は効くが background 変更で popup が close されることがある (dev 中の既知制約)
- service worker は 5 分無通信で terminate。長い処理は止まる前提で chunked + storage に進捗を書く

### Karakeep API の正確な使い方

OpenAPI spec 確認済み。重要な点:

| 項目 | 仕様 |
|------|------|
| list 作成 | `POST /api/v1/lists` body: `name` (必須, 1-100), **`icon` (必須)**, `type: "manual"\|"smart"` (default manual), `parentId` (camelCase, nullable), `description?`。201 で id (string) を返す |
| bookmark → list 紐付け | `PUT /api/v1/lists/{listId}/bookmarks/{bookmarkId}` → 204、**idempotent** |
| 同 解除 | `DELETE /api/v1/lists/{listId}/bookmarks/{bookmarkId}` → 204 |
| bulk endpoint | **無し**。1 bookmark = 1 request |
| `source` field | **enum**: `"api"\|"web"\|"cli"\|"mobile"\|"extension"\|"singlefile"\|"rss"\|"import"` のみ。本拡張は **`"extension"`** |
| 重複 URL POST | 既存ありなら **200** + 既存 bookmark を返す、新規は 201。**dedupe ロジック自前不要** |
| 検索 | `GET /api/v1/bookmarks/search?q=...` + cursor-based ページング (`limit`, `cursor`)。`includeContent` flag あり |
| レート制限 | 429 + Retry-After 相当のメッセージ。並列度 3-5、指数バックオフ |

bulk 保存フロー (タブ N 件):

```
1. (起動時 1 度) GET /api/v1/lists で "Tab Groups" を探す。無ければ POST /lists で作成
2. POST /api/v1/lists  → sub-list 作成 (name: "YYYY-MM-DD HH:MM (N tabs)", icon: "📑", parentId: <Tab Groups id>)
3. POST /api/v1/bookmarks (xN, 並列 3-5) → 各タブを link bookmark、source: "extension"
4. PUT  /api/v1/lists/{subListId}/bookmarks/{bookmarkId} (xN, 並列 3-5)
```

- 失敗時: 作成済み bookmark はそのまま残す。sub-list がカラ or 部分的に作成された旨を popup の進捗 UI に表示し、再試行ボタンを出す
- title は server 側 crawl 完了で埋まる。restore リスト UI で title 空時は URL を表示するフォールバック

### 既知の制約 / 罠

- Karakeep は bookmark create で list 同時指定不可 → **タブごとに 2 リクエスト** 必要（create + put）。タブ 50 件で 100 req + sub-list 作成 1 req
- `list.icon` が必須。Phase 1 は固定絵文字（例: `📑`）。Phase 2 でユーザー指定可に
- API key は `chrome.storage.local` 暗号化なし。OneTab Pro でも同等リスク
- cmdk は 1000-2000 件まで素で快適。**Karakeep 検索は cursor ページングなので popup には 1 ページ分（50 件）だけ流す**。virtualization は不要
- cmdk の Cmd+Enter（別タブ open）はビルトイン無し → `<Command>` の `onKeyDown` で独自実装
- OneTab Export 形式は **保存日時を持たない**。import 時の sub-list 命名は `Imported from OneTab #N` で順序付け、import 操作日を sub-list 作成日として残す

### OneTab Export 形式（インポート対応の根拠）

OneTab の Export はテキスト 1 行 1 URL、グループ区切りは空行:

```
https://example.com | Example Title
https://github.com/foo/bar | foo/bar: description

https://another.com | Another Group の URL
https://...
```

- 区切り: ` | ` (URL とタイトルの間)
- グループ区切り: 空行 1 行
- 各グループに保存日時情報は **含まれない** → import 時は「Imported from OneTab #N」のような sub-list 名で順番付け
- 拡張側 import UI でテキストボックスに貼り付け or `.txt` ファイル投入の 2 経路

---

## リポジトリ

未作成。Phase 1 着手時に以下を作る:

- 名前案: **`TakashiAihara/karakeep-advanced`** (将来の Highlight / Omnibox 系も同 repo or `karakeep-advanced-*` の系統で揃える)
- 場所: `~/.ghq/github.com/TakashiAihara/karakeep-advanced`
- 構造案: monorepo にして `extensions/tab-group/`、将来の系統は `extensions/highlight/` のように増やす。または初期は単一 repo `karakeep-advanced-tab-group` でスタートし、必要時に monorepo 化
- **How**（実装手順 / コード規約 / build 手順）はそちらの README + design-doc に置く。この vault ノートは Why / What のみ

---

## 進捗

### 2026-05-16
- 公式拡張 (`apps/browser-extension`) の機能境界を調査し、本拡張と機能領域が被らないことを確認
- 当初「公式の単一ページ保存に tag/list 指定 UI を追加する」方向で書きかけたが、「OneTab UX をそのまま Karakeep バックエンドに置き換える」方向にピボット
- プロダクト名を **Karakeep Advanced** に確定。"unofficial" 表記は廃止し、将来の同系統拡張も同ブランドで扱う方針
- ストアモデルを Hybrid (親 list `Tab Groups` + group ごと sub-list) に確定
- MVP 機能、スタック (WXT + TypeScript + cmdk + openapi-typescript/openapi-fetch) を決定
- 各ライブラリの gotcha・ベストプラクティスを公式 docs ベースで精査し、設計に反映:
  - WXT: popup ↔ background は message passing、shortcut は background 側に登録、host permissions は `optional_host_permissions` + ランタイム要求
  - cmdk v1.1.1 のメンテ状況、1 ページ 50 件運用で virtualization 不要、Cmd+Enter は独自実装
  - openapi-typescript v7 + openapi-fetch の middleware で Bearer 認証
  - Karakeep API の正確な仕様 (`parentId` camelCase, `icon` 必須, `source` enum, bulk endpoint なし, 重複 URL は 200 で既存返却)
- 実装着手・リポジトリ作成は未着手
