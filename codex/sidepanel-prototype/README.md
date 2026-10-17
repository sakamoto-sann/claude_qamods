# QA Guide sidepanel preview

現行のQA Guideを置き換えず、別名のMCPプラグインでサイドパネル表示を試す試作です。既存版の設定やスキルは変更しません。

## ビルドと表示

Node.js 22.18以降とPython 3を使います。

```sh
npm --prefix codex/native ci --ignore-scripts
node codex/sidepanel-prototype/build-native.mjs
python3 codex/sidepanel-prototype/start.py
```

http://127.0.0.1:8766/ をCodex内蔵ブラウザーで開きます。サーバーはループバックにのみバインドし、ターミナルのセッションから独立して動きます。同じプレビューが動いていれば再利用します。停止後はstart.pyで復旧できます。ログ・PIDはGitに含めません。

幅360pxとパネル幅の切替、背景の展開、閉じる・再表示を試せます。再表示ごとに8秒後の接続状態を確認し、失敗時には起動手順を示します。模擬ホストではAI解説ボタンを無効にしています。

iCloudなどのクラウド管理下でファイルが退避される環境では、通常のローカルディスクにチェックアウトしてください。

## 別名のプラグイン

```sh
codex plugin marketplace add ./codex/sidepanel-prototype/native-marketplace
codex plugin add qa-guide-sidepanel-preview@qa-sidepanel-preview-local
```

表示名は **QA Guide Sidepanel Preview**、入口は **質問の解説（試作）** です。空引数でサンプルを表示します。MCP名はqa-sidepanel-preview、ツール名はqapreview.panel/open/chat/explainです。現行版と名前を分け、スキルは同梱しません。

明示的な質問はqapreview.openへ渡します。別タブとの状態共有、会話の自動捕捉、外部AI API呼び出しは実装していません。回答・承認は既存のチャットで受け取ります。

## 検証と制限

```sh
node codex/sidepanel-prototype/check-native.mjs
node codex/sidepanel-prototype/check-retry.mjs
python3 codex/sidepanel-prototype/check-preview.py
```

初期化、ツール名の分離、唯一のthread入口、サンプル、HTML取得、質問更新、再説明ID、不正revision拒否を検証します。ビルド元は同じリポジトリのcodex/nativeです。原本は読み取りだけで、生成先は試作フォルダ内です。SDKを含む生成物はGitに含めません。MITのLICENSEとTHIRD_PARTY_NOTICESを保持します。

ブラウザー表示とstdio検証は、ネイティブMCPタブでの表示成功とは別です。CodexのMCP専用タブの実表示は未検証です。独立レビューツールが利用できず、別工程の読み取り専用セルフレビューを実施しました。

ライセンス表記はesbuildの入力一覧から生成し、SDKの直接依存@cfworker/json-schemaも補足します。このパッケージのnpm配布物にライセンス本文がないため、公式リポジトリの[LICENSE.md](https://github.com/cfworker/cfworker/blob/main/LICENSE.md)をlicenses/に保持しています。
