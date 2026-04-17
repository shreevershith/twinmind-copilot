"use client";

import { useState } from "react";
import { useSettings } from "@/lib/settings-context";

export function ApiKeyGate({ children }: { children: React.ReactNode }) {
  const { settings, ready, updateSettings } = useSettings();
  const [value, setValue] = useState("");

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  if (settings.apiKey) return <>{children}</>;

  return (
    <div className="flex items-center justify-center h-screen bg-zinc-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">
          TwinMind Live Suggestions
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Paste your Groq API key to get started. It&apos;s stored in your
          browser only. We never send it anywhere but to Groq.
        </p>
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = value.trim();
            if (trimmed) updateSettings({ apiKey: trimmed });
          }}
        >
          <input
            type="password"
            autoFocus
            placeholder="gsk_..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
          <button
            type="submit"
            disabled={!value.trim()}
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
          >
            Save and continue
          </button>
        </form>
        <p className="mt-4 text-xs text-zinc-500">
          Get a key at{" "}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            console.groq.com/keys
          </a>
          .
        </p>
      </div>
    </div>
  );
}
