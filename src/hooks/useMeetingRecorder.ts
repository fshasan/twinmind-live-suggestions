import { useCallback, useEffect, useRef } from 'react'
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
 * **Refresh** calls `useSessionStore.getState().runLiveSuggestionRefresh()` so
 * work runs on the store (no stale hook closures). It does not use `enqueue`.
 */
export function useMeetingRecorder() {
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const segmentTimerRef = useRef<number | undefined>(undefined)
  const continueRecordingRef = useRef(false)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const startSegmentRef = useRef<() => void>(() => {})

  const setRecording = useSessionStore((s) => s.setRecording)
  const setBusy = useSessionStore((s) => s.setBusy)
  const setStatus = useSessionStore((s) => s.setStatus)
  const setError = useSessionStore((s) => s.setError)

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
    if (s.transcript.length === 0) {
      s.setError(
        'Nothing in the transcript yet. Start the mic and speak, then try refresh again.',
      )
      return
    }

    s.setError(null)
    s.setStatus('Updating suggestions…')

    void s
      .runLiveSuggestionRefresh()
      .catch((e) => {
        useSessionStore.getState().setError(
          e instanceof Error ? e.message : String(e),
        )
      })
      .finally(() => {
        useSessionStore.getState().setStatus(null)
      })
  }, [])

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
  }
}
