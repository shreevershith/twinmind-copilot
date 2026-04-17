import type { ChatMessage, Suggestion } from "./types";

export class MissingApiKeyError extends Error {
  constructor() {
    super("Groq API key is not set. Open settings and paste your key.");
  }
}

function authHeader(apiKey: string): Record<string, string> {
  if (!apiKey) throw new MissingApiKeyError();
  return { Authorization: `Bearer ${apiKey}` };
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    // fall through
  }
  return `${res.status} ${res.statusText}`;
}

export async function transcribeChunk(
  apiKey: string,
  blob: Blob,
  mimeType: string,
): Promise<{ text: string; timestamp: string }> {
  const form = new FormData();
  const ext = mimeType.includes("mp4")
    ? "mp4"
    : mimeType.includes("ogg")
      ? "ogg"
      : "webm";
  form.append("audio", blob, `chunk.${ext}`);
  form.append("mimeType", mimeType);

  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: authHeader(apiKey),
    body: form,
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as { text: string; timestamp: string };
}

export async function fetchSuggestions(
  apiKey: string,
  payload: {
    transcript: string;
    prompt: string;
    model: string;
    priorSuggestions?: Array<{ type: string; preview: string }>;
  },
  signal?: AbortSignal,
): Promise<{ suggestions: Suggestion[]; timestamp: string }> {
  const res = await fetch("/api/suggestions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(apiKey),
    },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as { suggestions: Suggestion[]; timestamp: string };
}

export async function* streamChat(
  apiKey: string,
  payload: {
    transcript: string;
    chatHistory: ChatMessage[];
    question: string;
    systemPrompt: string;
    model: string;
  },
  signal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(apiKey),
    },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(await readErrorMessage(res));
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) yield decoder.decode(value, { stream: true });
  }
}
