"use client";

import { useEffect } from "react";
interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShortcutsHelp({ isOpen, onClose }: ShortcutsHelpProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-5">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-white/50 cursor-pointer"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white/50 backdrop-blur-sm backdrop-saturate-150 rounded-2xl shadow-2xl w-full max-w-md border border-black/10">
        {/* Header */}
        <div
          className={`flex items-center justify-between px-2 py-1 border-b border-black/10`}
        >
          <p className="text-xs font-medium">Keyboard Shortcuts</p>
          <button
            onClick={onClose}
            className="text-xs cursor-pointer font-medium"
          >
            <p>Close</p>
          </button>
        </div>

        {/* Content */}
        <div className="p-2">
          <div className="flex flex-col items-start gap-2 w-full">
            <ShortcutSection
              title="General"
              shortcuts={[
                { keys: ["⌘", "K"], description: "Add new bookmark" },
                { keys: ["/"], description: "Focus search" },
                {
                  keys: ["⌘", "Z"],
                  description: "Undo last action (Ctrl+Z on Windows)",
                },
                { keys: [","], description: "Open settings" },
                { keys: ["?"], description: "Show/hide shortcuts" },
                { keys: ["Esc"], description: "Close dialog or clear focus" },
              ]}
            />

            <ShortcutSection
              title="Navigation"
              shortcuts={[
                { keys: ["↑", "↓"], description: "Navigate bookmarks" },
                { keys: ["↑"], description: "Focus search from top item" },
                {
                  keys: ["1", "–", "9"],
                  description: "Switch to collection 1-9",
                },
                { keys: ["Enter"], description: "Open selected bookmark" },
                { keys: ["Tab"], description: "Move focus forward" },
                { keys: ["Shift", "Tab"], description: "Move focus backward" },
              ]}
            />

            <ShortcutSection
              title="Actions"
              shortcuts={[
                { keys: ["E"], description: "Edit tags of selected bookmark" },
                { keys: ["Delete"], description: "Delete selected bookmark" },
                {
                  keys: ["Backspace"],
                  description: "Delete selected bookmark",
                },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortcutSection({
  title,
  shortcuts,
}: {
  title: string;
  shortcuts: Array<{ keys: string[]; description: string }>;
}) {
  return (
    <div className="w-full">
      <p className="text-xs font-medium uppercase text-black/50 w-full border-b border-black/10 mb-1">
        {title}
      </p>
      <div className="flex flex-col gap-1">
        {shortcuts.map((shortcut, index) => (
          <div key={index} className="flex items-center justify-between">
            <span className="text-xs">{shortcut.description}</span>
            <div className="flex items-center gap-0.5">
              {shortcut.keys.map((key, keyIndex) => (
                <kbd
                  key={keyIndex}
                  className="px-1 bg-black/5 rounded-sm text-xs font-mono"
                >
                  {key}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
