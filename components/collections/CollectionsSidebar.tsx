"use client";

import { Collection } from "@/lib/types";
import { collectionColorOptions } from "@/lib/utils";

interface CollectionsSidebarProps {
  collections: Collection[];
  activeCollectionId: string;
  collectionCounts: Record<string, number>;
  showNewCollection: boolean;
  newCollectionName: string;
  newCollectionColor: string;
  canDeleteCollection: boolean;
  onOpenCollectionLinks: (id: string) => void;
  onSelectCollection: (id: string) => void;
  onSetNewCollectionName: (name: string) => void;
  onSetShowNewCollection: (show: boolean) => void;
  onSetNewCollectionColor: (color: string) => void;
  onCreateCollection: () => void;
  onDeleteCollection: (id: string) => void;
  onSetSelectedBookmarkIndex: (index: number) => void;
  draggingBookmarkId: string | null;
  dragOverCollectionId: string | null;
  onDragEnterCollection: (collectionId: string) => void;
  onDragLeaveCollection: () => void;
  onDropBookmarkOnCollection: (
    collectionId: string,
    bookmarkId?: string,
  ) => void;
}

export default function CollectionsSidebar({
  collections,
  activeCollectionId,
  collectionCounts,
  showNewCollection,
  newCollectionName,
  newCollectionColor,
  canDeleteCollection,
  onOpenCollectionLinks,
  onSelectCollection,
  onSetNewCollectionName,
  onSetShowNewCollection,
  onSetNewCollectionColor,
  onCreateCollection,
  onDeleteCollection,
  onSetSelectedBookmarkIndex,
  draggingBookmarkId,
  dragOverCollectionId,
  onDragEnterCollection,
  onDragLeaveCollection,
  onDropBookmarkOnCollection,
}: CollectionsSidebarProps) {
  const activeCount = collectionCounts[activeCollectionId] ?? 0;

  return (
    <aside className="w-60 shrink-0 space-y-4 sticky top-10 self-start">
      <div className="rounded-2xl border border-black/10 flex flex-col bg-white">
        <div className="uppercase text-black/50 text-xs p-2">Collections</div>
        <div className="flex flex-col items-start divide-black/5 divide-y">
          {collections.map((collection, index) => {
            const count = collectionCounts[collection.id] ?? 0;
            const color =
              collection.color ||
              collectionColorOptions[index % collectionColorOptions.length];
            const isDropTarget =
              draggingBookmarkId && dragOverCollectionId === collection.id;
            return (
              <button
                key={collection.id}
                type="button"
                onClick={() => {
                  onSelectCollection(collection.id);
                  onSetSelectedBookmarkIndex(-1);
                }}
                className={`w-full flex justify-between items-center gap-3 px-2 py-1 transition-all cursor-pointer ${
                  activeCollectionId === collection.id
                    ? "bg-black/5"
                    : "hover:bg-black/5"
                } ${isDropTarget ? "bg-black/5" : ""}`}
                onDragEnter={(event) => {
                  if (!draggingBookmarkId) return;
                  event.preventDefault();
                  onDragEnterCollection(collection.id);
                }}
                onDragOver={(event) => {
                  if (!draggingBookmarkId) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDragLeave={(event) => {
                  if (!draggingBookmarkId) return;
                  event.preventDefault();
                  if (dragOverCollectionId === collection.id) {
                    onDragLeaveCollection();
                  }
                }}
                onDrop={(event) => {
                  const droppedBookmarkId =
                    event.dataTransfer?.getData("application/bookmark-id") ||
                    event.dataTransfer?.getData("text/plain") ||
                    "";
                  if (!draggingBookmarkId && !droppedBookmarkId) return;
                  event.preventDefault();
                  event.stopPropagation();
                  onDropBookmarkOnCollection(
                    collection.id,
                    droppedBookmarkId || undefined,
                  );
                }}
              >
                <div className="flex items-center gap-2 justify-start">
                  <span
                    className={`w-3 h-3 rounded-sm shrink-0 ${color}`}
                    aria-hidden
                  />
                  <span className="flex-1 text-xs truncate min-w-0">
                    {collection.name || "Collection"}
                  </span>
                </div>
                <span className="text-xs text-black/50">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-col divide-y divide-black/10 border-t border-black/10">
          {showNewCollection ? (
            <div className="flex flex-col gap-1 px-2 py-1">
              <input
                value={newCollectionName}
                onChange={(e) => onSetNewCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onCreateCollection();
                  } else if (e.key === "Escape") {
                    onSetShowNewCollection(false);
                    onSetNewCollectionName("");
                  }
                }}
                placeholder="New group name"
                className="pb-1 text-xs font-medium focus:outline-none"
                autoFocus
              />
              <div className="flex items-center gap-1 flex-wrap">
                {collectionColorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => onSetNewCollectionColor(color)}
                    className={`w-4 h-4 rounded-md cursor-pointer ${color} ${
                      newCollectionColor === color
                        ? "ring-1 ring-black ring-offset-1 ring-offset-white"
                        : ""
                    }`}
                    aria-pressed={newCollectionColor === color}
                  />
                ))}
              </div>
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={onCreateCollection}
                  className="text-xs cursor-pointer font-medium"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onSetShowNewCollection(true)}
              className="w-full text-start text-xs px-2 py-1 cursor-pointer font-medium"
            >
              + New Collection
            </button>
          )}
          <button
            type="button"
            disabled={!canDeleteCollection}
            onClick={() => onDeleteCollection(activeCollectionId)}
            className={`w-full text-start px-2 text-xs py-1 font-medium ${
              canDeleteCollection
                ? "cursor-pointer hover:text-red-500"
                : "cursor-not-allowed opacity-50"
            }`}
          >
            Delete Collection
          </button>
          <button
            type="button"
            disabled={activeCount === 0}
            onClick={() => onOpenCollectionLinks(activeCollectionId)}
            className={`w-full text-start px-2 text-xs py-1 font-medium ${
              activeCount > 0
                ? "cursor-pointer hover:text-black"
                : "cursor-not-allowed opacity-50"
            }`}
          >
            Open All Links
          </button>
        </div>
      </div>
    </aside>
  );
}
