/** Turn Groq / OpenAI-style error JSON into a short, human-readable message. */
export function formatGroqError(status: number, body: string): string {
  let message = body
  let code: string | undefined
  try {
    const j = JSON.parse(body) as {
      error?: { message?: string; code?: string }
    }
    if (typeof j?.error?.message === 'string') message = j.error.message
    if (typeof j?.error?.code === 'string') code = j.error.code
  } catch {
    /* use raw body */
  }

  if (status === 401 || status === 403) {
    const hint =
      code === 'invalid_api_key'
        ? ' Open Settings on this exact site and paste a key from console.groq.com (keys saved on localhost do not apply here). Or set VITE_GROQ_API_KEY in Vercel Environment Variables.'
        : ''
    return `Groq rejected the API key (${status}).${hint} ${message}`
  }
  if (status === 429) {
    return `Rate limited by Groq. Wait a few seconds and try again. ${message}`
  }
  if (status >= 500) {
    return `Groq service error (${status}). Try again shortly. ${message}`
  }
  return message || `Request failed (${status})`
}
