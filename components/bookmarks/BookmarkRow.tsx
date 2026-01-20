"use client";

import {
  memo,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { Bookmark } from "@/lib/types";
import {
  formatTagLabel,
  getDomainFromUrl,
  getTagColorClasses,
} from "@/lib/utils";
import Image from "next/image";

interface BookmarkRowProps {
  bookmark: Bookmark;
  onOpen: () => void;
  onDelete: () => void;
  onEditTags: () => void;
  onFilterTag: (tag: string) => void;
  onRenameTitle: (bookmarkId: string, title: string) => void;
  tagColorMap: Record<string, string>;
  collectionColor?: string;
  isSelected?: boolean;
  isDeleting?: boolean;
  onSelect?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onDragStart?: (bookmarkId: string) => void;
  onDragEnd?: () => void;
}

const BookmarkRow = memo(function BookmarkRow({
  bookmark,
  onOpen,
  onDelete,
  onEditTags,
  onFilterTag,
  onRenameTitle,
  tagColorMap,
  collectionColor,
  isSelected = false,
  isDeleting = false,
  onSelect,
  onDragStart,
  onDragEnd,
}: BookmarkRowProps) {
  const [iconFailed, setIconFailed] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(bookmark.title || bookmark.url);
  const domain = useMemo(() => getDomainFromUrl(bookmark.url), [bookmark.url]);
  const fallback = useMemo(
    () => (bookmark.title || domain || "Link").charAt(0).toUpperCase(),
    [bookmark.title, domain],
  );
  const formattedDate = useMemo(() => {
    if (!bookmark.createdAt) return "";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).format(new Date(bookmark.createdAt));
  }, [bookmark.createdAt]);

  const truncatedTitle = useMemo(() => {
    const title = bookmark.title || bookmark.url;
    if (title.length > 50) {
      return title.substring(0, 50) + "...";
    }
    return title;
  }, [bookmark.title, bookmark.url]);
  const tags = bookmark.tags ?? [];

  useEffect(() => {
    setIconFailed(false);
  }, [bookmark.icon]);

  useEffect(() => {
    if (!isEditingTitle) {
      setDraftTitle(bookmark.title || bookmark.url);
    }
  }, [bookmark.title, bookmark.url, isEditingTitle]);

  const commitTitle = () => {
    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      setDraftTitle(bookmark.title || bookmark.url);
      setIsEditingTitle(false);
      return;
    }
    if (nextTitle !== (bookmark.title || bookmark.url)) {
      onRenameTitle(bookmark.id, nextTitle);
    }
    setIsEditingTitle(false);
  };

  return (
    <div
      className={`group flex items-center gap-4 px-2 py-1 transition-all ${
        isDeleting
          ? "opacity-50 pointer-events-none"
          : `cursor-pointer transition-colors ${isSelected ? "bg-black/2" : ""}`
      }`}
      onClick={onSelect}
      draggable={!isDeleting}
      onDragStart={(event: DragEvent<HTMLDivElement>) => {
        if (isDeleting) return;
        event.dataTransfer?.setData("text/plain", bookmark.id);
        event.dataTransfer?.setData("application/bookmark-id", bookmark.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart?.(bookmark.id);
      }}
      onDragEnd={() => {
        onDragEnd?.();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      {collectionColor && (
        <span
          className={`w-1 self-stretch rounded-full ${collectionColor}`}
          aria-hidden
        />
      )}
      <div className="flex items-center justify-between gap-3 flex-1 min-w-0">
        <div className="flex items-center justify-start gap-3">
          {bookmark.icon && !iconFailed ? (
            <div className="relative w-5 h-5">
              <Image
                src={bookmark.icon}
                alt=""
                className="w-5 h-5 object-contain rounded-sm"
                width={20}
                height={20}
                onError={() => setIconFailed(true)}
              />
            </div>
          ) : bookmark.icon ? (
            <div className="w-5 h-5 rounded-md bg-yellow-300" aria-hidden />
          ) : (
            <span className="text-xs font-semibold opacity-80 w-5 h-5 rounded-md bg-yellow-300 p-1">
              {fallback}
            </span>
          )}
          <div className="flex-none min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              {isEditingTitle ? (
                <input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onBlur={commitTitle}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      commitTitle();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setDraftTitle(bookmark.title || bookmark.url);
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                  className="text-xs font-medium truncate min-w-0 flex-1 rounded-md focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsEditingTitle(true);
                  }}
                  className="text-xs font-medium truncate min-w-0 flex-1 text-left"
                  title="Double-click to rename"
                >
                  {truncatedTitle}
                </button>
              )}
              <div className="text-xs text-black/50 truncate min-w-0 shrink-0">
                {domain || bookmark.url}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {tags.length > 0 && (
            <div className="flex items-center gap-1">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onFilterTag(tag);
                  }}
                  className={`text-xs px-1.5 font-medium rounded-md cursor-pointer ${getTagColorClasses(
                    tag,
                    tagColorMap,
                  )}`}
                >
                  {formatTagLabel(tag)}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onEditTags();
            }}
            className={`text-xs font-medium cursor-pointer ${
              isSelected ? "block" : "hidden"
            }`}
          >
            {tags.length > 0 ? "Edit tags" : "Add tags"}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-end w-20">
        <div className="text-right relative">
          <span
            className={`text-xs ${
              isSelected || isDeleting ? "hidden" : "block"
            }`}
          >
            {formattedDate}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={isDeleting}
            className={` text-xs rounded-md  text-red-500 cursor-pointer font-medium flex items-center justify-center ${
              isDeleting
                ? "block cursor-not-allowed"
                : isSelected
                  ? "block"
                  : "hidden"
            }`}
          >
            {isDeleting ? (
              <div className="w-3 h-3 border-2 border-red-500/50 border-t-red-500 rounded-full animate-spin" />
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

export default BookmarkRow;
