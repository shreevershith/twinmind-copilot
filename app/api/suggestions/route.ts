import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import type { Suggestion, SuggestionType } from "@/lib/types";

export const runtime = "nodejs";

const VALID_TYPES: ReadonlySet<SuggestionType> = new Set([
  "QUESTION",
  "TALKING_POINT",
  "ANSWER",
  "FACT_CHECK",
  "CLARIFY",
]);

function getApiKey(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function extractSuggestions(raw: string): Suggestion[] {
  const parsed = JSON.parse(raw) as unknown;
  const arr: unknown = Array.isArray(parsed)
    ? parsed
    : (parsed as { suggestions?: unknown })?.suggestions;
  if (!Array.isArray(arr)) throw new Error("No suggestions array in response");

  const clean = arr.slice(0, 3).map((item): Suggestion => {
    const candidate = item as Partial<Suggestion>;
    const type =
      candidate.type && VALID_TYPES.has(candidate.type as SuggestionType)
        ? (candidate.type as SuggestionType)
        : "TALKING_POINT";
    return {
      type,
      preview: String(candidate.preview ?? "").trim(),
      detail: String(candidate.detail ?? "").trim(),
    };
  });

  if (clean.length === 0) throw new Error("Empty suggestions array");
  return clean;
}

export async function POST(req: Request) {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    transcript?: string;
    prompt?: string;
    model?: string;
    priorSuggestions?: Array<{ type?: string; preview?: string }>;
  } | null;

  if (!body?.transcript || !body?.prompt || !body?.model) {
    return NextResponse.json(
      { error: "transcript, prompt, and model are required" },
      { status: 400 },
    );
  }

  let userPrompt = body.prompt.replace("{TRANSCRIPT}", body.transcript);

  // If we have prior batches, tell the model exactly what it already flagged
  // so it stops re-suggesting the same claims. The prompt's "don't repeat"
  // rule is toothless on its own because each /api/suggestions call is
  // stateless; the model needs to see the history to honour the rule.
  if (body.priorSuggestions && body.priorSuggestions.length > 0) {
    const priorList = body.priorSuggestions
      .filter((s) => s && s.type && s.preview)
      .map((s) => `- [${s.type}] ${s.preview}`)
      .join("\n");
    if (priorList) {
      userPrompt += `\n\nAlready suggested in recent batches (do NOT repeat these; the user has already seen them, find fresh angles):\n${priorList}`;
    }
  }

  const timestamp = new Date().toISOString();

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: body.model,
      messages: [{ role: "user", content: userPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1200,
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    let suggestions: Suggestion[];
    try {
      suggestions = extractSuggestions(raw);
    } catch (parseErr) {
      const message =
        parseErr instanceof Error ? parseErr.message : "Parse failed";
      suggestions = [
        {
          type: "ERROR",
          preview: "Model returned unparseable output",
          detail: `${message}. Raw: ${raw.slice(0, 400)}`,
        },
      ];
    }

    return NextResponse.json({ suggestions, timestamp });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Suggestion generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
