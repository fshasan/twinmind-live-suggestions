/** Groq key from Vite env (must be prefixed with VITE_ to be available in the browser). */
export function groqKeyFromBuildEnv(): string {
  const v = import.meta.env.VITE_GROQ_API_KEY
  return typeof v === 'string' ? v.trim() : ''
}
