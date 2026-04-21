import { formatGroqError } from './apiError'
import type { AppSettings, LiveSuggestion } from '../types'

const GROQ_BASE = 'https://api.groq.com/openai/v1'

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
  }
}

/** Groq validates the upload using filename + bytes; extension must match container (e.g. Safari → mp4, not webm). */
function extensionForMime(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes('webm')) return 'webm'
  if (m.includes('mp4') || m.includes('mp4a') || m.includes('m4a') || m.includes('aac'))
    return 'm4a'
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3'
  if (m.includes('ogg')) return 'ogg'
  if (m.includes('wav')) return 'wav'
  if (m.includes('flac')) return 'flac'
  return 'webm'
}

function audioFileFromBlob(blob: Blob, mimeHint?: string): File {
  if (blob instanceof File && blob.name && blob.name !== 'blob') {
    return blob
  }
  const raw =
    (mimeHint && mimeHint.trim()) ||
    (blob.type && blob.type.trim()) ||
    'audio/webm'
  const baseType = raw.split(';')[0].trim()
  const ext = extensionForMime(baseType)
  const name = `chunk.${ext}`
  return new File([blob], name, {
    type: baseType || 'application/octet-stream',
  })
}

export async function transcribeAudio(
  apiKey: string,
  blob: Blob,
  model: string,
  mimeHint?: string,
): Promise<string> {
  const fd = new FormData()
  fd.append('file', audioFileFromBlob(blob, mimeHint))
  fd.append('model', model)
  fd.append('response_format', 'json')

  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: fd,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Whisper / transcription: ${formatGroqError(res.status, err)}`)
  }
  const data = (await res.json()) as { text?: string }
  return (data.text ?? '').trim()
}

function withIds(
  items: Omit<LiveSuggestion, 'id'>[],
): LiveSuggestion[] {
  return items.map((s) => ({
    ...s,
    id: globalThis.crypto.randomUUID(),
  }))
}

const KINDS = new Set<LiveSuggestion['kind']>([
  'question',
  'talking_point',
  'answer',
  'fact_check',
  'clarify',
])

/** Models sometimes wrap JSON in fences or add prose; extract a parseable object. */
function extractJsonObjectString(raw: string): string {
  let s = raw.trim()
  const fenced = s.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```/im)
  if (fenced) s = fenced[1].trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start >= 0 && end > start) return s.slice(start, end + 1)
  return s
}

function parseSuggestionsPayload(raw: string): Omit<LiveSuggestion, 'id'>[] {
  const parsed = JSON.parse(extractJsonObjectString(raw)) as {
    suggestions?: unknown
  }
  const list = parsed.suggestions
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('Suggestions were unavailable. Please try again.')
  }
  const normalized = list.length > 3 ? list.slice(0, 3) : list
  return normalized.map((item, i) => {
    const o = item as Record<string, unknown>
    const kind = o.kind
    const title = o.title
    const preview = o.preview
    if (
      typeof kind !== 'string' ||
      typeof title !== 'string' ||
      typeof preview !== 'string'
    ) {
      throw new Error(`Invalid suggestion shape at index ${i}.`)
    }
    if (!KINDS.has(kind as LiveSuggestion['kind'])) {
      throw new Error(`Invalid suggestion kind at index ${i}: ${kind}`)
    }
    return {
      kind: kind as LiveSuggestion['kind'],
      title,
      preview,
    }
  })
}

export async function fetchLiveSuggestions(
  settings: AppSettings,
  transcriptWindow: string,
  priorSuggestionsJson: string,
): Promise<LiveSuggestion[]> {
  const apiKey = settings.groqApiKey.trim()
  if (!apiKey) throw new Error('Add your Groq API key in Settings.')

  const priorTrimmed = (priorSuggestionsJson ?? '').trim()
  const priorEmpty = priorTrimmed.length === 0 || priorTrimmed === '[]'

  const userParts = [
    'RECENT TRANSCRIPT (lines may be timestamped [HH:MM:SS]):',
    transcriptWindow || '(empty so far)',
    '',
  ]
  if (priorEmpty) {
    userParts.push(
      'No prior suggestion batch for this request. Produce exactly 3 distinct suggestions grounded only in the transcript above.',
      '',
    )
  } else {
    userParts.push(
      'PRIOR_SUGGESTIONS_JSON (avoid repeating these angles):',
      priorTrimmed,
      '',
    )
  }
  userParts.push(
    'Return JSON only: {"suggestions":[{"kind":"question|talking_point|answer|fact_check|clarify","title":"...","preview":"..."}, ...]} — exactly 3 items.',
  )
  const userContent = userParts.join('\n')

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      ...authHeaders(apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.llmModel,
      temperature: settings.suggestionTemperature,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: settings.liveSuggestionPrompt },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Suggestions: ${formatGroqError(res.status, err)}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const raw = data.choices?.[0]?.message?.content
  if (!raw) throw new Error('No suggestion content from model.')

  return withIds(parseSuggestionsPayload(raw))
}

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function* iterateChatStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data) as {
          choices?: { delta?: { content?: string | null } }[]
        }
        const content = json.choices?.[0]?.delta?.content
        if (typeof content === 'string' && content.length > 0) {
          yield content
        }
      } catch {
        /* ignore malformed chunk */
      }
    }
  }
}

/**
 * Streams chat completion from Groq (first token latency for UX).
 * Returns the full concatenated text when the stream ends.
 */
export async function streamChatCompletion(
  settings: AppSettings,
  messages: ChatMessage[],
  onDelta: (chunk: string) => void,
  options?: { temperature?: number; max_tokens?: number },
): Promise<string> {
  const apiKey = settings.groqApiKey.trim()
  if (!apiKey) throw new Error('Add your Groq API key in Settings.')

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      ...authHeaders(apiKey),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.llmModel,
      temperature: options?.temperature ?? settings.chatTemperature,
      max_tokens: options?.max_tokens ?? 2048,
      messages,
      stream: true,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(formatGroqError(res.status, err))
  }

  if (!res.body) {
    throw new Error('No response body from Groq.')
  }

  let full = ''
  for await (const chunk of iterateChatStream(res.body)) {
    full += chunk
    onDelta(chunk)
  }
  return full.trim()
}
