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
  const liveSuggestionsRefreshPending = useSessionStore(
    (s) => s.liveSuggestionsRefreshPending,
  )
  const statusLine = useSessionStore((s) => s.statusLine)
  const error = useSessionStore((s) => s.error)
  const setError = useSessionStore((s) => s.setError)

  const canRefreshSuggestions =
    settings.groqApiKey.trim().length > 0 &&
    (transcript.length > 0 || isRecording)

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
    <div className="box-border h-full min-h-0 p-4 sm:p-6">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-panel)]/70 px-4 py-3 backdrop-blur">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-[var(--color-fg-strong)]">
              TwinMind · Live suggestions
            </h1>
            {statusLine ? (
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">{statusLine}</p>
            ) : (
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                While recording, transcript lines append about every{' '}
                {Math.round(settings.chunkIntervalMs / 1000)}s per chunk. Use
                Refresh while recording to sync pending audio before new
                suggestions.
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

      {!settings.groqApiKey?.trim() ? (
        <div className="shrink-0 border-b border-amber-800/50 bg-amber-950/35 px-4 py-2 text-left text-sm text-amber-100">
          <strong className="font-medium">Groq API key required.</strong> Open{' '}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="font-semibold text-amber-50 underline decoration-amber-500/80 underline-offset-2 hover:text-white"
          >
            Settings
          </button>{' '}
          and paste your key from{' '}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-amber-50 underline decoration-amber-500/80 underline-offset-2 hover:text-white"
          >
            console.groq.com
          </a>
          . Keys stored on localhost do not carry over to this deployed URL.
        </div>
      ) : null}

      {error ? (
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-red-900/50 bg-red-950/40 px-4 py-2 text-left text-sm text-red-200">
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 rounded-md px-2 py-0.5 text-xs text-red-100 hover:bg-red-900/60"
          >
            Dismiss
          </button>
        </div>
      ) : null}

        <main className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-3">
        <TranscriptColumn
          lines={transcript}
          isRecording={isRecording}
          chunkIntervalSeconds={Math.round(settings.chunkIntervalMs / 1000)}
          onToggleMic={toggleMic}
        />
        <SuggestionsColumn
          batches={suggestionBatches}
          isRefreshLoading={liveSuggestionsRefreshPending}
          canRefresh={canRefreshSuggestions}
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
    </div>
  )
}
