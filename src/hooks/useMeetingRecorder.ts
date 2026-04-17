import { useCallback, useEffect, useRef } from 'react'
import { fetchLiveSuggestions, transcribeAudio } from '../lib/groq'
import {
  buildTranscriptWindow,
  priorSuggestionsHint,
  useSessionStore,
} from '../store/sessionStore'

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

export function useMeetingRecorder() {
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const flushWaitersRef = useRef<((blob: Blob) => void)[]>([])
  const queueRef = useRef<Promise<void>>(Promise.resolve())

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

  const processAudioBlob = useCallback(async (blob: Blob, mimeHint?: string) => {
    if (!blob.size) return
    const settings = useSessionStore.getState().settings
    const appendTranscriptChunk = useSessionStore.getState().appendTranscriptChunk
    const prependSuggestionBatch = useSessionStore.getState().prependSuggestionBatch

    setBusy(true)
    setStatus('Transcribing…')
    setError(null)

    const key = settings.groqApiKey.trim()
    if (!key) throw new Error('Add your Groq API key in Settings.')

    const mime =
      mimeHint?.trim() ||
      recorderRef.current?.mimeType?.trim() ||
      blob.type?.trim() ||
      undefined

    const text = await transcribeAudio(key, blob, settings.whisperModel, mime)
    if (text) appendTranscriptChunk(text)

    setStatus('Updating suggestions…')
    const lines = useSessionStore.getState().transcript
    const windowText = buildTranscriptWindow(
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
    setStatus(null)
    setBusy(false)
  }, [setBusy, setError, setStatus])

  const onDataAvailable = useCallback(
    (ev: BlobEvent) => {
      const blob = ev.data
      if (!blob?.size) return

      const mimeHint =
        recorderRef.current?.mimeType?.trim() ||
        blob.type?.trim() ||
        undefined

      const waiters = flushWaitersRef.current.splice(0)
      if (waiters.length) {
        waiters.forEach((fn) => fn(blob))
        return
      }

      void enqueue(() => processAudioBlob(blob, mimeHint))
    },
    [enqueue, processAudioBlob],
  )

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
    const mimeType = pickMimeType()
    const rec = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream)
    recorderRef.current = rec
    rec.ondataavailable = onDataAvailable
    rec.start(settings.chunkIntervalMs)
    setRecording(true)
  }, [onDataAvailable, setError, setRecording])

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      rec.stop()
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    recorderRef.current = null
    streamRef.current = null
    setRecording(false)
  }, [setRecording])

  const refreshNow = useCallback(async () => {
    const rec = recorderRef.current
    if (!rec || rec.state === 'inactive') {
      setError(
        'Start the microphone first. Refresh records new audio, updates the transcript, then refreshes suggestions.',
      )
      return
    }

    setError(null)
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        flushWaitersRef.current = flushWaitersRef.current.filter((x) => x !== resolver)
        reject(new Error('Timed out waiting for audio chunk.'))
      }, 10_000)

      function resolver(blob: Blob) {
        window.clearTimeout(timer)
        const mimeHint =
          recorderRef.current?.mimeType?.trim() ||
          blob.type?.trim() ||
          undefined
        void enqueue(async () => {
          await processAudioBlob(blob, mimeHint)
          resolve()
        })
      }

      flushWaitersRef.current.push(resolver)
      try {
        rec.requestData()
      } catch (e) {
        window.clearTimeout(timer)
        flushWaitersRef.current = flushWaitersRef.current.filter((x) => x !== resolver)
        reject(e)
      }
    }).catch((e) => {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    })
  }, [enqueue, processAudioBlob, setError])

  useEffect(() => {
    return () => {
      const rec = recorderRef.current
      if (rec && rec.state !== 'inactive') rec.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return {
    startRecording,
    stopRecording,
    refreshNow,
  }
}
