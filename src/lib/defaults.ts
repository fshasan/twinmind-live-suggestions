import type { AppSettings } from '../types'

export const DEFAULT_SETTINGS: AppSettings = {
  groqApiKey: '',
  whisperModel: 'whisper-large-v3',
  llmModel: 'openai/gpt-oss-120b',
  chunkIntervalMs: 30_000,
  suggestionContextChars: 12_000,
  expandedContextChars: 24_000,
  chatContextChars: 28_000,
  suggestionTemperature: 0.35,
  chatTemperature: 0.45,
  liveSuggestionPrompt: `You are TwinMind, an always-on meeting copilot. Given RECENT TRANSCRIPT (may be partial), output exactly 3 high-value suggestions as JSON.

Rules:
- Mix types across the 3: at least 2 different kinds when possible from: question (smart follow-up), talking_point, answer (to something just asked), fact_check, clarify.
- Each "preview" must stand alone as useful (2–4 short sentences max, dense and actionable). No fluff.
- "title" is 3–8 words for the card header.
- Ground only in transcript; if uncertain, prefer clarifying questions over invented facts.
- Avoid repeating the same angle as PRIOR_SUGGESTIONS_JSON when provided.
- Respond with JSON only, no markdown, matching the schema.`,

  expandedAnswerPrompt: `You are TwinMind. The user tapped a live suggestion card. Give a richer, structured answer: key bullets, risks, and (if helpful) a concise suggested script line. Stay grounded in TRANSCRIPT; label speculation clearly.`,

  chatPrompt: `You are TwinMind, a live meeting copilot. Answer using TRANSCRIPT and CHAT so far. Be direct, skimmable, and useful under time pressure. If the transcript lacks info, say what is missing and offer the best next step.`,
}

export const SETTINGS_STORAGE_KEY = 'twinmind-settings-v1'
