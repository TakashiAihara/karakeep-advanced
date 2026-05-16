# Phase 2 — Tab Group Extensions

`extensions/tab-group` の Phase 2 設計ドキュメント。Phase 1 が「自分が OneTab を完全に置き換えられる状態」を達成したのを前提に、運用上のロングテールをカバーする。

## ゴール

Phase 1 の完成形を毎日使う中で出てくる細かい不便を一掃する:

- Pinned タブまで巻き込みたくない
- 「今のウィンドウのうち active 以外」「選択しているタブだけ」を保存したい
- アドレスバーから右クリックで現在ページや選択タブを保存したい
- 過去の保存セッションをリネーム / 削除して片付けたい
- 一括 restore で **新ウィンドウ** に展開したい (今のウィンドウを汚さない)

## 機能スコープ

| ID | 機能 | 動線 |
|----|------|------|
| F2-1 | Pinned タブ除外設定 (default ON) | options 画面の checkbox |
| F2-2 | 保存対象スコープ: All / Others / Selected | popup Save タブの radio / segmented control |
| F2-3 | context menu: "Save this page to Karakeep" | active タブ 1 件を Karakeep に追加 |
| F2-4 | context menu: "Save selected tabs to Karakeep" | highlight 中のタブをまとめて 1 sub-list |
| F2-5 | Recent タブで sub-list を rename | inline edit |
| F2-6 | Recent タブで sub-list を delete | confirm dialog 付き |
| F2-7 | Open all を新ウィンドウで実行できる | 行末の menu / 補助ボタン |

## アーキテクチャ追加点

### storage 追加

```ts
export const excludePinnedItem = storage.defineItem<boolean>('local:excludePinned', {
  fallback: true,
});
```

### saveTabsAsGroup の scope 拡張

現在の selectTabs はすでに `'all' | 'others' | 'selected'` を受け取れる。今回は:

- `excludePinnedItem` 読込 → pinned 除外を default にする
- Phase 2 では「selected」が "popup から呼ばれた瞬間に highlighted なタブ" を意味する。highlighted が無い場合は active タブ 1 件にフォールバック (現状の挙動)
- context menu からの呼び出しは「click 時の tab 情報」を受け取って scope='single' を新設

新 scope:

```ts
export type SaveScope = 'all' | 'others' | 'selected' | 'single';
```

`'single'` は tabId を別引数で渡し、ピンポイント保存に使う。

### context menu 登録

```ts
// src/commands/context-menus.ts
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: 'kk-save-page',
    title: 'Save this page to Karakeep',
    contexts: ['page', 'frame', 'link'],
  });
  browser.contextMenus.create({
    id: 'kk-save-selected-tabs',
    title: 'Save selected tabs to Karakeep',
    contexts: ['page'],
  });
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'kk-save-page' && tab?.id) {
    void runSaveSingle(tab);
  } else if (info.menuItemId === 'kk-save-selected-tabs') {
    void runSaveSelected();
  }
});
```

結果は notification で通知 (shortcut と同様)。

### Recent タブ: rename / delete

- 行ホバーで `✏️` / `🗑️` のアイコンボタンを露出
- rename: inline で input → Enter で `PATCH /lists/{id}` (公開済み endpoint `updateList`)。
- delete: confirm dialog → `DELETE /lists/{id}` → `recentGroupIds` から id を pull
- 楽観的更新せず、API 成功後に再 fetch (`LIST_RECENT_GROUPS`)

新 message:

```ts
type Request =
  | …
  | { type: 'RENAME_GROUP'; listId: string; name: string }
  | { type: 'DELETE_GROUP'; listId: string };

type Response =
  | …
  | { type: 'RENAMED'; listId: string; name: string }
  | { type: 'DELETED'; listId: string };
```

### Open all: 新ウィンドウオプション

`openGroup` を `{ window: 'current' | 'new' }` で受ける。新ウィンドウの場合は `browser.windows.create({ url: urls })` を呼ぶ (Chrome は配列の URL を渡せる)。

新 Request シェイプ:

```ts
{ type: 'OPEN_GROUP'; listId: string; target?: 'current' | 'new' }
```

`target` 未指定は 'current' (Phase 1 互換)。

### 自動 cleanup の前準備

- 削除や rename された list があると `recentGroupIds` がドリフトする。Phase 2 では削除時に store を即座にクリーンアップする pass を入れる。fully auto cleanup は Phase 3 で。

## PR 分割案

| # | タイトル | 内容 | 推定 |
|---|---|---|---|
| Phase 2 / PR1 | feat(tab-group): Pinned 除外 + scope selector | options checkbox / popup scope segmented / saveTabsAsGroup の selectTabs 改修 + tests TBA | ~500 行 |
| Phase 2 / PR2 | feat(tab-group): context menu integrations | manifest permissions, src/commands/context-menus.ts, background から呼び出し | ~300 行 |
| Phase 2 / PR3 | feat(tab-group): rename / delete in Recent tab | RENAME_GROUP / DELETE_GROUP message + flow + Recent UI | ~500 行 |
| Phase 2 / PR4 | feat(tab-group): Open all in new window | OPEN_GROUP target option + openGroup flow + Recent UI menu | ~300 行 |

各 PR は単体で動作する状態を保つ。

## スコープ外 (Phase 3 以降)

- 共有 URL 生成
- auto-cleanup (`recentGroupIds` から消えた sub-list を Karakeep 側も整理)
- Tab group の split / merge
- 統計 (よく restore する group など)
- 多言語 (i18n)

## 承認

このドキュメントを基に PR1 から着手する。
