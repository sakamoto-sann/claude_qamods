# 公開版の検証記録

参照元はaieo-product/claude_qamods v0.4.0、コミット432ee81c179a1be51531eb3a3464056dbba3d40cです。元repoの追跡ファイルをバイト単位で比較し、全ファイルを変更せず保持していることを確認しました。LICENSEも同じ内容です。

公開する追加ファイルはREADME.CODEX.mdとcodex/以下だけです。元のClaudeコードは試験・実行していません。

- `node codex/panel/test.mjs`：13件通過。文脈の制限、状態移行、依頼と結果の照合、待機の読取り、実UIハンドラの代替DOM試験。
- `node codex/panel/http-test.mjs`：14件通過。架空のデータを使う一時localhostサーバーで、認証・origin・配信・再説明・明示的な試験選択・ask/readback・終了時の掃除を確認。
- JavaScript構文確認。manifestのJSON構文とskills参照先、スキルのfrontmatterとローカル参照先を確認。
- 追加ファイルに個人ホームパス、ローカル作業パス、セッションキー、APIキー、実会話記録が含まれないことを確認。ローカルのevidence/backup/sessionは公開対象外。

追加API・モデル呼出しは0件です。HTTP試験での選択は試験操作であり、本人の回答ではありません。

**実際のCodex画面での表示→本人の選択→回答読取り→自然な会話継続は未確認です。** HTTP試験・代替DOM試験でサイドバーの実機検証完了とは説明しません。使用量や料金は取得不可と表示します。上流の実験値をCodex版の性能として使いません。


## 公開ゲートのレビュー

gitleaksは漏洩なしでした。補助スキャンがruntimeのURL fragment取得・乱数生成・セッション比較と、架空fixtureのmockを検出しました。独立レビューで実秘密の埋込みではないことを確認し、ゲートが明示的に対応する `.hermes-secret-allowlist.json` にファイル・rule・行SHA256で固定した4件だけの例外を追加しました。ゲートや検査は無効化していません。行が変われば例外は一致しません。実行時の接続キーを公開する例外ではありません。
