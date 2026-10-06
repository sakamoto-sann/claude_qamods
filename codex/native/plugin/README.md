# QA Guide 0.6.2

Node.js 22.18以降で起動するstdio MCPと、必要なときだけ使う質問の補足パネルです。ビルドと導入は一つ上のREADME.mdを参照してください。

通常はCodex標準の質問UIまたはチャットで回答します。同梱スキルは必要な判断質問の書き方に適用し、詳しい解説を求めた場合だけパネルを開きます。パネルは背景と選択肢の違いを示し、回答欄は作りません。inline表示を優先し、拡大は本人の操作に任せます。

`qa.chat` は明示された文章から質問と選択肢を検出し、推奨を作りません。再説明はquestionId・revision・requestIdで照合します。古い・重複・未依頼の返却を無視し、閉じた質問は新しいrevisionまで再表示しません。

UI状態はメモリだけです。履歴DB、任意ファイル、外部AI API、実行hooksを追加しません。MIT ©2026 aieo-productのLICENSEとTHIRD_PARTY_NOTICES.mdを保持しています。
