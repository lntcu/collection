"use client";

import { memo } from "react";
import { Bookmark } from "@/lib/types";
import BookmarkRow from "./BookmarkRow";

interface BookmarksListProps {
  bookmarks: Bookmark[];
  allBookmarks: Bookmark[];
  selectedBookmarkIndex: number;
  hoveredBookmarkIndex: number;
  deletingBookmarkIds?: Set<string>;
  loadingCollection?: boolean;
  newlyImportedIds?: Set<string>;
  onOpenBookmark: (bookmark: Bookmark) => void;
  onDeleteBookmark: (id: string) => void;
  onEditTags: (bookmark: Bookmark) => void;
  onFilterTag: (tag: string) => void;
  onRenameTitle: (bookmarkId: string, title: string) => void;
  tagColorMap: Record<string, string>;
  isInputFocused: boolean;
  collectionColorMap: Record<string, string>;
  activeCollectionId: string;
  onSelectBookmarkIndex: (index: number) => void;
  onSelectBookmark: (index: number) => void;
  onHoverBookmark: (index: number) => void;
  onClearHover: () => void;
  onStartDragBookmark: (bookmarkId: string) => void;
  onEndDragBookmark: () => void;
}

const BookmarksList = memo(function BookmarksList({
  bookmarks,
  allBookmarks,
  selectedBookmarkIndex,
  hoveredBookmarkIndex,
  deletingBookmarkIds = new Set(),
  loadingCollection = false,
  newlyImportedIds = new Set(),
  onOpenBookmark,
  onDeleteBookmark,
  onEditTags,
  onFilterTag,
  onRenameTitle,
  tagColorMap,
  isInputFocused,
  collectionColorMap,
  activeCollectionId,
  onSelectBookmarkIndex,
  onSelectBookmark,
  onHoverBookmark,
  onClearHover,
  onStartDragBookmark,
  onEndDragBookmark,
}: BookmarksListProps) {
  const showEmptyState = !loadingCollection && allBookmarks.length === 0;
  const showLoadingState = loadingCollection && bookmarks.length === 0;

  return (
    <div className="w-full rounded-2xl border border-black/10 overflow-hidden">
      <div className="flex items-center justify-between p-2 text-xs uppercase text-black/50">
        <span className="flex-1">Title</span>
        <div className="flex items-center gap-3">
          <span className="w-28 text-right">Created at</span>
        </div>
      </div>

      {showEmptyState ? (
        <div className="p-3 pt-10">
          <p className="text-xs font-medium text-black/50">No links yet.</p>
          <p className="text-xs text-black/50">
            Paste a link above or type to search.
          </p>
        </div>
      ) : showLoadingState ? (
        <div className="p-3 pt-10 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="divide-y divide-black/5">
          {bookmarks
            .filter((bookmark) => bookmark && bookmark.id)
            .map((bookmark, visibleIndex) => {
              // Find the index in allBookmarks to match with selectedBookmarkIndex
              const allBookmarksIndex = allBookmarks.findIndex(
                (b) => b && b.id === bookmark.id,
              );
              const isFocused =
                allBookmarksIndex >= 0 &&
                allBookmarksIndex === selectedBookmarkIndex;
              const isSelected = isFocused;
              const isHovered =
                allBookmarksIndex >= 0 &&
                allBookmarksIndex === hoveredBookmarkIndex;

              const isNewlyImported = newlyImportedIds.has(bookmark.id);

              return (
                <div
                  key={`${bookmark.id}-${visibleIndex}`}
                  data-bookmark-index={allBookmarksIndex}
                  className={isNewlyImported ? "" : "bookmark-stream-item"}
                  style={
                    isNewlyImported
                      ? undefined
                      : {
                          animationDelay: `${visibleIndex * 10}ms`,
                        }
                  }
                  onMouseEnter={() => {
                    const activeElement = document.activeElement;
                    const isEditable =
                      activeElement?.tagName === "INPUT" ||
                      activeElement?.tagName === "TEXTAREA" ||
                      (activeElement instanceof HTMLElement &&
                        activeElement.isContentEditable);

                    if (
                      !isInputFocused &&
                      !isEditable &&
                      allBookmarksIndex >= 0
                    ) {
                      onHoverBookmark(allBookmarksIndex);
                      onSelectBookmarkIndex(allBookmarksIndex);
                    }
                  }}
                  onMouseLeave={() => {
                    onClearHover();
                    onSelectBookmarkIndex(-1);
                  }}
                >
                  <BookmarkRow
                    bookmark={bookmark}
                    onOpen={() => onOpenBookmark(bookmark)}
                    onDelete={() => onDeleteBookmark(bookmark.id)}
                    onEditTags={() => onEditTags(bookmark)}
                    onFilterTag={onFilterTag}
                    onRenameTitle={onRenameTitle}
                    tagColorMap={tagColorMap}
                    collectionColor={
                      activeCollectionId === "default"
                        ? collectionColorMap[bookmark.collectionId]
                        : undefined
                    }
                    isSelected={isSelected}
                    isDeleting={deletingBookmarkIds.has(bookmark.id)}
                    onSelect={(event) => {
                      if (allBookmarksIndex >= 0) {
                        onSelectBookmark(allBookmarksIndex);
                      }
                    }}
                    onDragStart={() => onStartDragBookmark(bookmark.id)}
                    onDragEnd={onEndDragBookmark}
                  />
                </div>
              );
            })}
          {loadingCollection && bookmarks.length < allBookmarks.length && (
            <div className="p-2 text-xs font-medium flex items-center justify-start gap-2 ">
              <div className="w-4 h-4 border border-black/30 border-t-black rounded-full animate-spin" />
              Loading
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default BookmarksList;
