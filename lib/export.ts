import type {
  ChatMessage,
  SuggestionBatch,
  TranscriptEntry,
} from "./types";

interface ExportPayload {
  exported_at: string;
  transcript: TranscriptEntry[];
  suggestion_batches: SuggestionBatch[];
  chat_history: ChatMessage[];
}

export function buildExportJson(args: {
  transcript: TranscriptEntry[];
  suggestionBatches: SuggestionBatch[];
  chatHistory: ChatMessage[];
}): ExportPayload {
  return {
    exported_at: new Date().toISOString(),
    transcript: args.transcript,
    suggestion_batches: [...args.suggestionBatches].reverse(),
    chat_history: args.chatHistory,
  };
}

export function downloadExport(payload: ExportPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `twinmind-session-${payload.exported_at.replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
