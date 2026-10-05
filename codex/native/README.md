# Native QA Guide 0.5.2

Node.js 22以降とMCP Apps対応ホスト向けのstdioプラグインです。ソースからビルドすると、`plugin/dist/server.mjs`と自己完結したパネルHTMLを生成します。実行時にnpmは不要です。

```sh
npm ci --ignore-scripts
npm run build
npm test
codex plugin marketplace add .
codex plugin add qa-guide-codex@qa-guide-local
```

CLI操作は専用のqa-guide-localカタログとqa-guide-codexプラグインを登録し、Codexの設定・プラグインキャッシュを更新します。同名の既存導入がある場合は先に差分と更新先を確認してください。他の単体skillを上書きする構成ではありません。

`plugin/`が配布パッケージです。質問の例は`test/question.json`にあります。`qa.open`へquestionと増加するrevisionを渡し、`qa.explain`には現在のquestionId・revision・requestId・textを渡します。空のqa.openは空パネルを開き、サーバーは質問を共有保存しません。

ラジオ選択だけでは送信しません。本人の確定で`ui/message`のactive会話へ回答します。ホストが送信を提供しなければボタンを無効にします。明確な拒否と到着不明を区別し、後者では再送を止めます。実行承認は含みません。

UIの標準resourceUriとChatGPT互換outputTemplate、HTML MIME、CSP、表示モード、出力スキーマを宣言しています。実機の表示・同じ会話への往復は使用するホストで別途確認してください。
