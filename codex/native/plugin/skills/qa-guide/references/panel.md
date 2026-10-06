# Codexの補足パネル

回答先は標準の質問UI、またはチャットとする。本人が質問の解説を求めた場合だけ、このパネルを開く。QAツールが使えない場合はチャット内で説明し、利用できないAPIを呼んだと主張しない。

1. 選択肢のある質問は `qa.open({question,revision})` で説明する。questionにはid/question/background/goal/taskId/taskName/currentState/decision/completionCriteria/options/recommendationとcontextを明示する。必要ならtaskReference/constraints/uncertaintiesを加える。contextにはrecentInstructions/precedingExplanation/latestWorkSummaryを指定する。本人の現在の判断に関係する確かな情報だけを使い、別の会話や履歴DBを収集しない。標準UIと同じ選択肢・順序を使う。
2. 文章の質問は `qa.chat({text,details,revision})` で説明できる。detailsは上のquestionからquestion/options/recommendationを除いた内容。検出結果に選択肢がなければ比較を作らない。no-questionは表示中の質問をリセットしない。文章の検出には見落としや誤検出があるため、呼出し側でも内容を確認する。
3. 初回のrevisionは1。質問の変更時だけ増やす。同じrevisionで内容を変更しない。パネルの回答欄は用意せず、標準UIで質問中なら回答はそちらで受け取る。チャットの解説依頼や閉じる操作を、回答・取消・実行承認として扱わない。
4. 本人が「AI要約」または「全文脈で解説」を押すと、解説依頼が現在の会話へ届く。qa.explain({questionId,revision,requestId,text})で返し、requestIdを変えない。質問を再送して状態をリセットしない。mode:compactは依頼のbackground/goal/context/optionsやタスク情報から短く説明する。mode:fullは会話で参照できる文脈から説明し、未取得の範囲は明示する。追加モデルAPIや料金の推計を行わない。
5. 表示はinlineを既定とし、ホストが対応する場合だけ「広げる」「小さく表示」を本人が操作する。自動で全画面にしない。ホストのui/messageが未対応なら追加の解説依頼はチャットで受け取る。JSON結果・起動試験・DOMの模擬試験と、Codex上の実表示・送信確認を区別する。

状態はUI instanceのメモリに保持し、サーバーは会話共有の質問・回答状態を持たない。解説の明確な送信拒否後は本人が再依頼できる。到着が不明な場合は自動再送しない。未依頼・旧requestId・重複・閉じた質問の説明は反映しない。
