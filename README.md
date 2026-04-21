# TwinMind

**TwinMind** is a single-page meeting copilot: it listens through your microphone, transcribes speech with **Groq Whisper**, surfaces **three live suggestions** after each chunk, and offers a **streaming chat** for deeper answers—without leaving the browser.

---

## Table of contents

- [Why TwinMind](#why-twinmind)
- [How it works](#how-it-works)
- [Features](#features)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Project structure](#project-structure)
- [Deploy (Vercel)](#deploy-vercel)
- [Troubleshooting](#troubleshooting)
- [Scripts & stack](#scripts--stack)

---

## Why TwinMind

In a live conversation you want **short, actionable nudges** (questions, talking points, clarifications) and sometimes a **longer, structured answer**. TwinMind separates those: the middle column stays lightweight; the right column goes deep when you tap a card or type a question.

---

## How it works

1. **Microphone** — You start the mic. Audio is recorded in **segments** (default **30 seconds**). Each segment is a **complete** media file (stop/restart recorder), which keeps Whisper happy across browsers (especially vs. fragile timeslice chunks).
2. **Transcription** — Each finished segment is sent to **Groq** `whisper-large-v3`. New text is appended to the rolling **transcript** (timestamped lines).
3. **Live suggestions** — The app sends a **recent tail** of the transcript (plus hints about prior suggestion cards) to **Groq** `openai/gpt-oss-120b` with **JSON output**. You always get **exactly three** new cards, prepended as a batch.
4. **Manual refresh** — **Refresh** requests another batch from the **latest transcript** (mic can be off). The button shows **Loading…** while the request runs.
5. **Chat** — Opening a suggestion or sending a message runs a **streaming** completion so the first tokens appear quickly. Expanded answers can use a **larger transcript window** (head + tail if the session is very long).

All Groq calls are made **from the browser** to `api.groq.com` (no custom backend in this repo).

---

## Features

| Area | What you get |
|------|----------------|
| **Transcript** | Start/stop mic, auto-scrolling lines with timestamps |
| **Suggestions** | Batches of 3 cards; newest batch on top; kinds include question, talking point, answer, fact check, clarify |
| **Refresh** | New batch from current transcript + Groq key (shows loading state) |
| **Chat** | Tap a card for a detailed reply, or freeform questions; streaming assistant text |
| **Settings** | API key, models, chunk length, context character budgets, temperatures, editable system prompts |
| **Session** | Export transcript, suggestion batches, and chat as JSON |
| **UI** | Dark/light theme, status line; failures stay off a global error banner |

---

## Quick start

**Requirements:** [Node.js 20+](https://nodejs.org/) and a [Groq API key](https://console.groq.com/).

```bash
git clone https://github.com/fshasan/twinmind-live-suggestions.git
cd twinmind-live-suggestions
npm install
npm run dev
```

Open the URL Vite prints (usually **http://localhost:5173**).

1. Open **Settings** (header) and paste your **Groq API key**.
2. Click **Start mic** and speak; after each ~30s segment you should see new transcript text and a new suggestion batch.
3. Use **Refresh** anytime you have transcript lines to pull another batch without waiting for the next segment.
4. Use **Chat** for a deeper pass on a suggestion or your own prompt.

**Production build:**

```bash
npm run build
npm run preview
```

---

## Configuration

### In the app (Settings)

Settings persist in **`localStorage`** for that **origin** only (e.g. `localhost` and your deployed domain each have their own saved key).

You can tune:

- **Whisper** and **chat** models  
- **Chunk interval** (ms) for recording segments  
- **Context sizes** (characters) for suggestions, expanded answers, and chat  
- **Temperatures** for suggestions vs. chat  
- **System prompts** for live suggestions, expanded answers, and freeform chat  

Defaults favor grounded, varied cards and scannable long answers.

### Environment variable (optional)

For demos on Vercel you may set:

| Variable | Purpose |
|----------|---------|
| `VITE_GROQ_API_KEY` | Default Groq key baked into the client build |

**Important:** Any `VITE_*` value is **public** in the shipped JavaScript. Treat it like a key you are okay exposing, or prefer pasting the key in **Settings** per visitor.

---

## Project structure

```text
src/
  App.tsx                 # Shell: header, three columns, export, theme
  components/             # TranscriptColumn, SuggestionsColumn, ChatColumn, SettingsModal
  hooks/
    useMeetingRecorder.ts # Mic, segments, queue, Whisper + suggestions pipeline
    useChatActions.ts     # Suggestion → chat, user messages, streaming
    useTheme.ts
  lib/
    groq.ts               # Whisper upload, suggestion JSON, streaming chat
    transcriptPrompt.ts   # Timestamped windows, expanded head+tail context
    defaults.ts           # Default prompts and settings
    apiError.ts           # Groq error bodies → readable messages
    exportSession.ts
  store/
    sessionStore.ts       # Zustand: transcript, batches, chat, settings, manual refresh
  types.ts
```

---

## Deploy (Vercel)

This repo includes **`vercel.json`** with `"framework": "vite"` so Vercel can detect the setup.

### GitHub → Vercel (recommended)

1. Push the repo to GitHub.
2. In [Vercel](https://vercel.com): **Add New → Project → Import** the repository.
3. Confirm **Install** `npm install`, **Build** `npm run build`, **Output** `dist`.
4. Deploy. Open the production URL over **HTTPS** (needed for microphone access in most browsers).

### CLI

```bash
npx vercel@latest        # preview
npx vercel@latest --prod # production
```

After deploy, if you see **401 / invalid API key**, open **Settings** on that **exact** hostname and paste a key from [Groq keys](https://console.groq.com/keys)—keys saved on `localhost` do not carry over to `*.vercel.app`.

---

## Troubleshooting

| Symptom | Things to check |
|---------|-------------------|
| **Mic won’t start** | Use **HTTPS** (or `localhost`). Grant browser microphone permission. |
| **401 / invalid key** | Key in **Settings** for this origin; or `VITE_GROQ_API_KEY` on Vercel with redeploy. |
| **Whisper “valid media file?”** | Segments are designed as full files; try another browser or shorter chunk in Settings. |
| **No network on Refresh** | Refresh needs **transcript lines** and a **key**; disabled buttons do not fire clicks. |
| **Requests fail silently** | Ad blockers or extensions; open **DevTools → Network** and look for blocked `api.groq.com` calls. |

---

## Scripts & stack

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server + HMR |
| `npm run build` | Typecheck (`tsc -b`) + Vite production build |
| `npm run preview` | Serve the `dist` build locally |
| `npm run lint` | ESLint |

**Stack:** React 19, TypeScript, Vite 8, Tailwind CSS v4, Zustand. **AI:** Groq (`whisper-large-v3`, `openai/gpt-oss-120b` by default).

---

## License

This project is **private** (`"private": true` in `package.json`). Add a `LICENSE` file if you open-source it.
