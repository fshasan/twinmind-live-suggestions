import { useCallback } from 'react'
import { fetchChatReply, fetchExpandedAnswer } from '../lib/groq'
import { buildTranscriptWindow, useSessionStore } from '../store/sessionStore'
import type { LiveSuggestion } from '../types'

export function useChatActions() {
  const settings = useSessionStore((s) => s.settings)
  const pushChat = useSessionStore((s) => s.pushChat)
  const updateChatContent = useSessionStore((s) => s.updateChatContent)
  const setBusy = useSessionStore((s) => s.setBusy)
  const setError = useSessionStore((s) => s.setError)

  const openSuggestion = useCallback(
    async (suggestion: LiveSuggestion) => {
      const key = settings.groqApiKey.trim()
      if (!key) {
        setError('Add your Groq API key in Settings.')
        return
      }

      const userLine = `[${suggestion.kind}] ${suggestion.title}\n\n${suggestion.preview}`
      pushChat({
        role: 'user',
        content: userLine,
        linkedSuggestionId: suggestion.id,
      })

      const assistant = pushChat({
        role: 'assistant',
        content: '…',
      })

      setBusy(true)
      setError(null)
      try {
        const lines = useSessionStore.getState().transcript
        const windowText = buildTranscriptWindow(
          lines,
          settings.expandedContextChars,
        )
        const text = await fetchExpandedAnswer(
          settings,
          {
            title: suggestion.title,
            preview: suggestion.preview,
            kind: suggestion.kind,
          },
          windowText,
        )
        updateChatContent(assistant.id, text)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        updateChatContent(assistant.id, `Error: ${msg}`)
        setError(msg)
      } finally {
        setBusy(false)
      }
    },
    [
      pushChat,
      setBusy,
      setError,
      settings,
      updateChatContent,
    ],
  )

  const sendUserMessage = useCallback(
    async (raw: string) => {
      const text = raw.trim()
      if (!text) return

      const key = settings.groqApiKey.trim()
      if (!key) {
        setError('Add your Groq API key in Settings.')
        return
      }

      const prior = useSessionStore.getState().chat.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      pushChat({ role: 'user', content: text })

      const assistant = pushChat({
        role: 'assistant',
        content: '…',
      })

      setBusy(true)
      setError(null)
      try {
        const lines = useSessionStore.getState().transcript
        const windowText = buildTranscriptWindow(
          lines,
          settings.chatContextChars,
        )
        const history = [...prior, { role: 'user' as const, content: text }]
        const reply = await fetchChatReply(settings, windowText, history)
        updateChatContent(assistant.id, reply)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        updateChatContent(assistant.id, `Error: ${msg}`)
        setError(msg)
      } finally {
        setBusy(false)
      }
    },
    [pushChat, setBusy, setError, settings, updateChatContent],
  )

  return { openSuggestion, sendUserMessage }
}
