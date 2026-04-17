# TwinMind — Live suggestions (take-home)

Single-page app that captures microphone audio in ~30s chunks (Groq **Whisper Large V3**), generates **3** contextual live suggestions (**GPT-OSS 120B** via Groq), and powers a right-hand chat with **streaming** assistant replies for low time-to-first-token.

## Features

- **Left:** Start/stop mic, rolling transcript (auto-scroll), ~30s chunks while recording.
- **Middle:** Batches of 3 suggestions (newest on top). **Refresh** transcribes pending audio then regenerates suggestions (mic must be on).
- **Right:** Tap a suggestion for a detailed answer, or type a question. Chat streams token-by-token.
- **Settings:** Paste your **Groq API key** and edit prompts/context sizes (defaults tuned for quality). The key is stored in `localStorage` for this origin only (your `localhost` key does **not** apply on `*.vercel.app`).
- **Export:** Download JSON (transcript, suggestion batches, chat) for review.

## Prerequisites

- Node.js 20+
- A [Groq](https://console.groq.com/) API key

## Run locally

```bash
npm install
npm run dev
```

Open the printed URL (usually `http://localhost:5173`), add your key under **Settings**, then **Start mic**.

## Build

```bash
npm run build
npm run preview
```

## Deploy on Vercel

The repo includes `vercel.json` (Vite, `dist` output). Pick one path:

### Option A — GitHub (recommended)

1. Push this repo to GitHub (already done if you use `origin`).
2. Open [vercel.com](https://vercel.com) → **Add New** → **Project** → **Import** your repository.
3. Vercel should detect **Vite** automatically. Confirm:
   - **Install Command:** `npm install`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. **Environment variables (optional):**
   - By default, each visitor adds their key in **Settings** after deploy.
   - To bake in a default key for demos only, add **`VITE_GROQ_API_KEY`** in Vercel → Project → Settings → Environment Variables (Production). It must be prefixed with `VITE_` or Vite will not expose it to the browser. **Warning:** client-side env vars are visible in the downloaded JavaScript; treat this like a public key.
5. Click **Deploy**. Production URL will look like `https://<project>.vercel.app`.

If you see **401 Invalid API Key** on the deployed site, open **Settings** on that URL and paste a valid key from [console.groq.com/keys](https://console.groq.com/keys), or set `VITE_GROQ_API_KEY` as above and redeploy.

### Option B — Vercel CLI

```bash
npm i -g vercel   # or: npx vercel@latest
vercel login
vercel            # preview
vercel --prod     # production
```

### Notes

- All API calls run **in the browser** to `api.groq.com`. If anything fails in production, check the browser **Network** tab (CORS or ad blockers).
- **HTTPS** is required for `getUserMedia` (microphone) in most browsers; Vercel provides HTTPS by default.

## Stack

- React + TypeScript + Vite  
- Tailwind CSS v4  
- Zustand (session state)  
- Groq: `whisper-large-v3`, `openai/gpt-oss-120b`

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Dev server + HMR         |
| `npm run build`| Typecheck + production build |
| `npm run preview` | Serve production build |
| `npm run lint` | ESLint                   |
