# Codex support / Codex対応版

This is an official GitHub fork of [aieo-product/claude_qamods](https://github.com/aieo-product/claude_qamods). The original Claude Code v0.4.0 files and MIT license are preserved unchanged. The independent Codex adaptation lives in `codex/`: a chat skill plus an optional localhost Browser panel. It is not a native Codex extension and does not provide automatic sidebar hooks.

このforkは **aieo-productのqa-guide v0.4.0** を保ったまま、Codexのチャット用スキルと任意のローカル補助パネルを追加したものです。原作者の機能とライセンスはそのままです。Claude向けの使い方は元の [README.ja.md](README.ja.md) / [README.md](README.md) を参照してください。

参照コミット：[`432ee81c179a1be51531eb3a3464056dbba3d40c`](https://github.com/aieo-product/claude_qamods/commit/432ee81c179a1be51531eb3a3464056dbba3d40c)。v0.3の要点文脈・全文脈の再説明と、v0.4の使用量表示の考え方を確認して移植しました。元のClaudeコードをCodexで実行していません。

## 機能の対応

| 機能 | 元のClaude v0.4 | Codex版 |
| --- | --- | --- |
| AskUserQuestionと自動Pane表示 | 元の実装を保持 | 必要な質問をスキルで整理。パネルは明示起動・明示表示 |
| 目的・背景・選択後の結果・おすすめ | 元の実装を保持 | チャットと補助パネルで表示 |
| 最近の指示・質問直前の説明 | 元の実装を保持 | 会話から明示的に渡した要点を使用 |
| 要点文脈が既定 | 元のHaiku実装を保持 | 最新3件の指示・直前の説明・最新作業要約。追加モデル呼出しなし |
| 全文脈で再説明 | 元のfork/fallbackとボタンを保持 | ボタンが依頼を記録。呼出元のCodexが参照可能な会話で再説明し返却 |
| 実測トークン・API料金換算 | 元の使用量・価格表を保持 | 説明に対応する使用量を取得できず「取得不可」。推定値で埋めない |
| 日英表示・言語設定 | 元の実装を保持 | 同梱スキルとパネルの表示文は日本語 |
| 過去20件の履歴・p/n/l/h/a等 | 元の実装を保持 | 未実装。補助パネルは現在の1問だけ |
| 自由入力・複数選択・プレビュー | 元の実装を保持 | パネルは2〜3択の単一選択。チャットで追加条件を確認可能 |
| 回答の反映 | 元のダイアログ連携を保持 | 明示確定後、呼出元のCodexがJSONを読み同じ会話で確認 |
| セッション内の保持 | 元のstateを保持 | 質問・回答はメモリ。localhost接続情報だけ権限制限付きファイル |

Codex版は全機能の同等移植ではありません。元のClaude機能は削除・置換せず残しています。

## チャット用スキルの導入

Node.jsはパネルを使う場合だけ必要です。依存パッケージ、APIキー、MCP登録は不要です。

リポジトリのルートで次を実行します。同名スキルがある場合は停止します。他のスキルや設定を上書きしません。

```sh
mkdir -p "$HOME/.agents/skills"
if mkdir "$HOME/.agents/skills/qa-guide"; then
  cp -R codex/skills/qa-guide/. "$HOME/.agents/skills/qa-guide/"
fi
```

既存版を更新する場合は先にバックアップと差分確認を行ってください。同梱する `codex/.codex-plugin/plugin.json` は配布用のmanifestで、上の単独スキル導入には不要です。

Codexチャットで `$qa-guide` を指定し、「判断に必要な質問には、背景・選んだ結果・おすすめと理由を添えて」と依頼します。スキル本文を読み込んで適用します。短い質問には簡潔に答え、不要な質問や既に答えた質問を増やしません。実行承認を推薦や質問の選択で代用しません。

## 任意のパネルを使う

Node.js 22以降を使います。最初に一つだけ起動し、ターミナルを開いたままにします。

```sh
node codex/panel/server.mjs /tmp/qa-guide-panel-session.json
```

表示された `url` をCodexのBrowser欄に開きます。公式の表示ツールが使える場合はBrowser/rightを指定します。`queued` は表示要求の保留で、実画面の確認ではありません。URLのfragmentはランダムな接続キーです。公開・共有しないでください。

同じパネルが起動中ならそのセッションを再利用します。起動は既存セッションファイルを上書きしません。停止したセッションが残る場合はPIDと待受を確認してから未使用の別パスを指定します。自動削除や自動再起動はありません。

`demo-question.json` は架空の研修資料の例です。本人の会話から用意した質問JSONを使う際も同じ形式です。

```sh
node codex/panel/client.mjs ask /tmp/qa-guide-panel-session.json codex/panel/demo-question.json
node codex/panel/client.mjs wait-current /tmp/qa-guide-panel-session.json
```

`ask`は一度送信し、返された質問ID・revisionで待ちます。30秒未回答なら `pending:true` と終了コード2。待機の再開にaskを再実行せず、wait-currentを使います。ラジオの選択だけでは送信されません。「この選択を回答する」で確定するとCodexが読み取れるJSONになります。別チャットへ自動送信しません。

「全文脈で解説」を押すと、wait-currentがexplanationRequestedを返します。Codexが参照できる同じ会話から再説明し、次の形式のJSONを用意します。

```json
{"questionId":"training-format","revision":1,"requestId":1,"text":"この会話で確認できた追加の文脈に基づく説明"}
```

```sh
node codex/panel/client.mjs explain /tmp/qa-guide-panel-session.json explanation.json
node codex/panel/client.mjs wait-current /tmp/qa-guide-panel-session.json
node codex/panel/client.mjs state /tmp/qa-guide-panel-session.json
node codex/panel/client.mjs stop /tmp/qa-guide-panel-session.json
```

回答後の再説明依頼はstateで確認します。ボタンはCodexを自動起動しません。質問を再送して選択を解除することもありません。再説明依頼は質問の回答・実行承認ではありません。

## 検証と限界

```sh
node codex/panel/test.mjs
node codex/panel/http-test.mjs
```

単体試験は文脈の制限、移行、古い依頼・結果の拒否、待機からの読取りと実UIハンドラの代替DOM試験です。HTTP試験は専用の一時サーバー・架空の質問で実通信を確認します。実ユーザーの会話、ブラウザプロファイル、API、モデルは使いません。

ローカルの実通信・ハンドラ試験とCodexの実画面を区別します。**実際のCodexサイドバーで表示→本人が選択→回答読取り→自然な会話継続という全工程は未確認です。** ネイティブMCP Extension、Claudeのfunction-hooksやmodel.fork、Codexへの自動割込みは実装していません。

上流のトークン・費用比較は特定条件での実験結果です。Codex版の削減率や料金保証として使いません。Codexの説明に対応する実測値が取得できない現状では、料金ゼロ・使用量ゼロとも説明しません。

## 安全とライセンス

サーバーは127.0.0.1のみで待受し、ランダム接続キー、Host/Origin確認、CSP、サイズ制限を使います。表示はtextContentで行います。質問更新はrevisionを進め、古い回答・再説明は引き継ぎません。会話履歴DB・秘密情報・他のアプリ・ブラウザ設定は読み取りません。起動hook、常駐設定、追加の課金APIもありません。

公開版にセッションキー、個人パス、実会話の試験記録、ローカルのバックアップは含めていません。[公開内容の検証記録](codex/VALIDATION.md)を参照してください。

MIT © 2026 aieo-product。元の[LICENSE](LICENSE)を保持しています。Codex追加部分も同じMITライセンスで公開します。Codexの追加部分に関する問題はこのforkへ報告してください。元のClaudeプラグインに関する報告窓口は元のSECURITY.mdに記載されています。
