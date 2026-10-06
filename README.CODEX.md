# QA Guide for Codex

上流 [aieo-product/claude_qamods](https://github.com/aieo-product/claude_qamods) v0.5.1 を取り込んだ、Codex向けの独立した実装です。元のClaudeプラグインとMITライセンスを保持しています。

## 使い方

通常はCodex標準の質問UIで回答します。質問UIが使えない場合はチャットで聞きます。背景、選択後の結果、主な利点と代償、おすすめの理由を短く示すガイドは、必要な判断の質問に適用します。許可済みの作業への確認や、短い事実回答に余分な質問を加えません。

「詳しく」「??」と頼んだ場合だけ、QAパネルで質問の背景と選択肢の違いを補足します。回答先は標準UIまたはチャットの一箇所です。パネルには回答欄を置かず、要約・全文脈での解説・閉じる操作を回答や実行承認として扱いません。

| 導入形態 | 場所 | 条件 |
| --- | --- | --- |
| 質問ガイドのみ | [codex/skills/qa-guide](codex/skills/qa-guide) | スキル対応ホスト。サーバー不要 |
| Native MCP App 0.6.2 | [codex/native](codex/native/README.md) | Node.js 22.18以降、MCP Apps対応ホスト |
| Private cloud MCP App 0.6.2 | [codex/cloud](codex/cloud/README.md) | 本人専用Site、Sites標準Install/Connect |
| 旧localhost companion | [codex/panel](codex/panel) | 従来の明示起動方式。新しい標準フローはNative版 |

スキルの導入はこのリポジトリ内だけに限定されるものではありません。Nativeプラグインに同梱のスキルは、対応ホストで利用可能になった会話の判断質問に適用します。利用可能な質問ツールの条件は各セッションの指示に従います。

## 動作と範囲

`qa.open` は明示された構造化質問の補足を表示します。`qa.chat` は渡された文章末尾の質問と明示された選択肢を検出し、架空の選択肢やおすすめを作りません。どちらも会話を自動監視しません。

パネルはinline表示を優先し、拡大・縮小は本人のクリックで切り替えます。要約・全文脈の解説は同じ会話へ依頼し、`qa.explain` のquestionId・revision・requestIdが一致する返却だけを受け取ります。古い・重複・未依頼の返却は無視し、閉じた質問は新しいrevisionでのみ再表示します。

Claudeのfunction-hooks、AskUserQuestion割込み、model.forkをCodexで再現するものではありません。履歴DB、任意ファイル、別会話を自動収集せず、外部AI APIを追加しません。使用量・料金・削減率の取得できない値は作りません。

## 開発と検証

```sh
npm --prefix codex/native ci --ignore-scripts
npm --prefix codex/native run build
npm --prefix codex/native test
npm --prefix codex/cloud run build
npm --prefix codex/cloud test
npm --prefix codex/native run test:browser
QA_BROWSER_PANEL_MODULE=../cloud/worker/source/panel-html.mjs npm --prefix codex/native run test:browser
node codex/panel/test.mjs
node codex/panel/http-test.mjs
```

テストはVitestとStagehand v4を使い、既存Chromeの一時プロファイルで合成データを確認します。ブラウザやモデルをダウンロードせず、APIキーや認証済みプロファイルは使いません。検証範囲と実機で未確認の点は [codex/VALIDATION.md](codex/VALIDATION.md) に記載しています。

MIT ©2026 aieo-product。個人のSite ID、認証情報、実会話記録は含めません。
