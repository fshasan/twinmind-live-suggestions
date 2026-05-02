import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchLiveSuggestions, transcribeAudio } from '../lib/groq'
import {
  priorSuggestionsHint,
  useSessionStore,
} from '../store/sessionStore'
import { buildSuggestionsContext } from '../lib/transcriptPrompt'

function pickMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ]
  if (typeof MediaRecorder === 'undefined') return undefined
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return undefined
}

/**
 * Groq Whisper validates each upload as a standalone media file. Using
 * MediaRecorder.start(timeslice) yields fragments that are not always decodable
 * alone (especially on mobile Safari), which surfaces as "valid media file?"
 * errors. We instead stop the recorder on an interval so each blob is a full
 * container, then immediately start the next segment on the same stream.
 *
 * **Transcript Refresh** flushes buffered audio when the mic is on (transcribe
 * only). **Suggestions Refresh** does the same flush first, then
 * `runLiveSuggestionRefresh()` on the store.
 */
type SegmentProcessMode = 'transcribe_and_suggest' | 'transcribe_only'

export function useMeetingRecorder() {
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const segmentTimerRef = useRef<number | undefined>(undefined)
  const continueRecordingRef = useRef(false)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const startSegmentRef = useRef<() => void>(() => {})
  /** Timer-driven segments use full pipeline; early flush uses transcribe-only. */
  const segmentProcessModeRef = useRef<SegmentProcessMode>('transcribe_and_suggest')

  const setRecording = useSessionStore((s) => s.setRecording)
  const setBusy = useSessionStore((s) => s.setBusy)
  const setStatus = useSessionStore((s) => s.setStatus)
  const setError = useSessionStore((s) => s.setError)
  const [transcriptRefreshPending, setTranscriptRefreshPending] = useState(false)

  const enqueue = useCallback((fn: () => Promise<void>) => {
    queueRef.current = queueRef.current.then(fn).catch((e) => {
      const msg = e instanceof Error ? e.message : String(e)
      useSessionStore.getState().setError(msg)
    })
    return queueRef.current
  }, [])

  const processAudioBlob = useCallback(
    async (blob: Blob, mimeHint?: string) => {
      if (!blob.size) return

      const mode = segmentProcessModeRef.current
      const settings = useSessionStore.getState().settings
      const appendTranscriptChunk = useSessionStore.getState().appendTranscriptChunk
      const prependSuggestionBatch =
        useSessionStore.getState().prependSuggestionBatch

      setBusy(true)
      setError(null)
      try {
        const key = settings.groqApiKey.trim()
        if (!key) throw new Error('Add your Groq API key in Settings.')

        setStatus('Transcribing…')
        const mime =
          mimeHint?.trim() ||
          recorderRef.current?.mimeType?.trim() ||
          blob.type?.trim() ||
          undefined

        const text = await transcribeAudio(
          key,
          blob,
          settings.whisperModel,
          mime,
        )
        if (text) appendTranscriptChunk(text)

        if (mode === 'transcribe_only') {
          return
        }

        setStatus('Updating suggestions…')

        const lines = useSessionStore.getState().transcript
        const windowText = buildSuggestionsContext(
          lines,
          settings.suggestionContextChars,
        )
        const prior = priorSuggestionsHint(
          useSessionStore.getState().suggestionBatches,
        )
        const suggestions = await fetchLiveSuggestions(
          settings,
          windowText,
          prior,
        )
        prependSuggestionBatch(suggestions)
      } finally {
        setStatus(null)
        setBusy(false)
      }
    },
    [setBusy, setError, setStatus],
  )

  /**
   * Finishes the current MediaRecorder segment early so Whisper sees a full
   * file, transcribes only (no suggestion batch), then restarts the segment if
   * the mic is still on. Drains the processing queue before/after so callers
   * can await a consistent transcript.
   */
  const flushCurrentSegmentTranscribeOnly = useCallback(async () => {
    await queueRef.current

    const rec = recorderRef.current
    if (!rec || !continueRecordingRef.current || rec.state === 'inactive') {
      return
    }

    segmentProcessModeRef.current = 'transcribe_only'
    if (segmentTimerRef.current !== undefined) {
      window.clearTimeout(segmentTimerRef.current)
      segmentTimerRef.current = undefined
    }
    try {
      rec.stop()
    } catch {
      /* ignore */
    }

    await queueRef.current
    segmentProcessModeRef.current = 'transcribe_and_suggest'
  }, [])

  const startSegment = useCallback(() => {
    const stream = streamRef.current
    if (!stream || !continueRecordingRef.current) return

    const mimeType = pickMimeType()
    let rec: MediaRecorder
    try {
      // Reuse the same recorder between segments when possible. Re-creating
      // MediaRecorder each chunk can introduce small gaps and, on some browsers,
      // intermittent lost audio at segment boundaries.
      const existing = recorderRef.current
      if (existing && existing.state === 'inactive') {
        rec = existing
      } else {
        rec = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`Could not start audio recorder: ${msg}`)
      continueRecordingRef.current = false
      stream.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      recorderRef.current = null
      setRecording(false)
      return
    }

    recorderRef.current = rec
    segmentProcessModeRef.current = 'transcribe_and_suggest'

    rec.ondataavailable = (ev: BlobEvent) => {
      const blob = ev.data
      if (!blob?.size) return
      const mimeHint =
        rec.mimeType?.trim() || blob.type?.trim() || undefined
      void enqueue(() => processAudioBlob(blob, mimeHint))
    }

    rec.onstop = () => {
      if (segmentTimerRef.current !== undefined) {
        window.clearTimeout(segmentTimerRef.current)
        segmentTimerRef.current = undefined
      }
      if (continueRecordingRef.current && streamRef.current) {
        queueMicrotask(() => startSegmentRef.current())
      }
    }

    const settings = useSessionStore.getState().settings
    if (rec.state === 'inactive') {
      rec.start()
    }
    segmentTimerRef.current = window.setTimeout(() => {
      segmentTimerRef.current = undefined
      if (rec.state !== 'inactive') {
        try {
          rec.stop()
        } catch {
          /* ignore */
        }
      }
    }, settings.chunkIntervalMs)
  }, [enqueue, processAudioBlob, setError, setRecording])

  useEffect(() => {
    startSegmentRef.current = startSegment
  }, [startSegment])

  const startRecording = useCallback(async () => {
    setError(null)
    const settings = useSessionStore.getState().settings
    if (!settings.groqApiKey.trim()) {
      setError('Add your Groq API key in Settings.')
      return
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    })
    streamRef.current = stream
    continueRecordingRef.current = true
    startSegment()
    if (recorderRef.current) {
      setRecording(true)
    }
  }, [setError, setRecording, startSegment])

  const stopRecording = useCallback(() => {
    continueRecordingRef.current = false
    if (segmentTimerRef.current !== undefined) {
      window.clearTimeout(segmentTimerRef.current)
      segmentTimerRef.current = undefined
    }
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null
    queueMicrotask(() => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    })
    setRecording(false)
  }, [setRecording])

  const refreshNow = useCallback(() => {
    const s = useSessionStore.getState()
    if (!s.settings.groqApiKey.trim()) {
      s.setError('Add your Groq API key in Settings.')
      return
    }
    if (s.transcript.length === 0 && !s.isRecording) {
      s.setError(
        'Nothing in the transcript yet. Start the mic and speak, then try refresh again.',
      )
      return
    }

    s.setError(null)

    void (async () => {
      useSessionStore.setState({ liveSuggestionsRefreshPending: true })
      try {
        if (useSessionStore.getState().isRecording) {
          useSessionStore.getState().setStatus('Syncing transcript…')
          await flushCurrentSegmentTranscribeOnly()
        }
        const after = useSessionStore.getState()
        if (after.transcript.length === 0) {
          after.setError(
            'Nothing in the transcript yet. Speak while recording (or wait for a chunk), then try refresh again.',
          )
          return
        }
        after.setStatus('Updating suggestions…')
        await after.runLiveSuggestionRefresh()
      } catch (e) {
        useSessionStore.getState().setError(
          e instanceof Error ? e.message : String(e),
        )
      } finally {
        useSessionStore.getState().setStatus(null)
        useSessionStore.setState({ liveSuggestionsRefreshPending: false })
      }
    })()
  }, [flushCurrentSegmentTranscribeOnly])

  /** Transcript column: transcribe whatever audio is in the current segment buffer (no new suggestion cards). */
  const refreshTranscriptNow = useCallback(() => {
    const s = useSessionStore.getState()
    if (!s.settings.groqApiKey.trim()) {
      s.setError('Add your Groq API key in Settings.')
      return
    }
    if (!s.isRecording) {
      s.setError(
        'Start the microphone first. Refresh transcribes audio buffered while recording.',
      )
      return
    }

    s.setError(null)
    setTranscriptRefreshPending(true)
    void (async () => {
      const lineCountBefore = useSessionStore.getState().transcript.length
      let leaveStatusMessage = false
      try {
        useSessionStore.getState().setStatus('Syncing transcript…')
        await flushCurrentSegmentTranscribeOnly()
        const st = useSessionStore.getState()
        if (st.isRecording && st.transcript.length === lineCountBefore) {
          leaveStatusMessage = true
          st.setStatus(
            'Refresh finished—no new line (silence or very little speech in that slice).',
          )
        }
      } catch (e) {
        useSessionStore.getState().setError(
          e instanceof Error ? e.message : String(e),
        )
      } finally {
        if (!leaveStatusMessage) {
          useSessionStore.getState().setStatus(null)
        }
        setTranscriptRefreshPending(false)
      }
      if (leaveStatusMessage) {
        const msg =
          'Refresh finished—no new line (silence or very little speech in that slice).'
        window.setTimeout(() => {
          useSessionStore.setState((state) =>
            state.statusLine === msg ? { statusLine: null } : {},
          )
        }, 5000)
      }
    })()
  }, [flushCurrentSegmentTranscribeOnly])

  useEffect(() => {
    return () => {
      continueRecordingRef.current = false
      if (segmentTimerRef.current !== undefined) {
        window.clearTimeout(segmentTimerRef.current)
      }
      const rec = recorderRef.current
      if (rec && rec.state !== 'inactive') {
        try {
          rec.stop()
        } catch {
          /* ignore */
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return {
    startRecording,
    stopRecording,
    refreshNow,
    refreshTranscriptNow,
    transcriptRefreshPending,
  }
}
