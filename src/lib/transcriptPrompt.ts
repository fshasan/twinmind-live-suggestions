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

function isActionable(text: string): boolean {
  // Heuristic: captures “remember to…”, commitments, follow-ups, and deadlines.
  return /(?:\bremember\b|\bremind\b|\baction item\b|\bto[-\s]?do\b|\bfollow[-\s]?up\b|\bowner\b|\bassign\b|\bby\s+\w+|\bdue\b|\bdeadline\b|\bnext steps?\b|\bwe need to\b|\bwe should\b|\bi(?:'| a)m going to\b|\bi(?:'| wi)ll\b|\bwe(?:'| wi)ll\b|\blet'?s\b)/i.test(
    text,
  )
}

/**
 * Pulls a small set of older “actionable” transcript lines to enable
 * reminder-style suggestions (without replacing the recent-window focus).
 */
export function buildReminderWindow(
  lines: TranscriptLine[],
  maxChars: number,
): string {
  if (lines.length < 4 || maxChars <= 0) return ''

  // Exclude the most recent ~20% so this stays “older context”.
  const cutoff = Math.max(0, Math.floor(lines.length * 0.8))
  const candidates = lines.slice(0, cutoff).filter((l) => isActionable(l.text))
  if (candidates.length === 0) return ''

  const picked: string[] = []
  let used = 0
  // Prefer the most recent actionable lines from the older portion.
  for (let i = candidates.length - 1; i >= 0; i--) {
    const line = `[${formatLineTime(candidates[i].t)}] ${candidates[i].text}`
    const sep = picked.length > 0 ? 1 : 0
    if (used + sep + line.length > maxChars) break
    picked.push(line)
    used += sep + line.length
    if (picked.length >= 6) break
  }

  return picked.reverse().join('\n')
}

/**
 * Context for live suggestions: mostly recent transcript, plus a small older
 * reminder window when available.
 */
export function buildSuggestionsContext(
  lines: TranscriptLine[],
  maxChars: number,
): string {
  if (lines.length === 0 || maxChars <= 0) return ''

  const olderBudget = Math.min(2800, Math.floor(maxChars * 0.22))
  const recentBudget = Math.max(0, maxChars - olderBudget - 120)

  const recent = buildTranscriptWindow(lines, recentBudget)
  const older = buildReminderWindow(lines, olderBudget)
  if (!older) return recent

  return [
    'RECENT TRANSCRIPT:',
    recent || '(empty)',
    '',
    'OLDER NOTES (possible reminders / action items):',
    older,
  ].join('\n')
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
