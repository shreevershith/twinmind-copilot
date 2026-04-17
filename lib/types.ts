export type SuggestionType =
  | "QUESTION"
  | "TALKING_POINT"
  | "ANSWER"
  | "FACT_CHECK"
  | "CLARIFY"
  | "ERROR";

export interface Suggestion {
  type: SuggestionType;
  preview: string;
  detail: string;
}

export interface SuggestionBatch {
  timestamp: string;
  suggestions: Suggestion[];
}

export interface TranscriptEntry {
  timestamp: string;
  text: string;
}

export interface ChatMessage {
  timestamp: string;
  role: "user" | "assistant";
  content: string;
}

export interface Settings {
  apiKey: string;
  suggestionPrompt: string;
  detailAnswerPrompt: string;
  chatPrompt: string;
  suggestionContextChars: number;
  detailContextChars: number;
  chatContextChars: number;
  refreshIntervalSec: number;
  llmModel: string;
}
