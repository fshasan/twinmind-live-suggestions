# TwinMind — Live suggestions (take-home)

Single-page app that captures microphone audio in ~30s chunks (Groq **Whisper Large V3**), generates **3** contextual live suggestions (**GPT-OSS 120B** via Groq), and powers a right-hand chat with **streaming** assistant replies for low time-to-first-token.

## Features

- **Left:** Start/stop mic, rolling transcript (auto-scroll), ~30s chunks while recording.
- **Middle:** Batches of 3 suggestions (newest on top). **Refresh** transcribes pending audio then regenerates suggestions (mic must be on).
- **Right:** Tap a suggestion for a detailed answer, or type a question. Chat streams token-by-token.
- **Settings:** Paste your **Groq API key** and edit prompts/context sizes (defaults tuned for quality). Key is stored in `localStorage` in this browser only.
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

## Deploy (e.g. Vercel)

- **Framework:** Vite  
- **Build command:** `npm run build`  
- **Output directory:** `dist`  

All API calls go **from the browser** to `api.groq.com`. If the browser blocks requests (CORS), add a same-origin proxy on your host.

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
