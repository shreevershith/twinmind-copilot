"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/lib/settings-context";
import {
  DEFAULT_CHAT_PROMPT,
  DEFAULT_DETAIL_ANSWER_PROMPT,
  DEFAULT_SUGGESTION_PROMPT,
} from "@/lib/prompts";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: Props) {
  const { settings, updateSettings } = useSettings();

  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  if (!open) return null;

  const save = () => {
    updateSettings({
      apiKey: draft.apiKey.trim(),
      suggestionPrompt: draft.suggestionPrompt,
      detailAnswerPrompt: draft.detailAnswerPrompt,
      chatPrompt: draft.chatPrompt,
      suggestionContextChars: Math.max(
        200,
        Number(draft.suggestionContextChars) || 3200,
      ),
      detailContextChars: Math.max(0, Number(draft.detailContextChars) || 0),
      chatContextChars: Math.max(0, Number(draft.chatContextChars) || 0),
      refreshIntervalSec: Math.max(
        5,
        Number(draft.refreshIntervalSec) || 30,
      ),
      llmModel: draft.llmModel.trim() || "openai/gpt-oss-120b",
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/30"
      onClick={onClose}
    >
      <aside
        className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <h2 className="text-base font-semibold text-zinc-900">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 px-5 py-5 text-sm">
          <Field label="Groq API key" hint="Stored in localStorage only.">
            <input
              type="password"
              value={draft.apiKey}
              onChange={(e) =>
                setDraft((d) => ({ ...d, apiKey: e.target.value }))
              }
              placeholder="gsk_..."
              className="w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900"
            />
          </Field>

          <Field label="LLM model">
            <input
              type="text"
              value={draft.llmModel}
              onChange={(e) =>
                setDraft((d) => ({ ...d, llmModel: e.target.value }))
              }
              className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs outline-none focus:border-zinc-900"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Refresh (sec)">
              <input
                type="number"
                min={5}
                value={draft.refreshIntervalSec}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    refreshIntervalSec: Number(e.target.value),
                  }))
                }
                className="w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900"
              />
            </Field>
            <Field label="Suggest ctx (chars)">
              <input
                type="number"
                min={200}
                value={draft.suggestionContextChars}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    suggestionContextChars: Number(e.target.value),
                  }))
                }
                className="w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900"
              />
            </Field>
            <Field label="Detail ctx (0=full)">
              <input
                type="number"
                min={0}
                value={draft.detailContextChars}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    detailContextChars: Number(e.target.value),
                  }))
                }
                className="w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900"
              />
            </Field>
            <Field label="Chat ctx (0=full)">
              <input
                type="number"
                min={0}
                value={draft.chatContextChars}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    chatContextChars: Number(e.target.value),
                  }))
                }
                className="w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-zinc-900"
              />
            </Field>
          </div>

          <Field
            label="Suggestion prompt"
            trailing={
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    suggestionPrompt: DEFAULT_SUGGESTION_PROMPT,
                  }))
                }
                className="text-xs text-zinc-500 underline"
              >
                Reset to default
              </button>
            }
          >
            <textarea
              value={draft.suggestionPrompt}
              onChange={(e) =>
                setDraft((d) => ({ ...d, suggestionPrompt: e.target.value }))
              }
              rows={12}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs outline-none focus:border-zinc-900"
            />
          </Field>

          <Field
            label="Detailed-answer prompt (on card click)"
            hint="Used when the user taps a suggestion card. Longer-form expansion."
            trailing={
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    detailAnswerPrompt: DEFAULT_DETAIL_ANSWER_PROMPT,
                  }))
                }
                className="text-xs text-zinc-500 underline"
              >
                Reset to default
              </button>
            }
          >
            <textarea
              value={draft.detailAnswerPrompt}
              onChange={(e) =>
                setDraft((d) => ({ ...d, detailAnswerPrompt: e.target.value }))
              }
              rows={10}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs outline-none focus:border-zinc-900"
            />
          </Field>

          <Field
            label="Chat system prompt (freeform questions)"
            hint="Used when the user types their own question in the chat box."
            trailing={
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({ ...d, chatPrompt: DEFAULT_CHAT_PROMPT }))
                }
                className="text-xs text-zinc-500 underline"
              >
                Reset to default
              </button>
            }
          >
            <textarea
              value={draft.chatPrompt}
              onChange={(e) =>
                setDraft((d) => ({ ...d, chatPrompt: e.target.value }))
              }
              rows={8}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs outline-none focus:border-zinc-900"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Save
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Field({
  label,
  hint,
  trailing,
  children,
}: {
  label: string;
  hint?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-600">
          {label}
        </span>
        {trailing}
      </div>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1 text-[11px] text-zinc-500">{hint}</p> : null}
    </label>
  );
}
