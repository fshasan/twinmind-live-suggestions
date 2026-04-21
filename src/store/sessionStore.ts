import { create } from 'zustand'
import type {
  AppSettings,
  ChatMessage,
  LiveSuggestion,
  SuggestionBatch,
  TranscriptLine,
} from '../types'
import { fetchLiveSuggestions } from '../lib/groq'
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '../lib/defaults'
import { groqKeyFromBuildEnv } from '../lib/env'
import { buildTranscriptWindow } from '../lib/transcriptPrompt'

function loadSettings(): AppSettings {
  const envKey = groqKeyFromBuildEnv()
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) {
      return {
        ...DEFAULT_SETTINGS,
        groqApiKey: envKey || DEFAULT_SETTINGS.groqApiKey,
      }
    }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    const merged: AppSettings = { ...DEFAULT_SETTINGS, ...parsed }
    if (!merged.groqApiKey?.trim()) {
      merged.groqApiKey = envKey || ''
    }
    return merged
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      groqApiKey: envKey || DEFAULT_SETTINGS.groqApiKey,
    }
  }
}

function saveSettings(s: AppSettings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(s))
}

export {
  buildExpandedTranscriptContext,
  buildTranscriptWindow,
} from '../lib/transcriptPrompt'

export function priorSuggestionsHint(batches: SuggestionBatch[]): string {
  const latest = batches[0]
  if (!latest) return '[]'
  return JSON.stringify(
    latest.suggestions.map((s) => ({
      title: s.title,
      preview: s.preview,
      kind: s.kind,
    })),
  )
}

interface SessionState {
  sessionStartedAt: number | null
  settings: AppSettings
  transcript: TranscriptLine[]
  suggestionBatches: SuggestionBatch[]
  chat: ChatMessage[]
  isRecording: boolean
  isBusy: boolean
  /** True while the Refresh action is awaiting Groq (manual only, not segment pipeline). */
  liveSuggestionsRefreshPending: boolean
  statusLine: string | null
  error: string | null

  patchSettings: (partial: Partial<AppSettings>) => void
  resetSession: () => void

  appendTranscriptChunk: (text: string) => void
  prependSuggestionBatch: (items: LiveSuggestion[]) => void
  pushChat: (msg: Omit<ChatMessage, 'id' | 't'> & Partial<Pick<ChatMessage, 'id' | 't'>>) => ChatMessage
  updateChatContent: (id: string, content: string) => void

  setRecording: (v: boolean) => void
  setBusy: (v: boolean) => void
  setStatus: (s: string | null) => void
  setError: (e: string | null) => void

  ensureSessionStart: () => void
  /** Refresh button: new 3 suggestions from latest transcript (Groq chat only). */
  runLiveSuggestionRefresh: () => Promise<void>
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionStartedAt: null,
  settings: loadSettings(),
  transcript: [],
  suggestionBatches: [],
  chat: [],
  isRecording: false,
  isBusy: false,
  liveSuggestionsRefreshPending: false,
  statusLine: null,
  error: null,

  patchSettings: (partial) => {
    const next = { ...get().settings, ...partial }
    if (typeof next.groqApiKey === 'string') {
      next.groqApiKey = next.groqApiKey.trim()
    }
    saveSettings(next)
    set({ settings: next })
  },

  resetSession: () =>
    set({
      transcript: [],
      suggestionBatches: [],
      chat: [],
      sessionStartedAt: Date.now(),
      error: null,
      statusLine: null,
      liveSuggestionsRefreshPending: false,
    }),

  appendTranscriptChunk: (text) => {
    const t = Date.now()
    const line: TranscriptLine = {
      id: globalThis.crypto.randomUUID(),
      t,
      text: text.trim(),
    }
    if (!line.text) return
    set((s) => {
      const sessionStartedAt = s.sessionStartedAt ?? t
      return {
        transcript: [...s.transcript, line],
        sessionStartedAt,
      }
    })
  },

  prependSuggestionBatch: (items) => {
    const batch: SuggestionBatch = {
      id: globalThis.crypto.randomUUID(),
      t: Date.now(),
      suggestions: items,
    }
    set((s) => ({
      suggestionBatches: [batch, ...s.suggestionBatches],
    }))
  },

  pushChat: (msg) => {
    const full: ChatMessage = {
      id: msg.id ?? globalThis.crypto.randomUUID(),
      t: msg.t ?? Date.now(),
      role: msg.role,
      content: msg.content,
      linkedSuggestionId: msg.linkedSuggestionId,
    }
    set((s) => ({ chat: [...s.chat, full] }))
    return full
  },

  updateChatContent: (id, content) =>
    set((s) => ({
      chat: s.chat.map((m) => (m.id === id ? { ...m, content } : m)),
    })),

  setRecording: (v) => set({ isRecording: v }),
  setBusy: (v) => set({ isBusy: v }),
  setStatus: (s) => set({ statusLine: s }),
  setError: (e) => set({ error: e }),

  ensureSessionStart: () =>
    set((s) => ({
      sessionStartedAt: s.sessionStartedAt ?? Date.now(),
    })),

  runLiveSuggestionRefresh: async () => {
    const { settings, transcript, suggestionBatches } = get()
    const key = settings.groqApiKey.trim()
    if (!key) throw new Error('Add your Groq API key in Settings.')

    set({ liveSuggestionsRefreshPending: true })
    try {
      const refreshTag =
        '\n\n[Manual refresh: return 3 new cards grounded in the transcript; do not repeat the same angles as the current top batch.]'
      const budget = Math.max(
        2000,
        settings.suggestionContextChars - refreshTag.length,
      )
      const windowText =
        buildTranscriptWindow(transcript, budget) + refreshTag
      const prior = priorSuggestionsHint(suggestionBatches)
      const suggestions = await fetchLiveSuggestions(
        settings,
        windowText,
        prior,
      )
      get().prependSuggestionBatch(suggestions)
    } finally {
      set({ liveSuggestionsRefreshPending: false })
    }
  },
}))
