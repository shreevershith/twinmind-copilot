"use client";

import { useCallback, useRef } from "react";
import { streamChat } from "@/lib/groq-client";
import { useSession } from "@/lib/session-context";
import { useSettings } from "@/lib/settings-context";

export function useChatSend() {
  const { dispatch, stateRef, joinedTranscript } = useSession();
  const { settingsRef } = useSettings();
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const send = useCallback(
    async (
      question: string,
      opts?: { kind?: "chat" | "detail" },
    ): Promise<void> => {
      const trimmed = question.trim();
      if (!trimmed) return;
      if (stateRef.current.isChatting) return;

      const settings = settingsRef.current;
      if (!settings.apiKey) {
        dispatch({ type: "setError", message: "Set your Groq API key first." });
        return;
      }

      const kind = opts?.kind ?? "chat";
      const systemPrompt =
        kind === "detail" ? settings.detailAnswerPrompt : settings.chatPrompt;
      const contextChars =
        kind === "detail"
          ? settings.detailContextChars
          : settings.chatContextChars;

      dispatch({
        type: "addChatMessage",
        message: {
          timestamp: new Date().toISOString(),
          role: "user",
          content: trimmed,
        },
      });
      dispatch({
        type: "addChatMessage",
        message: {
          timestamp: new Date().toISOString(),
          role: "assistant",
          content: "",
        },
      });
      dispatch({ type: "setChatting", value: true });

      const priorHistory = stateRef.current.chatHistory.slice(0, -2);
      const full = joinedTranscript();
      const transcript =
        contextChars > 0 ? full.slice(-contextChars) : full;

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const iter = streamChat(
          settings.apiKey,
          {
            transcript,
            chatHistory: priorHistory,
            question: trimmed,
            systemPrompt,
            model: settings.llmModel,
          },
          controller.signal,
        );
        for await (const delta of iter) {
          dispatch({ type: "appendToLastAssistant", delta });
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Chat failed";
        dispatch({ type: "appendToLastAssistant", delta: `\n[error: ${message}]` });
        dispatch({ type: "setError", message });
      } finally {
        dispatch({ type: "setChatting", value: false });
        abortRef.current = null;
      }
    },
    [dispatch, joinedTranscript, settingsRef, stateRef],
  );

  return { send, cancel };
}
