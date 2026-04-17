# TwinMind Live Suggestions

A real-time meeting copilot. Record audio in the browser, get a live transcript every 30 s, watch three type-classified suggestions appear as the conversation unfolds, and chat against the full transcript — all powered by Groq.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first load the app asks for a Groq API key — paste one from [console.groq.com/keys](https://console.groq.com/keys). The key is stored in `localStorage` only; every client → server request forwards it as `Authorization: Bearer …`, and the server uses it to instantiate `new Groq({ apiKey })` per request. It is never logged or persisted server-side.

Click **Start recording**, speak for 30 s, and a transcript chunk + a batch of three suggestions will appear. Click any card to pipe it into the chat column, or type your own question.

## Stack

- **Next.js 16 (App Router) + TypeScript + Tailwind 4** — a single deploy target covers the client UI, the streaming chat API, and the audio-forwarding transcription endpoint. Chose Next over FastAPI + a separate frontend because the entire app is three pages and three routes; splitting deployment surface would add packaging and CORS overhead for zero gain.
- **Groq for everything** — Whisper Large V3 for transcription, `openai/gpt-oss-120b` (GPT-OSS 120B) for suggestions and chat. Groq's latency on GPT-OSS is the single biggest reason the live-suggestion UX feels responsive; switching to a slower provider would break the 30 s cadence.
- **React Context + `useReducer`** for shared state (`SessionContext`, `SettingsContext`). No Zustand, no Redux — three columns worth of shared state doesn't justify a library.
- **`ReadableStream` in App Router route handlers** for chat streaming. The server consumes Groq's async iterator and enqueues `TextEncoder.encode(delta)` chunks; the client reads with `response.body.getReader()`. No SSE, no third-party streaming helpers.

## Prompt strategy

The app runs **three distinct prompts**, each with its own editable template and context window in Settings. They do different jobs and need different defaults — collapsing them into one produces visibly worse suggestions and chat answers.

### 1. Live-suggestion prompt (`DEFAULT_SUGGESTION_PROMPT`)

Three things happen in one call:

1. **Classifies into a fixed typology** — `QUESTION | TALKING_POINT | ANSWER | FACT_CHECK | CLARIFY`. Without a typology the model produces bland, same-shaped "Consider asking…" cards every batch. Typing forces variety — the selection rule explicitly says never return three of the same type and makes type choice conditional on what's in the transcript (a question just asked → at least one ANSWER; a strong factual claim → consider a FACT_CHECK).
2. **Demands a standalone-valuable `preview`** — the UI shows only the preview on the card. If the preview doesn't deliver value on its own, the card is dead weight. The prompt explicitly says "Must deliver value even if never clicked." A longer `detail` is also produced per suggestion and kept in the export JSON; clicking a card ignores it and triggers a fresh, streaming detailed-answer prompt instead (see #2 below).
3. **Uses JSON mode with a wrapping object** — Groq's `response_format: { type: "json_object" }` requires the top-level value be an object, not an array, so the prompt asks for `{ "suggestions": [...] }`. The server parser accepts both shapes, which prevents a single token of hallucination from breaking the batch.

Also: CLARIFY is tightened to "technical term, acronym, or domain-specific assumption" and explicitly forbidden from flagging common idioms — otherwise the model latches onto phrases like "touch base" and produces weak cards.

### 2. Detailed-answer prompt (`DEFAULT_DETAIL_ANSWER_PROMPT`)

Fires when the user **taps a suggestion card**. Separate from the freeform chat prompt because the job is different: the preview is already in the chat as the user message, and the assistant's job is a longer-form, structured expansion — not a generic Q&A reply. The prompt branches on the suggestion type (QUESTION → how to phrase it + what to listen for; FACT_CHECK → what to verify; etc.) and demands a specific structure (lead sentence + 3–5 sentences or short bullet list).

### 3. Chat prompt (`DEFAULT_CHAT_PROMPT`)

Fires when the user **types their own question**. A short, forceful grounding prompt: "Answer ONLY based on the transcript provided below. Do not use outside knowledge. If the answer isn't in the transcript, say so." This kills the single biggest failure mode — the model silently falling back to generic information about apps/meetings/products when the transcript doesn't actually contain the answer.

The chat prompt is deliberately **a system prompt**, not a single-user-message template. `/api/chat` sends `[system (transcript-primed), ...priorChatHistory, userQuestion]` to Groq — a proper multi-turn conversation. This matters because follow-up questions ("tell me more about that") need access to prior turns; collapsing everything into one user message loses that structure and hurts chat quality.

### Context windows

Three windows, one per prompt, all in chars (not tokens — dragging in a tokenizer to save a few trivial bytes isn't worth it):

- `suggestionContextChars` (default 3200 ≈ 800 tokens) — tail slice. Live suggestions should be about the last ~2 minutes, not the whole meeting.
- `detailContextChars` (default 0 = full) — when the user taps a card, we want the full transcript available, because a card that fired 5 minutes ago may reference something said 10 minutes before that.
- `chatContextChars` (default 0 = full) — same reasoning for freeform questions.

## Tradeoffs & what I'd do with more time

- **Speaker diarization.** The transcript is a single undifferentiated stream. Whisper doesn't diarize, so "who asked what" gets lost. With more time I'd add a second-pass diarizer (pyannote or similar) and tag each transcript line with a speaker ID — that alone would dramatically improve ANSWER and FACT_CHECK accuracy.
- **Smarter chunking.** Fixed 30 s windows miss mid-sentence boundaries. A VAD-gated approach (cut on silence, not the clock) would produce cleaner chunks and better transcription. Doable with a small WebAudio `AnalyserNode` + an energy threshold.
- **Embeddings-based context selection for chat.** Right now chat gets the whole transcript (or a char-sliced tail). For long meetings, embedding each transcript chunk and retrieving the top-k relevant chunks for a given question would both shrink token usage and improve answer focus. Groq doesn't host embeddings, so this would pull in a second provider — deliberately skipped for the assignment's scope.
- **On-device Whisper.** Sending 30 s blobs to Groq on every cycle works but burns network and API cost. Running `whisper.cpp`/WebGPU Whisper locally and falling back to Groq only on failure would cut perceived latency.
- **Robustness around audio formats.** `MediaRecorder` MIME types vary (Chrome = `audio/webm;codecs=opus`, Safari = `audio/mp4`). The recorder logs the actual MIME once on start and the Whisper endpoint accepts webm/mp4/ogg. A Safari/iOS pass would surface any remaining rough edges.
- **Cancellation UX.** `AbortController` is wired into the suggestion fetch and the chat stream (the Stop button in chat calls it), but a similar affordance for in-flight transcription would make "I misspoke, skip this chunk" possible.

## Architecture at a glance

```
app/
  api/transcribe/route.ts   POST audio → Whisper → { text, timestamp }
  api/suggestions/route.ts  POST transcript → LLM (json_object) → { suggestions, timestamp }
  api/chat/route.ts         POST { transcript, history, question } → streamed text
  page.tsx                  providers + 3-column shell + settings + error toast
components/
  TranscriptColumn.tsx      owns the ChunkedRecorder, posts chunks, renders transcript
  SuggestionsColumn.tsx     30s interval + refresh button + batch list (newest first)
  ChatColumn.tsx            streaming assistant messages + freeform input
  SuggestionCard.tsx        type-badged card, clickable → pushes to chat
  SettingsPanel.tsx         slide-over with all editable prompts + config
  ApiKeyGate.tsx            centered prompt when no key in storage
  ExportButton.tsx          downloads session JSON
  use-chat-send.ts          hook: shared send() used by card-click and freeform input
lib/
  recorder.ts               MediaRecorder wrapper: stop/restart every N seconds
  groq-client.ts            client-side fetch wrappers (transcribe, suggestions, streamChat)
  session-context.tsx       transcript / batches / chatHistory / loading states
  settings-context.tsx      localStorage-backed settings + defaults
  prompts.ts                default suggestion / detail-answer / chat prompts
  export.ts                 buildExportJson + downloadExport
  types.ts                  Suggestion, SuggestionBatch, ChatMessage, etc.
```

## Export shape

The **Export JSON** button in the header downloads a session snapshot:

```json
{
  "exported_at": "2025-04-16T15:42:00.000Z",
  "transcript": [{ "timestamp": "…", "text": "…" }],
  "suggestion_batches": [
    {
      "timestamp": "…",
      "suggestions": [{ "type": "…", "preview": "…", "detail": "…" }]
    }
  ],
  "chat_history": [{ "timestamp": "…", "role": "user", "content": "…" }]
}
```

`suggestion_batches` is ordered oldest → newest in the export (the UI renders newest first for visibility, but the export is chronological so it replays naturally).

## Config (editable via the Settings panel)

| Field | Default | Notes |
| --- | --- | --- |
| Groq API key | — | Required. `localStorage` only. |
| LLM model | `openai/gpt-oss-120b` | Change if Groq renames the model. |
| Refresh interval | 30 s | Doubles as the audio-chunk length. |
| Suggestion context (chars) | 3200 | ~800 tokens. Tail slice of transcript. |
| Detail context (chars) | 0 | 0 = full transcript. Used on card click. |
| Chat context (chars) | 0 | 0 = full transcript. Used for freeform chat. |
| Suggestion prompt | (see `lib/prompts.ts`) | Must contain `{TRANSCRIPT}`. |
| Detail-answer prompt | (see `lib/prompts.ts`) | Must contain `{FULL_TRANSCRIPT}`. Fires on card tap. |
| Chat system prompt | (see `lib/prompts.ts`) | Must contain `{FULL_TRANSCRIPT}`. Fires on freeform question. |

## Deploy

```bash
vercel deploy
```

Zero config — the Next.js default Vercel template just works. No env vars needed; the API key travels from the user's browser to the route handler per request.
