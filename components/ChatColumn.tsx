"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/session-context";
import { useChatSend } from "./use-chat-send";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatColumn() {
  const { state } = useSession();
  const { send, cancel } = useChatSend();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.chatHistory]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || state.isChatting) return;
    setDraft("");
    void send(text);
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 mb-3">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
          Chat
        </h2>
        {state.isChatting ? (
          <button
            type="button"
            onClick={cancel}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Stop
          </button>
        ) : null}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {state.chatHistory.length === 0 ? (
          <p className="text-sm text-zinc-400">
            Click a suggestion card, or ask your own question below.
          </p>
        ) : (
          <ul className="space-y-4">
            {state.chatHistory.map((m, i) => {
              const isUser = m.role === "user";
              return (
                <li key={i}>
                  <div
                    className={
                      "text-xs text-zinc-400 mb-1 " +
                      (isUser ? "text-right" : "text-left")
                    }
                  >
                    {isUser ? "YOU" : "ASSISTANT"}
                    <span className="ml-1 font-mono text-zinc-400">
                      · {formatTime(m.timestamp)}
                    </span>
                  </div>
                  <div
                    className={
                      "flex " +
                      (isUser ? "justify-end" : "justify-start")
                    }
                  >
                    <div
                      className={
                        "whitespace-pre-wrap px-4 py-2 max-w-[80%] text-sm leading-relaxed " +
                        (isUser
                          ? "bg-blue-600 text-white rounded-2xl rounded-tr-sm ml-auto"
                          : "bg-zinc-100 text-zinc-900 rounded-2xl rounded-tl-sm")
                      }
                    >
                      {m.content || (
                        <span className="italic opacity-60">…</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <form
        onSubmit={submit}
        className="border-t border-zinc-200 bg-white px-4 py-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
            rows={2}
            placeholder="Ask anything about the conversation…"
            className="flex-1 resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
          />
          <button
            type="submit"
            disabled={!draft.trim() || state.isChatting}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
