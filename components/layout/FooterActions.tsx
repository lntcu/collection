"use client";

interface FooterActionsProps {
  onShowShortcuts: () => void;
  onShowSettings: () => void;
}

export default function FooterActions({
  onShowShortcuts,
  onShowSettings,
}: FooterActionsProps) {
  return (
    <div className="fixed bottom-0 right-0 p-5 flex gap-2 z-40">
      <button
        onClick={onShowShortcuts}
        className="text-xs not-hover:text-black/50 cursor-pointer transition"
      >
        Help
      </button>
      <button
        onClick={onShowSettings}
        className="text-xs not-hover:text-black/50 cursor-pointer transition"
      >
        Settings
      </button>
    </div>
  );
}
