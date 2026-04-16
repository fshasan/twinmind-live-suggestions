import { useEffect, useRef } from 'react'
import type { TranscriptLine } from '../types'

interface Props {
  lines: TranscriptLine[]
  isRecording: boolean
  onToggleMic: () => void
}

export function TranscriptColumn({
  lines,
  isRecording,
  onToggleMic,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <section className="flex min-h-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-panel)]">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
        <h2 className="text-sm font-medium tracking-tight text-zinc-100">
          Transcript
        </h2>
        <button
          type="button"
          onClick={onToggleMic}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            isRecording
              ? 'bg-red-500/20 text-red-300 ring-1 ring-red-400/40'
              : 'bg-[var(--color-accent-dim)] text-[var(--color-accent)] ring-1 ring-purple-400/30'
          }`}
        >
          {isRecording ? 'Stop mic' : 'Start mic'}
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-left text-sm leading-relaxed text-zinc-300">
        {lines.length === 0 ? (
          <p className="text-zinc-500">
            Start the microphone. New transcript lines appear about every 30
            seconds while you speak.
          </p>
        ) : (
          <ul className="space-y-3">
            {lines.map((line) => (
              <li key={line.id}>
                <time
                  className="block text-[11px] font-medium uppercase tracking-wide text-zinc-500"
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
