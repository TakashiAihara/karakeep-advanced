# Roadmap — tab-group extension

本ドキュメントは調査に基づく roadmap。個々の決定とその理由は `decisions.md`、
各作業項目は GitHub issue にある。

調査は subagent 4 本 (Product/UX・アーキテクチャ・Karakeep 統合・品質/運用) で行い、
そのうちコードと `../../extensions/tab-group/src/karakeep/schema.d.ts` を実際に読んで成立を確認したものだけを採用した。

## 現状の位置づけ

- Phase 1 / 2 の機能スコープはほぼ実装済み (PR #1〜#16)
- 拡張は Karakeep を「書き込み先」として使っている。保存したあとのことは Karakeep 本体 UI 任せ
- 結果として、保存が半分失敗しても拡張からは見えず、グループが増えても拡張の中では片付けられない

## あるべき姿

Karakeep が「タブアーカイブの正」であり、拡張はその上に乗る
**壊れない / 再開できる / 端末を跨いで一貫したクライアント**。原則は 3 つ。

### 原則 1 — 保存は失敗しても失われない

今は「途中で落ちたら Karakeep に孤児が残り、拡張からは見えない」(A2 / A3)。
保存はジョブとして永続化し、再開でき、sub-list 作成は冪等で、結果は経路によらず必ずユーザーに届く。

### 原則 2 — グループのメタデータはサーバーに置く

今はタブ件数を list 名の正規表現から復元しており、rename した瞬間に壊れる (O-C / P5)。
`List.description` がサーバー側に実在し PATCH できる (K1) ので、そこに置く。
chrome.storage に置く案は端末間で共有されず、本プロジェクトの存在理由と矛盾するので採らない。

### 原則 3 — 閲覧と整理は popup ではなくマネージャーページ

popup は 360px 幅・Recent 20 件固定で、OneTab の中核操作
「グループの中身を見て、要るものだけ取り出す」が構造的に置けない (P4 / P5 / O-G)。
`GET /lists` にページングが無い (K6) ので、一覧のキャッシュはクライアント側が持つしかなく、
その置き場としてもマネージャーページが要る。

## Milestone

| ID | 名前 | 狙い | 依存 |
|---|---|---|---|
| M0 | 品質基盤 | 壊れたことに気づける状態を作る | なし (M1 と並走) |
| M1 | 保存の信頼性 | 原則 1。以降の全機能がこの上に乗る | なし |
| M2 | メタデータのサーバー移行 | 原則 2。M4 の前提 | なし (M1 と並走可) |
| M3 | マネージャーページ | 原則 3 | M2 (キャッシュ形状を共有) |
| M4 | 整理の自動化 | グループ数の爆発を止める | M2 (メタデータ) + M3 (保護 UI) |

**M1 と M0 を先に置く理由**: 現在の保存は「半分失敗しても気づけない」状態で、
この上に機能を積むと不具合を全部継承する。Phase 3 の機能追加より先に土台を直す。

## M0 — 品質基盤

| # | 項目 | 根拠 | 規模 |
|---|---|---|---|
| M0-1 | 純粋ロジックの unit test (`saveable-tabs` / `one-tab-export` / `concurrency`) | unit test 0 件 (A6)。設計ドキュメントの「後追いする」が実行されていない | S |
| M0-2 | `summarize` を export して tabCount パーサをテスト | 未 export でテスト不能 (A7)。skip 中の E2E が守るはずだった契約 | S |
| M0-3 | CI (typecheck + unit の 2 ジョブのみ) | `.github` が存在しない | S |
| M0-4 | Biome 導入 (未 await Promise 検知を主目的) | linter 設定 0 件。`void` 付け忘れが実バグになる形 | S |
| M0-5 | LICENSE 選定 | public repo で README が "TBD" のまま | S |

**E2E は CI に載せない。** chromium + 拡張ビルド 2 回で数分かかり、1 人 + 数名の開発速度に見合わない。
ローカルで `bun run test:e2e` を手動で回す現行運用を維持する。

## M1 — 保存の信頼性

| # | 項目 | 根拠 | 規模 |
|---|---|---|---|
| M1-1 | 保存ジョブを `chrome.storage.session` に永続化し、SW 再起動後に再開 or 警告 | 進捗の永続化が 0 (A2)。途中で落ちると孤児 sub-list ができ Recent にも出ない | M |
| M1-2 | sub-list 作成を冪等にする (ジョブが持つ `subListId` を再利用) | 現状は無条件 POST (A3)。再試行のたびにゴミが積む | S |
| M1-3 | popup 経由の保存にも通知を出す | 通知は shortcut / context menu 経路のみ (A1)。scope=all はウィンドウごと閉じるので成功 UI に構造的に到達できない (O-B) | S |
| M1-4 | `client.ts` にリトライ + バックオフの middleware | リトライ機構が皆無 (A5) | M |
| M1-5 | 失敗した URL だけを再送する UI | 設計ドキュメントが明記しているのに未実装 (P3) | M |
| M1-6 | `runSave` の例外ハンドリング | try/catch が無く、message port が閉じると popup が固まる (A4) | S |
| M1-7 | 最後の保存結果を storage に残し options に出す | 失敗 URL が popup を閉じた瞬間に消える | M |

`bookmark` の POST は重複 URL に 200 を返すので再送が安全 (K5 の裏返し)。
危険なのは非冪等な sub-list 作成側なので、M1-2 を先に入れると M1-4 / M1-5 が安全になる。

## M2 — メタデータのサーバー移行

| # | 項目 | 根拠 | 規模 |
|---|---|---|---|
| M2-1 | `List.description` にグループのメタデータを保存する | `description` は実在し GET で返り PATCH できる (K1) | M |
| M2-2 | tabCount を description から読む (名前の正規表現をやめる) | rename でメタデータが壊れる (O-C) | S |
| M2-3 | Recent 一覧のキャッシュ + stale-while-revalidate | `GET /lists` は全件返すしかない (K6)。毎回フルフェッチ・オフラインで即エラー | M |
| M2-4 | 親 list ID キャッシュのフォールバック (失敗時に 1 回だけ再解決) | キャッシュが腐ると保存が永久に失敗し続ける単一障害点 | S |

## M3 — マネージャーページ

| # | 項目 | 根拠 | 規模 |
|---|---|---|---|
| M3-1 | `entrypoints/manager/` の新設と一覧 (ページング / 仮想スクロール) | Recent 20 件固定 (P4)。popup 360px では置けない | L |
| M3-2 | グループ展開 → 個別タブの表示 / 個別 open / 個別削除 | OneTab の中核操作が存在しない (P5 / O-G) | M |
| M3-3 | 複数選択での一括操作 (delete / open) | 1 グループずつしか操作できない | M |
| M3-4 | 検索の cursor 継続 ("もっと見る") | `nextCursor` を取得しているのに UI が未使用 (P2) | S |
| M3-5 | Export (OneTab 互換テキスト / JSON) | Import のみ実装 (P6)。ロックインを排除するという存在理由と対称 | S |

## M4 — 整理の自動化

| # | 項目 | 根拠 | 規模 |
|---|---|---|---|
| M4-1 | Star / Lock でグループを保護 | M4-2 を安全に動かす前提。無いと「大事なグループが勝手に消えた」事故が起きる | M |
| M4-2 | auto-archive (N 日未 restore を Archived Tab Groups に移動) | `parentId` を PATCH できるので実装可能 (K2)。List に archived フラグは無いので親付け替えが唯一の手段 | L |
| M4-3 | グループの split / merge | 設計ドキュメントの Phase 3 項目 | L |

## 明示的にやらないこと

| 項目 | 理由 |
|---|---|
| E2E の CI 常時実行 | 重量に見合わない。ローカル手動を維持 |
| storage のバージョニングを予防的に導入 | 破壊的スキーマ変更がまだ 1 度も起きていない |
| API キーの暗号化 / OS keychain 連携 | 個人 + LAN backend の脅威モデルに対して無意味 |
| Sentry 等の外部エラートラッキング | storage 1 項目 + options 1 セクションで足りる |
| smart list でグループを表現する | グループは「その時点の任意 URL の固定集合」でクエリで再現できない。manual list が正しい |
| sub-list への tag 付与 | list に tag を付ける API が存在しない (K4) |
| 本格的なジョブキュー / CRDT / WebSocket 同期 | 個人ツールに対して過剰 |
| Chrome Web Store 配布・課金・マルチユーザー | 設計ドキュメントのスコープ外 |

## セキュリティの現実的な評価

- `optional_host_permissions: ['<all_urls>']` は**宣言の枠**で、実際の要求は
  `new URL(serverUrl).origin + '/*'` の 1 origin のみ (`options/App.tsx:22`)。
  「全サイトにアクセスできる拡張」ではないので、ここは過大評価しない。
- API キーの平文 storage 保存は、この脅威モデルでは許容。
- 実在するリスクは 1 つだけ: `isValidUrl` が `http:` を許すので (`options/App.tsx:15`)、
  信頼できないネットワークで使うと Bearer トークンが平文で流れる。
  コード変更ではなく README / options の注記で足りる。

## Milestone と issue の対応

| Milestone | issue |
|---|---|
| M0 — Quality foundation | #17 #18 #19 #21 #22 #23 #24 #42 |
| M1 — Save reliability | #25 #26 #27 #28 #29 #30 #31 |
| M2 — Server-side metadata | #32 #33 #35 #36 |
| M3 — Manager page | #34 #37 #38 #39 |
| M4 — Lifecycle | #40 #41 |
