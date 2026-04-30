import { useEffect, useRef } from 'react'
import type { TranscriptLine } from '../types'
import { LabelWithHint } from './LabelWithHint'

interface Props {
  lines: TranscriptLine[]
  isRecording: boolean
  /** Recording chunk length from Settings (seconds); drives how often lines append. */
  chunkIntervalSeconds: number
  onToggleMic: () => void
}

export function TranscriptColumn({
  lines,
  isRecording,
  chunkIntervalSeconds,
  onToggleMic,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <section className="flex min-h-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-panel)]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
        <h2 className="text-sm font-medium tracking-tight text-[var(--color-fg-strong)]">
          <LabelWithHint hint="Lines from Groq Whisper, appended after each recording chunk while the mic is on (interval in Settings).">
            Transcript
          </LabelWithHint>
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onToggleMic}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              isRecording
                ? 'bg-red-500/15 text-red-700 ring-1 ring-red-500/35 dark:bg-red-500/20 dark:text-red-300 dark:ring-red-400/40'
                : 'bg-[var(--color-accent-dim)] text-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/25'
            }`}
          >
            {isRecording ? 'Stop mic' : 'Start mic'}
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-left text-sm leading-relaxed text-[var(--color-fg)]">
        {lines.length === 0 ? (
          <p className="text-[var(--color-muted)]">
            Start the microphone. While recording, a new transcript line is
            appended about every {chunkIntervalSeconds}s when each audio chunk
            finishes (change the interval in Settings).
          </p>
        ) : (
          <ul className="space-y-3">
            {lines.map((line) => (
              <li key={line.id}>
                <time
                  className="block text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted)]"
                  dateTime={new Date(line.t).toISOString()}
                >
                  {new Date(line.t).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </time>
                <p className="mt-0.5 whitespace-pre-wrap">{line.text}</p>
              </li>
            ))}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>
    </section>
  )
}
