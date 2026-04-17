/** Turn Groq / OpenAI-style error JSON into a short, human-readable message. */
export function formatGroqError(status: number, body: string): string {
  let message = body
  try {
    const j = JSON.parse(body) as { error?: { message?: string } }
    if (typeof j?.error?.message === 'string') message = j.error.message
  } catch {
    /* use raw body */
  }

  if (status === 401 || status === 403) {
    return `Authentication failed. Check your Groq API key in Settings. ${message}`
  }
  if (status === 429) {
    return `Rate limited by Groq. Wait a few seconds and try again. ${message}`
  }
  if (status >= 500) {
    return `Groq service error (${status}). Try again shortly. ${message}`
  }
  return message || `Request failed (${status})`
}
