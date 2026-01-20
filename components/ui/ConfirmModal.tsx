"use client";

import { useEffect, useRef } from "react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    confirmButtonRef.current?.focus();

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-5">
      <div
        className="absolute inset-0 bg-white/50 cursor-pointer"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-xs rounded-2xl bg-white/50 backdrop-saturate-150 border border-black/10 backdrop-blur-sm p-2 shadow-2xl">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <h3 className="text-xs font-medium">{title}</h3>
            {description && (
              <p className="text-xs text-black/50">{description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={onCancel}
            className="px-2 py-1 font-medium w-full text-xs rounded-lg border border-black/10 bg-black/5 transition cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className="px-2 py-1 w-full font-medium text-xs rounded-lg bg-black border border-black text-white cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
