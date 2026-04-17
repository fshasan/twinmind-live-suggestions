import { useState } from 'react'
import type { AppSettings } from '../types'

interface Props {
  settings: AppSettings
  onClose: () => void
  onSave: (next: AppSettings) => void
}

/** Mount only when visible so `draft` initializes from the latest `settings`. */
export function SettingsModal({ settings, onClose, onSave }: Props) {
  const [draft, setDraft] = useState(settings)

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="settings-title" className="text-lg font-semibold text-zinc-50">
              Settings
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Your Groq API key stays in this browser (localStorage). Nothing is
              sent to our servers.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Close
          </button>
        </div>

        <div className="flex flex-col gap-4 text-left text-sm">
          <label className="flex flex-col gap-1">
            <span className="font-medium text-zinc-200">Groq API key</span>
            <input
              type="password"
              autoComplete="off"
              value={draft.groqApiKey}
              onChange={(e) => update('groqApiKey', e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 focus:border-purple-500/60 focus:outline-none focus:ring-1 focus:ring-purple-500/40"
              placeholder="gsk_…"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="font-medium text-zinc-200">Whisper model</span>
              <input
                value={draft.whisperModel}
                onChange={(e) => update('whisperModel', e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-zinc-200">LLM model</span>
              <input
                value={draft.llmModel}
                onChange={(e) => update('llmModel', e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="font-medium text-zinc-200">
                Chunk interval (ms)
              </span>
              <input
                type="number"
                min={5000}
                step={1000}
                value={draft.chunkIntervalMs}
                onChange={(e) =>
                  update('chunkIntervalMs', Number(e.target.value) || 30_000)
                }
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-zinc-200">
                Suggestion temperature
              </span>
              <input
                type="number"
                min={0}
                max={2}
                step={0.05}
                value={draft.suggestionTemperature}
                onChange={(e) =>
                  update('suggestionTemperature', Number(e.target.value))
                }
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="font-medium text-zinc-200">
                Suggest context (chars)
              </span>
              <input
                type="number"
                min={1000}
                step={500}
                value={draft.suggestionContextChars}
                onChange={(e) =>
                  update('suggestionContextChars', Number(e.target.value))
                }
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-zinc-200">
                Expanded context (chars)
              </span>
              <span className="text-xs text-zinc-500">
                Full-session transcript for card details; very long meetings may truncate middle.
              </span>
              <input
                type="number"
                min={1000}
                step={500}
                value={draft.expandedContextChars}
                onChange={(e) =>
                  update('expandedContextChars', Number(e.target.value))
                }
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-zinc-200">
                Chat context (chars)
              </span>
              <input
                type="number"
                min={1000}
                step={500}
                value={draft.chatContextChars}
                onChange={(e) =>
                  update('chatContextChars', Number(e.target.value))
                }
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="font-medium text-zinc-200">
              Live suggestion system prompt
            </span>
            <textarea
              value={draft.liveSuggestionPrompt}
              onChange={(e) => update('liveSuggestionPrompt', e.target.value)}
              rows={5}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-[13px] text-zinc-100"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-medium text-zinc-200">
              Expanded answer system prompt
            </span>
            <textarea
              value={draft.expandedAnswerPrompt}
              onChange={(e) => update('expandedAnswerPrompt', e.target.value)}
              rows={4}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-[13px] text-zinc-100"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-medium text-zinc-200">Chat system prompt</span>
            <textarea
              value={draft.chatPrompt}
              onChange={(e) => update('chatPrompt', e.target.value)}
              rows={4}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-[13px] text-zinc-100"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-medium text-zinc-200">Chat temperature</span>
            <input
              type="number"
              min={0}
              max={2}
              step={0.05}
              value={draft.chatTemperature}
              onChange={(e) =>
                update('chatTemperature', Number(e.target.value))
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(draft)
              onClose()
            }}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
