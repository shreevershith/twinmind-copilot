"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Settings } from "./types";
import {
  DEFAULT_CHAT_PROMPT,
  DEFAULT_DETAIL_ANSWER_PROMPT,
  DEFAULT_SUGGESTION_PROMPT,
} from "./prompts";

type MutableRef<T> = { current: T };

const STORAGE_KEY = "twinmind.settings.v1";

// Bump when DEFAULT_SUGGESTION_PROMPT / DEFAULT_DETAIL_ANSWER_PROMPT /
// DEFAULT_CHAT_PROMPT change in a way that saved-prompt copies would
// contradict. On load, stored settings with an older promptVersion have their
// prompt fields reset to the current defaults; apiKey and numeric settings
// are preserved so users don't have to re-paste their key on every update.
const CURRENT_PROMPT_VERSION = 2;

type StoredSettings = Settings & { promptVersion?: number };

export const DEFAULT_SETTINGS: Settings = {
  apiKey: "",
  suggestionPrompt: DEFAULT_SUGGESTION_PROMPT,
  detailAnswerPrompt: DEFAULT_DETAIL_ANSWER_PROMPT,
  chatPrompt: DEFAULT_CHAT_PROMPT,
  suggestionContextChars: 3200,
  detailContextChars: 0,
  chatContextChars: 0,
  refreshIntervalSec: 30,
  llmModel: "openai/gpt-oss-120b",
};

interface SettingsContextValue {
  settings: Settings;
  ready: boolean;
  updateSettings: (patch: Partial<Settings>) => void;
  settingsRef: MutableRef<Settings>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function loadFromStorage(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;

    if (parsed.promptVersion !== CURRENT_PROMPT_VERSION) {
      // Old or missing version: pick up non-prompt user preferences,
      // but force the three prompts back to current defaults so code-level
      // prompt improvements actually reach the user.
      return {
        ...DEFAULT_SETTINGS,
        apiKey: parsed.apiKey ?? "",
        llmModel: parsed.llmModel ?? DEFAULT_SETTINGS.llmModel,
        refreshIntervalSec:
          parsed.refreshIntervalSec ?? DEFAULT_SETTINGS.refreshIntervalSec,
        suggestionContextChars:
          parsed.suggestionContextChars ??
          DEFAULT_SETTINGS.suggestionContextChars,
        detailContextChars:
          parsed.detailContextChars ?? DEFAULT_SETTINGS.detailContextChars,
        chatContextChars:
          parsed.chatContextChars ?? DEFAULT_SETTINGS.chatContextChars,
      };
    }

    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const loaded = loadFromStorage();
    setSettings(loaded);
    settingsRef.current = loaded;
    setReady(true);
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      settingsRef.current = next;
      try {
        const stored: StoredSettings = {
          ...next,
          promptVersion: CURRENT_PROMPT_VERSION,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      } catch {
        // ignore quota / privacy-mode failures
      }
      return next;
    });
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, ready, updateSettings, settingsRef }),
    [settings, ready, updateSettings],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
