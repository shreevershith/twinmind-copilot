"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/session-context";
import { useSettings } from "@/lib/settings-context";
import { ChunkedRecorder } from "@/lib/recorder";
import { transcribeChunk } from "@/lib/groq-client";
import { MicButton } from "./MicButton";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function TranscriptColumn() {
  const { state, dispatch, flushRecorderRef } = useSession();
  const { settings, settingsRef } = useSettings();
  const recorderRef = useRef<ChunkedRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [starting, setStarting] = useState(false);

  const handleChunk = useCallback(
    async (blob: Blob, mimeType: string) => {
      const apiKey = settingsRef.current.apiKey;
      if (!apiKey) return;
      dispatch({ type: "setTranscribing", value: true });
      try {
        const { text, timestamp } = await transcribeChunk(
          apiKey,
          blob,
          mimeType,
        );
        if (text) {
          dispatch({ type: "addTranscript", entry: { text, timestamp } });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Transcription failed";
        dispatch({ type: "setError", message });
      } finally {
        dispatch({ type: "setTranscribing", value: false });
      }
    },
    [dispatch, settingsRef],
  );

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    flushRecorderRef.current = null;
    dispatch({ type: "setRecording", value: false });
  }, [dispatch, flushRecorderRef]);

  const start = useCallback(async () => {
    if (recorderRef.current || starting) return;
    setStarting(true);
    try {
      const recorder = new ChunkedRecorder(
        settingsRef.current.refreshIntervalSec,
        handleChunk,
        (err) => {
          const message =
            err instanceof Error ? err.message : "Recorder error";
          dispatch({ type: "setError", message });
        },
      );
      await recorder.start();
      recorderRef.current = recorder;
      flushRecorderRef.current = () => recorder.flush();
      dispatch({ type: "setRecording", value: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Microphone access denied";
      dispatch({ type: "setError", message });
    } finally {
      setStarting(false);
    }
  }, [dispatch, flushRecorderRef, handleChunk, settingsRef, starting]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      recorderRef.current = null;
      flushRecorderRef.current = null;
    };
  }, [flushRecorderRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.transcript.length, state.isTranscribing]);

  const onToggle = () => (state.isRecording ? stop() : start());

  return (
    <section className="flex h-full min-h-0 flex-col border-r border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 mb-3">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
          Transcript
        </h2>
        <MicButton
          recording={state.isRecording}
          onToggle={onToggle}
          disabled={starting}
        />
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {state.transcript.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Click start to record. Transcription arrives every{" "}
            {settings.refreshIntervalSec}s.
          </p>
        ) : (
          <ul className="space-y-4">
            {state.transcript.map((entry, i) => (
              <li key={i}>
                <div className="text-xs text-zinc-400 font-mono">
                  {formatTime(entry.timestamp)}
                </div>
                <p className="mt-1 text-sm text-zinc-800 leading-relaxed">
                  {entry.text}
                </p>
              </li>
            ))}
          </ul>
        )}
        {state.isTranscribing ? (
          <p className="mt-3 text-xs italic text-zinc-400">Transcribing…</p>
        ) : null}
      </div>
    </section>
  );
}
