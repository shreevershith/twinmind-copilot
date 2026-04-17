"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSession } from "@/lib/session-context";
import { useSettings } from "@/lib/settings-context";
import { fetchSuggestions } from "@/lib/groq-client";
import { SuggestionCard } from "./SuggestionCard";
import { useChatSend } from "./use-chat-send";
import type { Suggestion } from "@/lib/types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function SuggestionsColumn() {
  const { state, dispatch, joinedTranscript, flushRecorderRef } = useSession();
  const { settings, settingsRef } = useSettings();
  const { send } = useChatSend();
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    const settings = settingsRef.current;
    if (!settings.apiKey) {
      dispatch({ type: "setError", message: "Set your Groq API key first." });
      return;
    }
    const full = joinedTranscript();
    if (!full.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const sliced = full.slice(-settings.suggestionContextChars);

    dispatch({ type: "setGeneratingSuggestions", value: true });
    try {
      const { suggestions, timestamp } = await fetchSuggestions(
        settings.apiKey,
        {
          transcript: sliced,
          prompt: settings.suggestionPrompt,
          model: settings.llmModel,
        },
        controller.signal,
      );
      dispatch({
        type: "prependBatch",
        batch: { timestamp, suggestions },
      });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      const message =
        err instanceof Error ? err.message : "Failed to generate suggestions";
      dispatch({ type: "setError", message });
    } finally {
      dispatch({ type: "setGeneratingSuggestions", value: false });
    }
  }, [dispatch, joinedTranscript, settingsRef]);

  useEffect(() => {
    if (!state.isRecording) return;
    const intervalMs = Math.max(5, settings.refreshIntervalSec) * 1000;
    const timer = setInterval(() => {
      void run();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [state.isRecording, run, settings.refreshIntervalSec]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const onCardClick = (s: Suggestion) => {
    void send(s.preview, { kind: "detail" });
  };

  const onManualRefresh = useCallback(async () => {
    // Per assignment: "A refresh button which manually updates transcript
    // then suggestions if tapped." If recording, force-flush the current
    // audio buffer and wait for transcription to complete before running
    // suggestion generation, so the batch reflects the latest speech.
    if (state.isRecording && flushRecorderRef.current) {
      try {
        await flushRecorderRef.current();
      } catch {
        // ignore, run() will still execute with whatever transcript exists
      }
    }
    await run();
  }, [state.isRecording, flushRecorderRef, run]);

  return (
    <section className="flex h-full min-h-0 flex-col border-r border-zinc-200 bg-zinc-50">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 mb-3">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
          Live suggestions
        </h2>
        <button
          type="button"
          onClick={() => void onManualRefresh()}
          disabled={state.isGeneratingSuggestions}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
        >
          {state.isGeneratingSuggestions ? "Thinking…" : "Refresh"}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {state.suggestionBatches.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Start recording to see live suggestions here. Three new cards every{" "}
            {settings.refreshIntervalSec}s, newest on top.
          </p>
        ) : (
          <ul className="space-y-5">
            {state.suggestionBatches.map((batch, i) => (
              <li key={`${batch.timestamp}-${i}`}>
                <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-zinc-500">
                  <span className="font-mono">
                    {formatTime(batch.timestamp)}
                  </span>
                  {i === 0 ? (
                    <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Latest
                    </span>
                  ) : null}
                </div>
                <div className="space-y-2">
                  {batch.suggestions.map((s, j) => (
                    <SuggestionCard
                      key={j}
                      suggestion={s}
                      onClick={onCardClick}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
