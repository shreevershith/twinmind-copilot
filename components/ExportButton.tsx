"use client";

import { useSession } from "@/lib/session-context";
import { buildExportJson, downloadExport } from "@/lib/export";

export function ExportButton() {
  const { stateRef } = useSession();

  return (
    <button
      type="button"
      onClick={() => {
        const s = stateRef.current;
        const payload = buildExportJson({
          transcript: s.transcript,
          suggestionBatches: s.suggestionBatches,
          chatHistory: s.chatHistory,
        });
        downloadExport(payload);
      }}
      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
    >
      Export JSON
    </button>
  );
}
