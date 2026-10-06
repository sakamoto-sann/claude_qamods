# 検証記録 0.6.2

2026-10-06時点。上流はaieo-product/claude_qamods v0.5.1、コミット `260d25cae05d91b9ee5572e5ee7b7eb24ed703bb`。上流の追跡ファイルをバイト比較し、変更せず保持しています。Codex実装は `codex/` 以下とREADME.CODEX.mdに独立しています。

## 確認した範囲

- NativeビルドとVitest：38件通過。実stdio初期化、3ツールの入出力スキーマ、版付きUIリソース、静的HTMLの構文、文脈の制限、説明の照合、古い返却・重複・早い返却、閉じる操作、代替DOMでの表示を確認。
- CloudビルドとVitest：7件通過。標準HTTP Client、3ツール、Sites識別の欠落拒否、明示文章の質問、リクエスト上限、要求ごとの独立したServer/Transportを確認。CloudとNativeの共有実装を比較。
- Stagehand 4.1.0＋Vitest：NativeとCloudのビルド済みHTMLで各1シナリオ通過。既存Chromeの一時プロファイル、公式AppBridge、制限CSP、allow-formsなしのiframeを使用。空状態、選択肢の補足のみ、inline既定と手動拡大・縮小、要約・全文脈の照合、閉じる、新revision、送信非対応ホスト、後片付けを確認。
- 旧localhost companion：状態・代替DOM13件、HTTP14件通過。
- manifestのJSON、skillsの参照先、差分の空白、個人パスの混入を確認。gitleaksは漏洩なし。固定依存のnpm auditは脆弱性なし。

合成データのみを使い、外部AI API、認証済みブラウザプロファイル、個人のSite ID、実会話記録は使っていません。

## 制限

**実際のCodex/ChatGPTホストでのパネル表示と、本人の解説依頼から同じ会話への往復は未確認です。** 公式SDKとのブラウザ試験と実機ホストの検証を区別しています。標準質問UIの捕捉・ボタン追加・自動割込みは実装していません。

変更後の差分について、implementation-final-reviewの手順で読取り専用セルフレビューを実施しました。独立レビュアーは利用できず、サブエージェントは使っていません。入力契約、Cloudの識別境界、メッセージ照合、UI状態の切替、ビルド置換処理を確認しました。

元のClaude版の実機セッションと型チェックは未実施です。手元のClaude Code 2.1.197では、上流manifestのuserConfig.optionsをvalidateが拒否し、plugin testコマンドも提供されません。これは上流のfunction-hooks対応ランタイムとの互換性制限として記録し、上流ファイルを独自に書き換えていません。Codex版のテスト結果とは分けています。

## 既存の公開ゲート

旧localhost実装の合成fixture・動的URL fragment・乱数生成・比較処理に対する、行SHA256で固定した `.hermes-secret-allowlist.json` の4件は維持しています。秘密情報prefixと誤検知された上流の架空タスク通知タグ2行、静的HTMLのタスク参照要素2行、Chromeのキャッシュ制限引数1行だけを、同じ方式の固定例外に追加しました。実認証情報を公開する例外は追加していません。
