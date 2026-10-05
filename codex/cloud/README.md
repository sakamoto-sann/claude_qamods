# Private Sites QA Guide 0.5.3

本人専用のSites MCP App向けWorkerです。`POST /mcp`でqa.open、qa.explainと会話用UIを提供します。Node用stdioサーバーをクラウドから起動する構成ではありません。

まずリポジトリの`codex/native`で固定lockfileの依存を復元します。SDKとesbuildは同じバージョンを使います。

```sh
npm --prefix ../native ci --ignore-scripts
npm run build
npm test
```

`worker/source/`が実装で、`scripts/generate-worker.mjs`がSDK・パネルを`worker/index.js`へバンドルします。Worker ESMの標準buildは`dist/server/index.js`と`dist/.openai/hosting.json`を作成します。

## Private publishing

ChatGPT/Codexの公式Sitesワークフローで本人専用の新しいSiteを作り、返されたproject IDを`.openai/hosting.json`へ保存します。既存Siteを更新する場合はそのIDを再利用します。このソースには作者のSite IDを含めていません。

MCP capabilityを保持して、公式ソース同期・保存・私有公開を実行してください。Sitesが作るcanonical private pluginを再利用し、別途create_pluginで複製しません。Plugins → Personal → Created by youからInstall/Connectし、Sites標準OAuthの確認を完了します。URLを開くこと、公開成功、プラグイン接続、会話用widgetの描画は別の状態です。

このWorkerはSites Dispatchの本人専用アクセスと注入されたユーザー識別を前提とします。識別ヘッダーの存在だけを独立した認証として扱う公開ホストへ移さないでください。データを含む呼び出しはユーザー識別がなければ401です。サービス用認証はユーザー識別の代用になりません。独自OAuth・APIキー・トンネルを追加しません。

D1/R2や外部AI APIは使いません。明示的な質問・背景・選択肢・文脈・再説明のみを処理し、要求ごとにServer/Transportを閉じます。回答はUIからホストへ送ります。ファイルや会話履歴は自動で読みません。アプリに永続保存がないことは、Sites/ChatGPTの通常の通信・会話記録が一切残らないという意味ではありません。

The UI resource URI is `ui://qa-guide/question-panel/v0.5.3.html`. Both UI tools refer to this versioned cache key. Publish a new URI for a breaking HTML, JavaScript or CSS change; updating server version alone does not change that key. See the official [UI resource cache-key guidance](https://developers.openai.com/plugins/build/chatgpt-ui).

## Verification

HTTP tests use local Request/Response and synthetic identity fixtures; no hosted identity is forged. Verify initialization, both tools, schema, static UI resource, error limits and stateless isolation. Native shared tests cover the same UI delivery state, rejection/retry and stale explanations.

After Install/Connect, verify in the intended conversation: question display → explicit choice → answer in the same conversation → explicit explanation request → matching requestId returned once to the same panel. Tool JSON or a website page is not proof that the conversation view rendered.

Official references: [Site/plugin workflow](https://developers.openai.com/plugins/deploy/connect-chatgpt), [MCP UI troubleshooting](https://developers.openai.com/plugins/deploy/troubleshooting), [MCP Apps/Extensions](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md).
