import type { TranscriptLine } from '../types'

function formatLineTime(t: number): string {
  return new Date(t).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** Full transcript with timestamps (helps the model with timing and turn-taking). */
export function formatTranscriptLines(lines: TranscriptLine[]): string {
  return lines
    .map((l) => `[${formatLineTime(l.t)}] ${l.text}`)
    .join('\n')
}

/** Recent tail of the formatted transcript (for live suggestions). */
export function buildTranscriptWindow(
  lines: TranscriptLine[],
  maxChars: number,
): string {
  if (lines.length === 0 || maxChars <= 0) return ''

  const picked: string[] = []
  let used = 0

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = `[${formatLineTime(lines[i].t)}] ${lines[i].text}`
    const sep = picked.length > 0 ? 1 : 0
    if (used + sep + line.length > maxChars) {
      if (picked.length === 0) {
        return line.length > maxChars ? line.slice(-maxChars) : line
      }
      break
    }
    picked.push(line)
    used += sep + line.length
  }

  return picked.reverse().join('\n')
}

/**
 * Context for live suggestions: only the most recently appended transcript line
 * (the latest Whisper segment). Older lines are not sent so cards stay tied to
 * what was just said.
 */
export function buildSuggestionsContext(
  lines: TranscriptLine[],
  maxChars: number,
): string {
  if (lines.length === 0 || maxChars <= 0) return ''

  const last = lines[lines.length - 1]
  const line = `[${formatLineTime(last.t)}] ${last.text}`
  if (line.length <= maxChars) return line
  return line.slice(0, maxChars)
}

/**
 * Full session transcript for expanded answers. If over budget, keep start + end
 * so the model still sees opening context and the latest discussion.
 */
export function buildExpandedTranscriptContext(
  lines: TranscriptLine[],
  maxChars: number,
): string {
  const full = formatTranscriptLines(lines)
  if (full.length <= maxChars) return full

  const marker =
    '\n\n[... Transcript shortened: middle omitted to fit the context limit ...]\n\n'
  const budget = maxChars - marker.length
  const headChars = Math.floor(budget * 0.22)
  const tailChars = budget - headChars
  return full.slice(0, headChars) + marker + full.slice(-tailChars)
}
