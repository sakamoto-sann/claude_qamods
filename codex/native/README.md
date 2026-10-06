# Native QA Guide 0.6.2

Node.js 22.18以降とMCP Apps対応ホスト向けのstdioプラグインです。固定lockfileからビルドすると、自己完結した `plugin/dist/server.mjs` とパネルHTMLを生成します。実行時のnpm依存は不要です。

```sh
npm ci --ignore-scripts
npm run build
npm test
codex plugin marketplace add .
codex plugin add qa-guide-codex@qa-guide-local
```

CLIは専用qa-guide-localカタログとプラグインを登録します。同名の既存導入がある場合は更新先と差分を確認してください。配布物は `plugin/`、合成質問例は `test/question.json` にあります。

同梱スキルは本人の判断が必要な質問に適用します。通常の回答先はCodex標準の質問UIまたはチャットです。本人が「詳しく」「??」を求めた時だけ、`qa.open` または `qa.chat` で質問の補足パネルを開きます。パネルはinline表示を優先し、本人のクリックで拡大できます。回答欄や自動選択はありません。

`qa.open` には質問と増加するrevisionを、`qa.chat` には明示された文章と必須のタスク情報を渡します。空のqa.openは空パネルです。サーバーは質問を保存せず、別会話の状態を共有しません。

要約・全文脈の解説ボタンは同じ会話への説明依頼です。`qa.explain` は現在のquestionId・revision・requestId・textを返します。相関しない返却は無視し、明確な拒否と到着不明を区別します。ホストが送信を提供しなければボタンを無効にし、チャットで依頼する案内を示します。閉じる操作は回答や作業の取消ではありません。

UI resource URIは `ui://qa-guide/question-panel/v0.6.2.html`。標準resourceUriと互換outputTemplate、HTML MIME、CSP、表示モード、入出力スキーマを宣言しています。実際のCodex画面での表示と会話への往復は別途確認が必要です。

`npm run test:browser` はStagehand v4とVitestで、制限CSPとallow-formsなしの実iframeを確認します。必要なら `CHROME_BIN` に既存Chromeの実行ファイルを指定します。使うのは一時プロファイルと合成データだけです。ルート・待機処理は `test/helpers/browser-host.mjs` にまとめています。
