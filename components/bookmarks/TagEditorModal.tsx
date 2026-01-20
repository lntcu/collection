"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, TagDefinition } from "@/lib/types";
import { formatTagLabel, getTagColorClasses } from "@/lib/utils";

interface TagEditorModalProps {
  open: boolean;
  bookmark: Bookmark | null;
  tags: TagDefinition[];
  tagColorMap: Record<string, string>;
  onClose: () => void;
  onSave: (bookmarkId: string, tags: string[]) => void;
}

function normalizeTag(input: string): string {
  const cleaned = input.replace(/^#+/, "").trim().toLowerCase();
  return cleaned.replace(/\s+/g, " ");
}

export default function TagEditorModal({
  open,
  bookmark,
  tags,
  tagColorMap,
  onClose,
  onSave,
}: TagEditorModalProps) {
  const [value, setValue] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const allTags = useMemo(() => tags.map((tag) => tag.name).sort(), [tags]);

  useEffect(() => {
    if (!open || !bookmark) return;
    setValue("");
    setSelectedTags(bookmark.tags ?? []);
    const timeout = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timeout);
  }, [open, bookmark?.id]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (
        e.key === "Backspace" &&
        document.activeElement === inputRef.current &&
        value.trim() === "" &&
        selectedTags.length > 0
      ) {
        e.preventDefault();
        setSelectedTags((prev) => prev.slice(0, -1));
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (!bookmark) return;
        const nextTag = getNextTag(value, selectedTags, allTags);
        if (nextTag) {
          setSelectedTags((prev) =>
            prev.includes(nextTag) ? prev : [...prev, nextTag],
          );
          setValue("");
          return;
        }
        onSave(bookmark.id, selectedTags);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, onSave, bookmark, value, selectedTags, allTags]);

  if (!open || !bookmark) return null;

  const suggestions = getSuggestions(value, selectedTags, allTags);
  const nextSuggestion = suggestions[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-5">
      <div
        className="absolute inset-0 bg-white/50 cursor-pointer"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-white/50 backdrop-blur-sm backdrop-saturate-150 border border-black/10 shadow-2xl">
        <div className="flex items-start justify-between gap-2 border-b border-black/10 px-2 py-1">
          <div className="min-w-0">
            <p className="text-xs font-medium">Tags</p>
          </div>
          <button
            onClick={onClose}
            className="text-xs cursor-pointer font-medium"
          >
            Close
          </button>
        </div>

        <div className="px-2 py-1 flex flex-col gap-1">
          <p className="text-xs truncate">{bookmark.title || bookmark.url}</p>
          <div className="w-full rounded-xl border border-black/5">
            <div className="flex flex-wrap gap-1 items-center p-1">
              {selectedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setSelectedTags((prev) => prev.filter((t) => t !== tag))
                  }
                  className={`hover:opacity-50 font-medium text-xs px-1.5 py-0.5 rounded-md cursor-pointer ${getTagColorClasses(
                    tag,
                    tagColorMap,
                  )}`}
                  title="Remove tag"
                >
                  {formatTagLabel(tag)}
                </button>
              ))}
              <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Type a tag and press Enter"
                className="text-xs font-medium flex-1 focus:outline-none"
              />
            </div>
            <div className="border-t border-black/5 p-1">
              {suggestions.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {suggestions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setSelectedTags((prev) =>
                          prev.includes(tag) ? prev : [...prev, tag],
                        )
                      }
                      className={`text-xs px-1.5 py-0.5 font-medium rounded-md cursor-pointer ${getTagColorClasses(
                        tag,
                        tagColorMap,
                      )}`}
                    >
                      {formatTagLabel(tag)}
                    </button>
                  ))}
                </div>
              ) : !value.trim() ? (
                <p className="text-xs text-black/50">No tags yet.</p>
              ) : nextSuggestion ? null : (
                <p className="text-xs text-black/50 font-medium px-0.5 py-0.5">
                  No matching tags. Press Enter to create "
                  {formatTagLabel(normalizeTag(value)) || "New tag"}".
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-2">
          <button
            onClick={onClose}
            className="px-3 py-1 font-medium w-full text-xs rounded-lg border border-black/10 bg-black/5 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(bookmark.id, selectedTags)}
            className="px-3 font-medium py-1 w-full text-xs rounded-lg bg-black border border-black text-white cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function getSuggestions(
  input: string,
  selectedTags: string[],
  allTags: string[],
): string[] {
  const normalized = normalizeTag(input);
  if (!normalized) return allTags.filter((tag) => !selectedTags.includes(tag));
  return allTags.filter(
    (tag) =>
      !selectedTags.includes(tag) && tag.toLowerCase().includes(normalized),
  );
}

function getNextTag(
  input: string,
  selectedTags: string[],
  allTags: string[],
): string | null {
  const normalized = normalizeTag(input);
  if (!normalized) return null;
  const suggestions = getSuggestions(normalized, selectedTags, allTags);
  return suggestions[0] ?? normalized;
}
