import type { LiveSuggestion, SuggestionBatch } from '../types'
import { LabelWithHint } from './LabelWithHint'

const KIND_LABEL: Record<LiveSuggestion['kind'], string> = {
  question: 'Question',
  talking_point: 'Talking point',
  answer: 'Answer',
  fact_check: 'Fact check',
  clarify: 'Clarify',
}

interface Props {
  batches: SuggestionBatch[]
  /** True while a manual Refresh request is in flight. */
  isRefreshLoading: boolean
  /** Refresh runs when there is transcript text and a Groq API key (see App). */
  canRefresh: boolean
  onRefresh: () => void
  onSelect: (s: LiveSuggestion) => void
}

export function SuggestionsColumn({
  batches,
  isRefreshLoading,
  canRefresh,
  onRefresh,
  onSelect,
}: Props) {
  return (
    <section className="flex min-h-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
        <h2 className="text-sm font-medium tracking-tight text-[var(--color-fg-strong)]">
          <LabelWithHint hint="Batches of three cards from the LLM, based on the latest transcript segment. New cards after each chunk; Refresh adds another batch (syncs pending audio first if the mic is on).">
            Live suggestions
          </LabelWithHint>
        </h2>
        <button
          type="button"
          disabled={!canRefresh || isRefreshLoading}
          title={
            isRefreshLoading
              ? 'Fetching new suggestions…'
              : canRefresh
                ? 'Syncs the latest audio to the transcript when the mic is on, then adds 3 new suggestion cards'
                : 'Add a Groq API key in Settings and start the mic (or wait for transcript lines)'
          }
          onClick={onRefresh}
          className="rounded-full bg-[var(--color-panel)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] ring-1 ring-[var(--color-border)] transition hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
        >
          {isRefreshLoading ? 'Loading…' : 'Refresh'}
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {batches.length === 0 ? (
          <p className="text-left text-sm text-[var(--color-muted)]">
            Suggestions appear after each recording chunk while the mic is on,
            or when you tap Refresh (which updates the transcript first if you
            are still recording).
          </p>
        ) : (
          <ul className="flex flex-col gap-6">
            {batches.map((batch) => (
              <li key={batch.id}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
                    Batch
                  </span>
                  <time
                    className="text-[11px] text-[var(--color-muted)]"
                    dateTime={new Date(batch.t).toISOString()}
                  >
                    {new Date(batch.t).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </time>
                </div>
                <ul className="flex flex-col gap-2">
                  {batch.suggestions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(s)}
                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-3 text-left text-sm text-[var(--color-fg)] shadow-sm ring-0 transition hover:border-purple-500/50 hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-[var(--color-fg-strong)]">
                            {s.title}
                          </span>
                          <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)] dark:bg-white/5">
                            {KIND_LABEL[s.kind] ?? s.kind}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--color-fg)]">
                          {s.preview}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
