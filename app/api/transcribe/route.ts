import Groq from "groq-sdk";
import { NextResponse } from "next/server";

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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form body" }, { status: 400 });
  }

  const file = form.get("audio");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing audio blob" }, { status: 400 });
  }

  try {
    const groq = new Groq({ apiKey });
    const result = await groq.audio.transcriptions.create({
      file: file as unknown as File,
      model: "whisper-large-v3",
      response_format: "text",
      temperature: 0,
    });

    const text =
      typeof result === "string" ? result : ((result as { text?: string }).text ?? "");

    return NextResponse.json({
      text: text.trim(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
