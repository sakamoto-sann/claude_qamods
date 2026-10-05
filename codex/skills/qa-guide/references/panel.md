# ローカル補助パネル

ユーザーがパネルを求めた場合だけ使う。クローンしたリポジトリの `README.CODEX.md` を読み、`codex/panel/` の場所を確認する。場所が不明なら一度聞く。会話履歴DBやブラウザプロファイルから探さない。

1. 同じ作業の起動済みセッションを再利用する。なければ依頼の範囲で `node codex/panel/server.mjs SESSION_FILE` を起動する。公開待受・MCP登録・常駐化・hook・ブラウザ設定変更は追加しない。
2. この会話で明示的に得た質問・全選択肢・目的・制約・背景をJSONにする。contextのrecentInstructionsは最新3件の本人の指示、precedingExplanationは直前の説明、latestWorkSummaryは最新の作業状況。古い指示より最新の訂正を優先する。足りない情報を推測しない。
3. 起動URLを利用可能な公式Codex表示ツールでBrowser欄へ開く。queuedを表示済みと説明しない。画面操作ツールがなければ、その制約と最小の手動操作を伝える。これはローカル補助UIであり、ネイティブMCP ExtensionやClaudeのPane APIを再現していない。
4. `node codex/panel/client.mjs ask SESSION_FILE QUESTION.json` で一度送信して待つ。pendingは未回答。再開は `wait-current SESSION_FILE`、または同じID・revisionのwaitを使う。再publishして選択を解除しない。
5. explanationRequestedを受けたら質問ID・revision・requestIdを確認し、この会話で参照できる文脈から再説明する。その4項目（textを含む）をJSONにし、`client.mjs explain SESSION_FILE EXPLANATION.json` で返す。その後wait-currentを再開する。回答後の依頼はstateで確認する。別モデルAPI・秘密情報・別スレッドを使わず、全文脈の参照範囲が限られる場合は明示する。
6. 本人の回答を読み取ったら質問ID・revisionを確認し、選択と結果を同じ会話で短く確認する。本人の訂正は新しい質問として更新する。推薦・試験操作・再説明依頼を本人の回答や別途必要な実行承認に変えない。

この補助UIはCodexを自動起動・自動割込みせず、別スレッドへ送信しない。呼出元のCodexが明示的に質問を渡し、回答と再説明依頼を読む。トークン・料金はこの説明に紐づく実測値を取得できない現状では取得不可と表示する。
