"use client";

import { useEffect, useState } from "react";
import { SettingsProvider } from "@/lib/settings-context";
import { SessionProvider, useSession } from "@/lib/session-context";
import { ApiKeyGate } from "@/components/ApiKeyGate";
import { TranscriptColumn } from "@/components/TranscriptColumn";
import { SuggestionsColumn } from "@/components/SuggestionsColumn";
import { ChatColumn } from "@/components/ChatColumn";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ExportButton } from "@/components/ExportButton";

export default function Home() {
  return (
    <SettingsProvider>
      <SessionProvider>
        <ApiKeyGate>
          <AppShell />
        </ApiKeyGate>
      </SessionProvider>
    </SettingsProvider>
  );
}

function AppShell() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <h1 className="text-sm font-semibold text-zinc-900">
            TwinMind Live Suggestions
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton />
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Settings
          </button>
        </div>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-3">
        <TranscriptColumn />
        <SuggestionsColumn />
        <ChatColumn />
      </main>
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <ErrorToast />
    </div>
  );
}

function ErrorToast() {
  const { state, dispatch } = useSession();

  useEffect(() => {
    if (!state.errorToast) return;
    const t = setTimeout(() => {
      dispatch({ type: "setError", message: null });
    }, 5000);
    return () => clearTimeout(t);
  }, [state.errorToast, dispatch]);

  if (!state.errorToast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center">
      <div className="pointer-events-auto max-w-lg rounded-md bg-red-600 px-4 py-2 text-sm text-white shadow-lg">
        {state.errorToast}
      </div>
    </div>
  );
}
