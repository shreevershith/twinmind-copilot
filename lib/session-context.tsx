"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type {
  ChatMessage,
  SuggestionBatch,
  TranscriptEntry,
} from "./types";

type MutableRef<T> = { current: T };

interface SessionState {
  transcript: TranscriptEntry[];
  suggestionBatches: SuggestionBatch[];
  chatHistory: ChatMessage[];
  isRecording: boolean;
  isTranscribing: boolean;
  isGeneratingSuggestions: boolean;
  isChatting: boolean;
  errorToast: string | null;
}

type Action =
  | { type: "addTranscript"; entry: TranscriptEntry }
  | { type: "setRecording"; value: boolean }
  | { type: "setTranscribing"; value: boolean }
  | { type: "setGeneratingSuggestions"; value: boolean }
  | { type: "setChatting"; value: boolean }
  | { type: "prependBatch"; batch: SuggestionBatch }
  | { type: "addChatMessage"; message: ChatMessage }
  | { type: "appendToLastAssistant"; delta: string }
  | { type: "setError"; message: string | null }
  | { type: "reset" };

const initialState: SessionState = {
  transcript: [],
  suggestionBatches: [],
  chatHistory: [],
  isRecording: false,
  isTranscribing: false,
  isGeneratingSuggestions: false,
  isChatting: false,
  errorToast: null,
};

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case "addTranscript":
      return { ...state, transcript: [...state.transcript, action.entry] };
    case "setRecording":
      return { ...state, isRecording: action.value };
    case "setTranscribing":
      return { ...state, isTranscribing: action.value };
    case "setGeneratingSuggestions":
      return { ...state, isGeneratingSuggestions: action.value };
    case "setChatting":
      return { ...state, isChatting: action.value };
    case "prependBatch":
      return {
        ...state,
        suggestionBatches: [action.batch, ...state.suggestionBatches],
      };
    case "addChatMessage":
      return { ...state, chatHistory: [...state.chatHistory, action.message] };
    case "appendToLastAssistant": {
      const history = state.chatHistory;
      if (history.length === 0) return state;
      const last = history[history.length - 1];
      if (last.role !== "assistant") return state;
      const updated: ChatMessage = {
        ...last,
        content: last.content + action.delta,
      };
      return { ...state, chatHistory: [...history.slice(0, -1), updated] };
    }
    case "setError":
      return { ...state, errorToast: action.message };
    case "reset":
      return initialState;
    default:
      return state;
  }
}

export interface SessionContextValue {
  state: SessionState;
  stateRef: MutableRef<SessionState>;
  dispatch: React.Dispatch<Action>;
  joinedTranscript: () => string;
  /**
   * Set by TranscriptColumn when the recorder is active. Called by the
   * Refresh button in SuggestionsColumn to force-flush the current audio
   * buffer and wait for the resulting transcription before re-running
   * suggestion generation.
   */
  flushRecorderRef: MutableRef<(() => Promise<void>) | null>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef<SessionState>(initialState);
  stateRef.current = state;
  const flushRecorderRef = useRef<(() => Promise<void>) | null>(null);

  const joinedTranscript = useCallback(() => {
    return stateRef.current.transcript.map((t) => t.text).join(" ").trim();
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ state, stateRef, dispatch, joinedTranscript, flushRecorderRef }),
    [state, joinedTranscript],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
