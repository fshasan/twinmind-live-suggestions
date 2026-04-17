import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../types'

interface Props {
  messages: ChatMessage[]
  onSend: (text: string) => void
  disabled: boolean
}

export function ChatColumn({ messages, onSend, disabled }: Props) {
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function submit() {
    const t = draft.trim()
    if (!t || disabled) return
    onSend(t)
    setDraft('')
  }

  return (
    <section className="flex min-h-0 flex-col bg-[var(--color-panel)]">
      <header className="shrink-0 border-b border-[var(--color-border)] px-4 py-3">
        <h2 className="text-sm font-medium tracking-tight text-[var(--color-fg-strong)]">
          Chat
        </h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Tap a suggestion for a detailed answer, or ask your own question.
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-left text-sm">
        {messages.length === 0 ? (
          <p className="text-[var(--color-muted)]">
            No messages yet. Open a suggestion or type below.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {messages.map((m, i) => {
              const pendingStream =
                m.role === 'assistant' &&
                m.content === '' &&
                disabled &&
                i === messages.length - 1
              return (
              <li key={m.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wide ${
                      m.role === 'user' ? 'text-purple-300' : 'text-emerald-300'
                    }`}
                  >
                    {m.role === 'user' ? 'You' : 'TwinMind'}
                  </span>
                  <time
                    className="text-[11px] text-[var(--color-muted)]"
                    dateTime={new Date(m.t).toISOString()}
                  >
                    {new Date(m.t).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </time>
                </div>
                <p className="whitespace-pre-wrap leading-relaxed text-[var(--color-fg)]">
                  {pendingStream ? (
                    <span className="italic text-[var(--color-muted)]">
                      Thinking...
                    </span>
                  ) : (
                    m.content
                  )}
                </p>
              </li>
              )
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>
      <footer className="shrink-0 border-t border-[var(--color-border)] p-3">
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Ask a question…"
            rows={2}
            disabled={disabled}
            className="min-h-[44px] flex-1 resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:border-purple-500/60 focus:outline-none focus:ring-1 focus:ring-purple-500/40 disabled:opacity-50"
          />
          <button
            type="button"
            disabled={disabled || !draft.trim()}
            onClick={submit}
            className="self-end rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-purple-500 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </footer>
    </section>
  )
}
