import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

function getApiKey(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function POST(req: Request) {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    transcript?: string;
    chatHistory?: ChatMessage[];
    question?: string;
    systemPrompt?: string;
    model?: string;
  } | null;

  if (!body?.question || !body?.systemPrompt || !body?.model) {
    return NextResponse.json(
      { error: "question, systemPrompt, and model are required" },
      { status: 400 },
    );
  }

  const transcript = body.transcript ?? "";
  const systemContent = body.systemPrompt.replace(
    "{FULL_TRANSCRIPT}",
    transcript || "(no transcript yet)",
  );

  const history = (body.chatHistory ?? []).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const messages = [
    { role: "system" as const, content: systemContent },
    ...history,
    { role: "user" as const, content: body.question },
  ];

  let stream: AsyncIterable<{
    choices?: Array<{ delta?: { content?: string } }>;
  }>;
  try {
    const groq = new Groq({ apiKey });
    stream = (await groq.chat.completions.create({
      model: body.model,
      messages,
      stream: true,
      temperature: 0.7,
    })) as unknown as AsyncIterable<{
      choices?: Array<{ delta?: { content?: string } }>;
    }>;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        }
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(`\n[stream error: ${message}]`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
