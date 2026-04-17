"use client";

interface MicButtonProps {
  recording: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function MicButton({ recording, onToggle, disabled }: MicButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors " +
        (recording
          ? "bg-red-600 text-white hover:bg-red-700"
          : "bg-zinc-900 text-white hover:bg-zinc-800") +
        " disabled:opacity-50 disabled:cursor-not-allowed"
      }
    >
      <span
        className={
          "inline-block h-2.5 w-2.5 rounded-full bg-red-500 " +
          (recording ? "animate-pulse" : "")
        }
      />
      {recording ? "Stop" : "Start recording"}
    </button>
  );
}
