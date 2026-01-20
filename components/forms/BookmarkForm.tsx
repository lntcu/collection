"use client";

import { forwardRef, type KeyboardEvent } from "react";

interface BookmarkFormProps {
  inputValue: string;
  status: string;
  loading: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onPasteLink: (value: string) => boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

const BookmarkForm = forwardRef<HTMLInputElement, BookmarkFormProps>(
  (
    {
      inputValue,
      status,
      loading,
      onInputChange,
      onSubmit,
      onPasteLink,
      onFocus,
      onBlur,
      onKeyDown,
    },
    ref,
  ) => {
    return (
      <form
        onSubmit={onSubmit}
        className="w-full rounded-xl border border-black/10 sticky top-10 z-20 bg-white/50 backdrop-blur-sm backdrop-saturate-150 shadow-lg"
      >
        <div className="flex items-center gap-3 pl-2 pr-1 py-1">
          <input
            ref={ref}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (onPasteLink(text)) {
                e.preventDefault();
              }
            }}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            placeholder="Search or paste a link"
            className="flex-1 text-xs font-medium placeholder:text-black/50 focus:outline-none disabled:opacity-50"
            autoFocus
            autoComplete="off"
            disabled={loading}
          />
          <div className="flex items-center gap-1">
            {loading && (
              <div className="w-4 h-4 border border-black/30 border-t-black rounded-full animate-spin" />
            )}
          </div>
        </div>
        {status && (
          <div className="px-2 py-1 text-xs font-medium border-t border-black/10">
            {status}
          </div>
        )}
      </form>
    );
  },
);

BookmarkForm.displayName = "BookmarkForm";

export default BookmarkForm;
