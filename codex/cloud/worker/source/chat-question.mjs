// Adapted from aieo-product/claude_qamods v0.5.1 (MIT). Explicit caller text only.
const COURTESY = /(他に|ほかに|何か(あれば|ありましたら|気になる)|お気軽に|いつでも|anything else|let me know if|feel free|any (other )?questions|need anything|happy to help)/i
const ASKING = /(しますか|ますか|でしょうか|どうしますか|よろしいですか|どちら|どれ|いかがですか|ませんか|\b(should i|shall i|would you like|do you want|which|what would you prefer|can you confirm|ok to|okay to)\b)/i

/** The last question sentence of a turn's final text, if it reads like Claude waiting on a decision. */
export function detectWaiting(answer) {
  if (typeof answer !== 'string' || answer.length > 16000) throw new Error('文章は16000文字以内で指定してください');
  const text = answer.replace(/```[\s\S]*?```/g, '').trim()
  if (!text) return null
  const tailText = text.slice(-600)
  const sentences = tailText.split(/(?<=[。？！?!])\s*|\n+/).map(x => x.trim()).filter(Boolean)
  const last = [...sentences].reverse().find(x => /[?？]$/.test(x) || ASKING.test(x))
  if (!last || COURTESY.test(last)) return null
  // Only the final paragraph or the line just before a trailing list counts.
  const lastLines = text.split('\n').slice(-12)
  const questionLine = lastLines.map(line => line.includes(last.slice(0, 20))).lastIndexOf(true)
  if (questionLine < 0) return null
  const listItem = /^\s*(?:\d+[.)]|[-*•]|[A-Z][.)])\s+(.+)$/
  const suffix=text.slice(text.lastIndexOf(last)+last.length).trim()
  if(suffix && !suffix.split('\n').every(line=>!line.trim() || listItem.test(line) || /^\s+\S/.test(line)))return null
  const optionLines = []
  for (let i = questionLine + 1; i < lastLines.length; i++) {
    const line = lastLines[i]
    if (listItem.test(line)) optionLines.push(line)
    else if (line.trim() && (!optionLines.length || !/^\s+\S/.test(line))) break
  }
  if (!optionLines.length) {
    for (let i = questionLine - 1; i >= 0; i--) {
      const line = lastLines[i]
      if (listItem.test(line)) optionLines.unshift(line)
      else if (line.trim() && (!optionLines.length || !/^\s+\S/.test(line))) break
    }
  }
  const options = optionLines
    .map(line => listItem.exec(line)?.[1])
    .filter(x => !!x)
    .slice(0, 6)
    .map(x => {
      const [label, ...rest] = x.split(/[:：]| — | - /)
      return { label: label.replace(/\*\*/g, '').trim().slice(0, 80), description: rest.join(' ').trim().slice(0, 200) }
    })
  return { question: last.replace(/^[#>*\s]+/, '').slice(0, 300), options }
}
