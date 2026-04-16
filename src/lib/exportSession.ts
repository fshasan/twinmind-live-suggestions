import type {
  ChatMessage,
  SuggestionBatch,
  TranscriptLine,
} from '../types'

export function buildExportPayload(state: {
  sessionStartedAt: number | null
  transcript: TranscriptLine[]
  suggestionBatches: SuggestionBatch[]
  chat: ChatMessage[]
}) {
  return {
    exportedAt: new Date().toISOString(),
    sessionStartedAt: state.sessionStartedAt,
    transcript: state.transcript,
    suggestionBatches: state.suggestionBatches,
    chat: state.chat,
  }
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
