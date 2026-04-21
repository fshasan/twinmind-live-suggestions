import { useCallback } from 'react'
import { streamChatCompletion } from '../lib/groq'
import {
  buildExpandedTranscriptContext,
  buildTranscriptWindow,
} from '../lib/transcriptPrompt'
import { useSessionStore } from '../store/sessionStore'
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
        content: '',
      })

      setBusy(true)
      setError(null)
      try {
        const lines = useSessionStore.getState().transcript
        const transcriptText = buildExpandedTranscriptContext(
          lines,
          settings.expandedContextChars,
        )
        const userPayload = [
          'TAPPED SUGGESTION:',
          JSON.stringify(suggestion, null, 2),
          '',
          'FULL SESSION TRANSCRIPT (timestamped lines; middle may be omitted only if over the context limit):',
          transcriptText || '(no transcript yet)',
        ].join('\n')

        await streamChatCompletion(
          settings,
          [
            { role: 'system', content: settings.expandedAnswerPrompt },
            { role: 'user', content: userPayload },
          ],
          (chunk) => {
            useSessionStore.setState((s) => ({
              chat: s.chat.map((m) =>
                m.id === assistant.id
                  ? { ...m, content: m.content + chunk }
                  : m,
              ),
            }))
          },
          { temperature: settings.chatTemperature, max_tokens: 2048 },
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        const soFar =
          useSessionStore.getState().chat.find((m) => m.id === assistant.id)
            ?.content ?? ''
        updateChatContent(
          assistant.id,
          soFar ? `${soFar}\n\nError: ${msg}` : `Error: ${msg}`,
        )
        setError(msg)
      } finally {
        setBusy(false)
      }
    },
    [pushChat, setBusy, setError, settings, updateChatContent],
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
        content: '',
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
        const messages = [
          {
            role: 'system' as const,
            content: `${settings.chatPrompt}\n\nTRANSCRIPT (timestamped, recent portion):\n${windowText || '(empty)'}`,
          },
          ...history.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        ]

        await streamChatCompletion(
          settings,
          messages,
          (chunk) => {
            useSessionStore.setState((s) => ({
              chat: s.chat.map((m) =>
                m.id === assistant.id
                  ? { ...m, content: m.content + chunk }
                  : m,
              ),
            }))
          },
          { temperature: settings.chatTemperature, max_tokens: 2048 },
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        const soFar =
          useSessionStore.getState().chat.find((m) => m.id === assistant.id)
            ?.content ?? ''
        updateChatContent(
          assistant.id,
          soFar ? `${soFar}\n\nError: ${msg}` : `Error: ${msg}`,
        )
        setError(msg)
      } finally {
        setBusy(false)
      }
    },
    [pushChat, setBusy, setError, settings, updateChatContent],
  )

  return { openSuggestion, sendUserMessage }
}
