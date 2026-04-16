export type SuggestionKind =
  | 'question'
  | 'talking_point'
  | 'answer'
  | 'fact_check'
  | 'clarify'

export interface LiveSuggestion {
  id: string
  kind: SuggestionKind
  preview: string
  title: string
}

export interface TranscriptLine {
  id: string
  t: number
  text: string
}

export interface SuggestionBatch {
  id: string
  t: number
  suggestions: LiveSuggestion[]
}

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  t: number
  role: ChatRole
  content: string
  /** Present when opened from a suggestion card */
  linkedSuggestionId?: string
}

export interface AppSettings {
  groqApiKey: string
  whisperModel: string
  llmModel: string
  chunkIntervalMs: number
  suggestionContextChars: number
  expandedContextChars: number
  chatContextChars: number
  liveSuggestionPrompt: string
  expandedAnswerPrompt: string
  chatPrompt: string
  suggestionTemperature: number
  chatTemperature: number
}
