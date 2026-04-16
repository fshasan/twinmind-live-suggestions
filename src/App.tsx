import { useEffect, useState } from 'react'
import { ChatColumn } from './components/ChatColumn'
import { SettingsModal } from './components/SettingsModal'
import { SuggestionsColumn } from './components/SuggestionsColumn'
import { TranscriptColumn } from './components/TranscriptColumn'
import { useChatActions } from './hooks/useChatActions'
import { useMeetingRecorder } from './hooks/useMeetingRecorder'
import { useTheme } from './hooks/useTheme'
import { buildExportPayload, downloadJson } from './lib/exportSession'
import { useSessionStore } from './store/sessionStore'

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { theme, toggle: toggleTheme } = useTheme()

  const transcript = useSessionStore((s) => s.transcript)
  const suggestionBatches = useSessionStore((s) => s.suggestionBatches)
  const chat = useSessionStore((s) => s.chat)
  const settings = useSessionStore((s) => s.settings)
  const patchSettings = useSessionStore((s) => s.patchSettings)
  const isRecording = useSessionStore((s) => s.isRecording)
  const isBusy = useSessionStore((s) => s.isBusy)
  const statusLine = useSessionStore((s) => s.statusLine)
  const error = useSessionStore((s) => s.error)

  const { startRecording, stopRecording, refreshNow } = useMeetingRecorder()
  const { openSuggestion, sendUserMessage } = useChatActions()
  const ensureSessionStart = useSessionStore((s) => s.ensureSessionStart)

  useEffect(() => {
    ensureSessionStart()
  }, [ensureSessionStart])

  async function toggleMic() {
    if (isRecording) {
      stopRecording()
    } else {
      await startRecording()
    }
  }

  function exportSession() {
    const s = useSessionStore.getState()
    const payload = buildExportPayload({
      sessionStartedAt: s.sessionStartedAt,
      transcript: s.transcript,
      suggestionBatches: s.suggestionBatches,
      chat: s.chat,
    })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    downloadJson(`twinmind-session-${stamp}.json`, payload)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-panel)]/70 px-4 py-3 backdrop-blur">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-[var(--color-fg-strong)]">
            TwinMind · Live suggestions
          </h1>
          {statusLine ? (
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">{statusLine}</p>
          ) : (
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Transcript and suggestions refresh about every 30s while recording.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] hover:bg-black/5 dark:hover:bg-white/5"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <span className="inline-flex items-center gap-1.5">
              {theme === 'dark' ? (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
                </svg>
              ) : (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
              )}
              <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] hover:bg-black/5 dark:hover:bg-white/5"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={exportSession}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] hover:bg-black/5 dark:hover:bg-white/5"
          >
            Export session
          </button>
        </div>
      </header>

      {error ? (
        <div className="shrink-0 border-b border-red-900/50 bg-red-950/40 px-4 py-2 text-left text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-3">
        <TranscriptColumn
          lines={transcript}
          isRecording={isRecording}
          onToggleMic={toggleMic}
        />
        <SuggestionsColumn
          batches={suggestionBatches}
          isBusy={isBusy}
          onRefresh={() => void refreshNow()}
          onSelect={(s) => void openSuggestion(s)}
        />
        <ChatColumn
          messages={chat}
          onSend={(t) => void sendUserMessage(t)}
          disabled={isBusy}
        />
      </main>

      {settingsOpen ? (
        <SettingsModal
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={(next) => patchSettings(next)}
        />
      ) : null}
    </div>
  )
}
