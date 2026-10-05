# QA Guide for Codex / ChatGPT

The original Claude plugin and MIT license are preserved. Codex support is an independent adaptation under `codex/`, with a chat skill, an optional legacy localhost panel, a native MCP plugin, and a private Sites-hosted MCP App.

元のClaudeプラグインは変更せず、Codex版を独立して追加しています。質問の背景、対象タスク、現在状態、決める事項、完了条件、2〜3案の具体的な結果・利点・代償、おすすめの理由を示します。不要な質問や自動選択は行いません。

## Choose a form / 使い方

| Form | Location | Requirements |
| --- | --- | --- |
| Chat skill | [codex/skills/qa-guide](codex/skills/qa-guide) | A compatible skill host; no server |
| Native MCP App 0.5.2 | [codex/native](codex/native/README.md) | Node.js 22+, a host supporting MCP Apps |
| Private cloud MCP App 0.5.2 | [codex/cloud](codex/cloud/README.md) | Your own private Site and Sites-managed Install/Connect |
| Legacy localhost companion | [codex/panel](codex/panel) | Node.js 22+; explicit startup; no native host message bridge |

## Behavior and limits / 動作

回答は本人が選択して送信したときだけ、パネルを開いた現在の会話へ渡します。別途必要な実行承認の代用にはしません。明確な送信拒否では選択を保持して明示的に再回答できます。timeoutなど到着不明のときは二重送信を止めます。

再説明は明示操作で依頼し、questionId・revision・requestIdが一致する現在の依頼だけを一度受け取ります。未依頼・重複・古い説明は無視します。質問を更新するたびにrevisionを増やしてください。対象タスク情報と明示的なcontextは必須です。

会話用UIは一回の質問カードとしてinline表示を優先し、fullscreenもサポートします。ツール応答の成功、HTML取得、実画面の描画、回答が同じ会話へ届くことは別の検証です。ホストの対応とMCP Apps/Extensionsの能力を実機で確認してください。JSON応答だけを実表示成功とは扱いません。

元のClaudeのfunction-hooks、AskUserQuestion割込み、model.fork、サイドバー自動起動を再現したものではありません。質問と選択はUIメモリ内だけで、履歴DB、任意ファイル、秘密情報、他アプリを自動で読みません。外部AI APIや独自トンネルは使いません。トークン・料金の実測値を取得できない場合は取得不可と表示します。

## Development and tests

```sh
npm --prefix codex/native ci --ignore-scripts
npm --prefix codex/native run build
npm --prefix codex/native test
npm --prefix codex/cloud run build
npm --prefix codex/cloud test
node codex/panel/test.mjs
node codex/panel/http-test.mjs
```

Tests use synthetic fixtures. Native stdio and Web Standards HTTP tests exercise the built packages, metadata, resources, task validation, explicit rejection/retry, uncertain delivery, and request correlation. They do not prove a live ChatGPT/Dots UI rendered or that a real user reply arrived.

MIT ©2026 aieo-product. The original [LICENSE](LICENSE) and dependency notices are retained. No personal Site ID, credentials, real questions/answers, or internal execution records are part of the published source.
