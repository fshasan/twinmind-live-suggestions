/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional default Groq API key (embedded in client bundle — use only for demos). */
  readonly VITE_GROQ_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
