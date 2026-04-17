"use client";

import type { Suggestion, SuggestionType } from "@/lib/types";

const BADGE_STYLES: Record<SuggestionType, string> = {
  QUESTION: "bg-blue-100 text-blue-700",
  TALKING_POINT: "bg-indigo-100 text-indigo-700",
  ANSWER: "bg-green-100 text-green-700",
  FACT_CHECK: "bg-amber-100 text-amber-700",
  CLARIFY: "bg-purple-100 text-purple-700",
  ERROR: "bg-zinc-100 text-zinc-700",
};

const BORDER_STYLES: Record<SuggestionType, string> = {
  QUESTION: "border-l-4 border-blue-400",
  TALKING_POINT: "border-l-4 border-indigo-400",
  ANSWER: "border-l-4 border-green-400",
  FACT_CHECK: "border-l-4 border-amber-400",
  CLARIFY: "border-l-4 border-purple-400",
  ERROR: "border-l-4 border-zinc-300",
};

interface Props {
  suggestion: Suggestion;
  onClick?: (s: Suggestion) => void;
}

export function SuggestionCard({ suggestion, onClick }: Props) {
  const badgeClass = BADGE_STYLES[suggestion.type] ?? BADGE_STYLES.TALKING_POINT;
  const borderClass =
    BORDER_STYLES[suggestion.type] ?? BORDER_STYLES.TALKING_POINT;
  const clickable = Boolean(onClick) && suggestion.type !== "ERROR";

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => onClick?.(suggestion)}
      className={
        "w-full rounded-lg border border-zinc-200 bg-white p-3 text-left " +
        borderClass +
        " hover:shadow-md hover:border-zinc-300 transition-all duration-150 cursor-pointer " +
        (clickable ? "" : "cursor-default opacity-90")
      }
    >
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}
      >
        {suggestion.type.replace("_", " ")}
      </span>
      <p className="mt-2 text-sm text-zinc-900 leading-snug">
        {suggestion.preview}
      </p>
    </button>
  );
}
