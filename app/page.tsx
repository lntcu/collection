"use client";

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type KeyboardEvent,
} from "react";
import { Bookmark, Collection, TagDefinition } from "@/lib/types";
import { storage } from "@/lib/storage";
import {
  searchBookmarks,
  isDuplicateUrl,
  stripRefParam,
  generateId,
  isLikelyUrl,
  collectionColorOptions,
  getTagColorClasses,
} from "@/lib/utils";
import { settingsStorage, Settings } from "@/lib/settings";
import SettingsModal from "@/components/settings/SettingsModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ShortcutsHelp from "@/components/ui/ShortcutsHelp";
import CollectionsSidebar from "@/components/collections/CollectionsSidebar";
import BookmarkForm from "@/components/forms/BookmarkForm";
import BookmarksList from "@/components/bookmarks/BookmarksList";
import TagEditorModal from "@/components/bookmarks/TagEditorModal";
import FooterActions from "@/components/layout/FooterActions";

function deriveTagsFromBookmarks(
  bookmarks: Bookmark[],
  existingTags: TagDefinition[],
): TagDefinition[] {
  const map = new Map<string, TagDefinition>();
  let didAdd = false;
  existingTags.forEach((tag) => {
    const color = tag.color || getTagColorClasses(tag.name);
    if (color !== tag.color) {
      didAdd = true;
    }
    map.set(tag.name, { ...tag, color });
  });
  bookmarks.forEach((bookmark) => {
    (bookmark.tags ?? []).forEach((tag) => {
      if (!map.has(tag)) {
        map.set(tag, { name: tag, color: getTagColorClasses(tag) });
        didAdd = true;
      }
    });
  });
  if (!didAdd && map.size === existingTags.length) return existingTags;
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

type UndoAction =
  | { type: "add_bookmark"; bookmark: Bookmark }
  | { type: "delete_bookmarks"; bookmarks: Bookmark[] }
  | {
      type: "move_bookmark";
      bookmarkId: string;
      fromCollectionId: string;
      toCollectionId: string;
    }
  | { type: "update_tags"; bookmarkId: string; previousTags: string[] }
  | { type: "create_collection"; collection: Collection }
  | {
      type: "delete_collection";
      collection: Collection;
      bookmarks: Bookmark[];
    };

export default function Home() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tags, setTags] = useState<TagDefinition[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState("default");
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [settings, setSettings] = useState<Settings>(
    settingsStorage.getSettings(),
  );
  const [showSettings, setShowSettings] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    type: "bookmark" | "collection";
    id?: string;
    title: string;
    description?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionColor, setNewCollectionColor] = useState(
    collectionColorOptions[0],
  );
  const [selectedBookmarkIndex, setSelectedBookmarkIndex] = useState(-1);
  const [hoveredBookmarkIndex, setHoveredBookmarkIndex] = useState(-1);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);
  const [deletingBookmarkIds, setDeletingBookmarkIds] = useState<Set<string>>(
    new Set(),
  );
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [visibleBookmarks, setVisibleBookmarks] = useState<Bookmark[]>([]);
  const [lastAddedBookmarkId, setLastAddedBookmarkId] = useState<string | null>(
    null,
  );
  const visibleBookmarksRef = useRef<Bookmark[]>([]);
  const streamingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousCollectionIdRef = useRef<string>(activeCollectionId);
  const previousSearchQueryRef = useRef<string>(searchQuery);
  const isImportingRef = useRef(false);
  const [newlyImportedIds, setNewlyImportedIds] = useState<Set<string>>(
    new Set(),
  );
  const [lastAction, setLastAction] = useState<UndoAction | null>(null);
  const [draggingBookmarkId, setDraggingBookmarkId] = useState<string | null>(
    null,
  );
  const [dragOverCollectionId, setDragOverCollectionId] = useState<
    string | null
  >(null);

  // Keep ref in sync with state
  useEffect(() => {
    visibleBookmarksRef.current = visibleBookmarks;
  }, [visibleBookmarks]);

  useEffect(() => {
    const loadStoredData = async () => {
      await storage.migrateLocalStorage();
      const loadedBookmarks = await storage.getBookmarks();
      const loadedCollections = await storage.getCollections();
      const loadedTags = await storage.getTags();
      const derivedTags = deriveTagsFromBookmarks(loadedBookmarks, loadedTags);
      if (derivedTags !== loadedTags) {
        await storage.saveTags(derivedTags);
      }
      setBookmarks(loadedBookmarks);
      setCollections(loadedCollections);
      setTags(derivedTags);
      setSettings(settingsStorage.getSettings());
      setMounted(true);
    };

    loadStoredData();

    // Cleanup debounce timeout on unmount
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (streamingTimeoutRef.current) {
        clearTimeout(streamingTimeoutRef.current);
      }
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
    };
  }, []);

  const filteredBookmarks = useMemo(() => {
    // If "All Bookmarks" (default) is selected, show all bookmarks
    // Otherwise, filter by collection
    const inCollection =
      activeCollectionId === "default"
        ? bookmarks
        : bookmarks.filter((b) => b.collectionId === activeCollectionId);
    const searched = searchBookmarks(inCollection, searchQuery);

    if (settings.sortBy === "newest") {
      return [...searched].sort((a, b) => b.createdAt - a.createdAt);
    }
    if (settings.sortBy === "oldest") {
      return [...searched].sort((a, b) => a.createdAt - b.createdAt);
    }
    return [...searched].sort((a, b) => a.title.localeCompare(b.title));
  }, [bookmarks, activeCollectionId, searchQuery, settings.sortBy]);

  useEffect(() => {
    if (!lastAddedBookmarkId) return;
    const index = filteredBookmarks.findIndex(
      (bookmark) => bookmark.id === lastAddedBookmarkId,
    );
    if (index >= 0) {
      setSelectedBookmarkIndex(index);
    }
    setLastAddedBookmarkId(null);
  }, [filteredBookmarks, lastAddedBookmarkId]);

  // Stream bookmarks when collection or filtered bookmarks change
  useEffect(() => {
    // Clear any existing streaming timeout
    if (streamingTimeoutRef.current) {
      clearTimeout(streamingTimeoutRef.current);
    }

    const collectionChanged =
      previousCollectionIdRef.current !== activeCollectionId;
    const searchChanged = previousSearchQueryRef.current !== searchQuery;
    const isCollectionOrFilterChange = collectionChanged || searchChanged;

    // If we're importing and collection/filter hasn't changed, just add new bookmarks directly
    if (isImportingRef.current && !isCollectionOrFilterChange) {
      // Find new bookmarks that aren't already visible
      const currentVisible = visibleBookmarksRef.current;
      const visibleIds = new Set(currentVisible.map((b) => b.id));
      const newBookmarks = filteredBookmarks.filter(
        (b) => !visibleIds.has(b.id),
      );

      // Add new bookmarks directly without animation
      if (newBookmarks.length > 0) {
        // Track newly imported IDs to skip animation
        const newIds = new Set(newBookmarks.map((b) => b.id));
        setNewlyImportedIds(newIds);
        setVisibleBookmarks((prev) => [...prev, ...newBookmarks]);
        // Clear the imported IDs after a short delay (after animation would have completed)
        setTimeout(() => {
          setNewlyImportedIds(new Set());
        }, 500);
      }
      isImportingRef.current = false; // Reset flag after adding
      previousCollectionIdRef.current = activeCollectionId;
      previousSearchQueryRef.current = searchQuery;
      return;
    }

    // If collection/filter hasn't changed, update in place without streaming
    if (!isCollectionOrFilterChange) {
      previousCollectionIdRef.current = activeCollectionId;
      previousSearchQueryRef.current = searchQuery;
      setVisibleBookmarks(filteredBookmarks);
      setLoadingCollection(false);
      return;
    }

    // Reset selection
    setSelectedBookmarkIndex(-1);

    // Update refs
    previousCollectionIdRef.current = activeCollectionId;
    previousSearchQueryRef.current = searchQuery;
    // If no bookmarks, clear visible immediately
    if (filteredBookmarks.length === 0) {
      setVisibleBookmarks([]);
      setLoadingCollection(false);
      return;
    }

    // Start loading state
    setLoadingCollection(true);
    setVisibleBookmarks([]);

    // Stream bookmarks one by one
    // Use a ref to track the current filtered bookmarks to avoid stale closures
    const bookmarksToStream = [...filteredBookmarks];
    let currentIndex = 0;
    const streamBookmark = () => {
      // Check if we still have bookmarks to stream and the index is valid
      if (
        currentIndex < bookmarksToStream.length &&
        bookmarksToStream[currentIndex]
      ) {
        const bookmark = bookmarksToStream[currentIndex];
        // Only add if bookmark is valid
        if (bookmark && bookmark.id) {
          setVisibleBookmarks((prev) => [...prev, bookmark]);
        }
        currentIndex++;
        streamingTimeoutRef.current = setTimeout(streamBookmark, 10); // 10ms delay between each bookmark
      } else {
        setLoadingCollection(false);
      }
    };

    // Start streaming after a small initial delay
    streamingTimeoutRef.current = setTimeout(streamBookmark, 20);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (streamingTimeoutRef.current) {
        clearTimeout(streamingTimeoutRef.current);
      }
    };
  }, [filteredBookmarks, activeCollectionId, searchQuery]);

  // Scroll to selected bookmark and blur input
  useEffect(() => {
    if (
      selectedBookmarkIndex >= 0 &&
      selectedBookmarkIndex < filteredBookmarks.length
    ) {
      const element = document.querySelector(
        `[data-bookmark-index="${selectedBookmarkIndex}"]`,
      );
      element?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedBookmarkIndex, filteredBookmarks.length]);

  // Keyboard navigation - use refs to avoid recreating handler
  const filteredBookmarksRef = useRef(filteredBookmarks);
  const selectedBookmarkIndexRef = useRef(selectedBookmarkIndex);
  const hoveredBookmarkIndexRef = useRef(hoveredBookmarkIndex);
  const openBookmarkRef = useRef<(bookmark: Bookmark) => void>(() => {});
  const handleDeleteBookmarkRef = useRef<(id: string) => void>(() => {});

  useEffect(() => {
    filteredBookmarksRef.current = filteredBookmarks;
    selectedBookmarkIndexRef.current = selectedBookmarkIndex;
    hoveredBookmarkIndexRef.current = hoveredBookmarkIndex;
  }, [filteredBookmarks, selectedBookmarkIndex, hoveredBookmarkIndex]);

  const undoLastAction = useCallback(async () => {
    if (!lastAction) return;

    let nextActiveId: string | null = null;
    try {
      switch (lastAction.type) {
        case "add_bookmark": {
          await storage.deleteBookmark(lastAction.bookmark.id);
          break;
        }
        case "delete_bookmarks": {
          if (deleteTimeoutRef.current) {
            clearTimeout(deleteTimeoutRef.current);
            deleteTimeoutRef.current = null;
          }
          const existing = await storage.getBookmarks();
          const existingIds = new Set(existing.map((bookmark) => bookmark.id));
          const restored = [
            ...lastAction.bookmarks.filter(
              (bookmark) => !existingIds.has(bookmark.id),
            ),
            ...existing,
          ];
          await storage.saveBookmarks(restored);
          setDeletingBookmarkIds(new Set());
          break;
        }
        case "move_bookmark": {
          await storage.updateBookmark(lastAction.bookmarkId, {
            collectionId: lastAction.fromCollectionId,
          });
          break;
        }
        case "update_tags": {
          await storage.updateBookmark(lastAction.bookmarkId, {
            tags: lastAction.previousTags,
          });
          break;
        }
        case "create_collection": {
          await storage.deleteCollection(lastAction.collection.id);
          if (activeCollectionId === lastAction.collection.id) {
            nextActiveId = "default";
          }
          break;
        }
        case "delete_collection": {
          const existingCollections = await storage.getCollections();
          const hasCollection = existingCollections.some(
            (collection) => collection.id === lastAction.collection.id,
          );
          if (!hasCollection) {
            await storage.saveCollections([
              ...existingCollections,
              lastAction.collection,
            ]);
          }
          const currentBookmarks = await storage.getBookmarks();
          const currentIds = new Set(
            currentBookmarks.map((bookmark) => bookmark.id),
          );
          const restored = [
            ...currentBookmarks,
            ...lastAction.bookmarks.filter(
              (bookmark) => !currentIds.has(bookmark.id),
            ),
          ];
          await storage.saveBookmarks(restored);
          nextActiveId = lastAction.collection.id;
          break;
        }
        default:
          break;
      }

      const [nextBookmarks, nextCollections, nextTags] = await Promise.all([
        storage.getBookmarks(),
        storage.getCollections(),
        storage.getTags(),
      ]);

      setBookmarks(nextBookmarks);
      setCollections(nextCollections);
      setTags(nextTags);
      if (nextActiveId) {
        setActiveCollectionId(nextActiveId);
      }
      setSelectedBookmarkIndex(-1);
      setStatus("Last action undone.");
      setLastAction(null);
    } catch (error) {
      console.error(error);
      setStatus("Unable to undo the last action.");
    }
  }, [lastAction, activeCollectionId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in input or textarea
      const activeElement = document.activeElement;
      const isEditable =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        (activeElement instanceof HTMLElement &&
          activeElement.isContentEditable);

      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "c" &&
        !e.shiftKey &&
        !e.altKey &&
        !isEditable &&
        typeof navigator !== "undefined" &&
        navigator.clipboard?.readText
      ) {
        navigator.clipboard
          .readText()
          .then((text) => {
            if (isLikelyUrl(text)) {
              addBookmarkFromValue(text);
            }
          })
          .catch(() => {});
      }

      if (activeElement === inputRef.current) {
        if (e.key === "Escape") {
          e.preventDefault();
          inputRef.current?.blur();
          return;
        }
        if (e.key === "ArrowDown") {
          if (filteredBookmarksRef.current.length > 0) {
            e.preventDefault();
            setSelectedBookmarkIndex(0);
            inputRef.current?.blur();
          }
          return;
        }
      }

      if (isEditable) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undoLastAction();
        return;
      }

      if (editingBookmarkId) {
        if (e.key === "Escape") {
          e.preventDefault();
          setEditingBookmarkId(null);
        }
        return;
      }

      // Settings
      if (e.key === "," && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowSettings(true);
        return;
      }

      // Shortcuts help
      if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts(!showShortcuts);
        return;
      }

      // Close modals with Escape
      if (e.key === "Escape") {
        if (showSettings) {
          setShowSettings(false);
          return;
        }
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
        if (pendingDelete) {
          setPendingDelete(null);
          return;
        }
        if (selectedBookmarkIndex !== -1) {
          setSelectedBookmarkIndex(-1);
          return;
        }
        if (showNewCollection) {
          handleShowNewCollection(false);
          return;
        }
      }

      // Focus input with Cmd/Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      // Collection switching with numbers 1-9
      if (
        e.key >= "1" &&
        e.key <= "9" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        const index = parseInt(e.key) - 1;
        if (index < collections.length) {
          setActiveCollectionId(collections[index].id);
          setSelectedBookmarkIndex(-1);
          return;
        }
      }

      // Arrow navigation through bookmarks
      const currentFiltered = filteredBookmarksRef.current;
      const currentSelected = selectedBookmarkIndexRef.current;

      if (e.key === "ArrowDown" && currentFiltered.length > 0) {
        e.preventDefault();
        const nextIndex =
          currentSelected < 0
            ? 0
            : Math.min(currentSelected + 1, currentFiltered.length - 1);
        setSelectedBookmarkIndex(nextIndex);
        setHoveredBookmarkIndex(-1);
        return;
      }

      if (e.key === "ArrowUp" && currentFiltered.length > 0) {
        e.preventDefault();
        if (currentSelected <= 0) {
          setSelectedBookmarkIndex(-1);
          setHoveredBookmarkIndex(-1);
          inputRef.current?.focus();
          return;
        }
        const nextIndex = currentSelected > 0 ? currentSelected - 1 : -1;
        setSelectedBookmarkIndex(nextIndex);
        setHoveredBookmarkIndex(-1);
        return;
      }

      // Open selected bookmark
      if (
        e.key === "Enter" &&
        currentSelected >= 0 &&
        currentSelected < currentFiltered.length
      ) {
        e.preventDefault();
        const bookmark = currentFiltered[currentSelected];
        openBookmarkRef.current?.(bookmark);
        return;
      }

      // Edit tags
      if (
        (e.key === "e" || e.key === "E") &&
        currentSelected >= 0 &&
        currentSelected < currentFiltered.length
      ) {
        e.preventDefault();
        const bookmark = currentFiltered[currentSelected];
        setEditingBookmarkId(bookmark.id);
        return;
      }

      // Delete bookmark(s)
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        currentSelected >= 0 &&
        currentSelected < currentFiltered.length
      ) {
        e.preventDefault();
        const bookmark = currentFiltered[currentSelected];
        handleDeleteBookmarkRef.current?.(bookmark.id);
        return;
      }

      // Focus search with /
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    collections,
    showSettings,
    showShortcuts,
    editingBookmarkId,
    pendingDelete,
    showNewCollection,
    undoLastAction,
  ]);

  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    // Count bookmarks per collection
    bookmarks.forEach((bookmark) => {
      counts[bookmark.collectionId] = (counts[bookmark.collectionId] || 0) + 1;
    });
    // Set total count for "All Bookmarks" (default collection)
    counts["default"] = bookmarks.length;
    return counts;
  }, [bookmarks]);
  const activeCollection = collections.find(
    (collection) => collection.id === activeCollectionId,
  );
  const activeCollectionColor = useMemo(() => {
    if (!activeCollection) return collectionColorOptions[0];
    if (activeCollection.color) return activeCollection.color;
    const index = collections.findIndex(
      (collection) => collection.id === activeCollection.id,
    );
    return collectionColorOptions[
      Math.max(index, 0) % collectionColorOptions.length
    ];
  }, [activeCollection, collections]);
  const editingBookmark = useMemo(() => {
    if (!editingBookmarkId) return null;
    return (
      bookmarks.find((bookmark) => bookmark.id === editingBookmarkId) ?? null
    );
  }, [bookmarks, editingBookmarkId]);
  const tagColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    tags.forEach((tag) => {
      map[tag.name] = tag.color;
    });
    return map;
  }, [tags]);
  const allTags = useMemo(() => tags.map((tag) => tag.name).sort(), [tags]);
  const collectionColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    collections.forEach((collection, index) => {
      map[collection.id] =
        collection.color ||
        collectionColorOptions[index % collectionColorOptions.length];
    });
    return map;
  }, [collections]);
  const canDeleteCollection =
    collections.length > 1 && activeCollectionId !== "default";

  const deleteBookmarks = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const toDelete = bookmarks.filter((bookmark) =>
        ids.includes(bookmark.id),
      );
      if (toDelete.length > 0) {
        setLastAction({ type: "delete_bookmarks", bookmarks: toDelete });
      }
      setDeletingBookmarkIds(new Set(ids));
      // Small delay for visual feedback
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
      deleteTimeoutRef.current = setTimeout(() => {
        const removeBookmarks = async () => {
          if (ids.length === 1) {
            await storage.deleteBookmark(ids[0]);
          } else {
            await storage.deleteBookmarks(ids);
          }
          setBookmarks(await storage.getBookmarks());
          setDeletingBookmarkIds(new Set());
          deleteTimeoutRef.current = null;
        };

        removeBookmarks();
      }, 150);
    },
    [bookmarks],
  );

  const handleStartDragBookmark = useCallback((bookmarkId: string) => {
    setDraggingBookmarkId(bookmarkId);
    setStatus("");
  }, []);

  const handleEndDragBookmark = useCallback(() => {
    setDragOverCollectionId(null);
    setDraggingBookmarkId(null);
  }, []);

  const handleDragEnterCollection = useCallback(
    (collectionId: string) => {
      if (!draggingBookmarkId) return;
      setDragOverCollectionId(collectionId);
    },
    [draggingBookmarkId],
  );

  const handleDragLeaveCollection = useCallback(() => {
    setDragOverCollectionId(null);
  }, []);

  const handleDropBookmarkOnCollection = useCallback(
    async (collectionId: string, bookmarkIdFromDrop?: string) => {
      const bookmarkId = bookmarkIdFromDrop || draggingBookmarkId;
      setDragOverCollectionId(null);
      if (!bookmarkId) return;
      const bookmark = bookmarks.find((b) => b.id === bookmarkId);
      setDraggingBookmarkId(null);
      if (!bookmark || bookmark.collectionId === collectionId) return;

      setLastAction({
        type: "move_bookmark",
        bookmarkId: bookmark.id,
        fromCollectionId: bookmark.collectionId,
        toCollectionId: collectionId,
      });

      await storage.updateBookmark(bookmark.id, { collectionId });
      setBookmarks(await storage.getBookmarks());
      setSelectedBookmarkIndex(-1);
      setStatus("Moved bookmark to collection.");
    },
    [draggingBookmarkId, bookmarks],
  );

  const openBookmark = useCallback(
    (bookmark: Bookmark) => {
      window.open(
        bookmark.url,
        settings.openLinksInNewTab ? "_blank" : "_self",
      );
    },
    [settings.openLinksInNewTab],
  );

  const handleDeleteBookmark = useCallback(
    (id: string) => {
      if (!settings.confirmDelete) {
        deleteBookmarks([id]);
        return;
      }
      setPendingDelete({
        type: "bookmark",
        id,
        title: "Delete this link?",
        description: "This action cannot be undone.",
      });
    },
    [settings.confirmDelete, deleteBookmarks],
  );

  const handleEditTags = useCallback((bookmark: Bookmark) => {
    setEditingBookmarkId(bookmark.id);
  }, []);

  const handleRenameTitle = useCallback(
    async (bookmarkId: string, title: string) => {
      await storage.updateBookmark(bookmarkId, { title });
      setBookmarks(await storage.getBookmarks());
    },
    [],
  );

  const handleSaveTags = useCallback(
    async (bookmarkId: string, nextTags: string[]) => {
      const previousTags =
        bookmarks.find((bookmark) => bookmark.id === bookmarkId)?.tags ?? [];
      const tagsChanged =
        previousTags.length !== nextTags.length ||
        previousTags.some((tag) => !nextTags.includes(tag)) ||
        nextTags.some((tag) => !previousTags.includes(tag));
      if (tagsChanged) {
        setLastAction({
          type: "update_tags",
          bookmarkId,
          previousTags,
        });
      }
      await storage.updateBookmark(bookmarkId, { tags: nextTags });
      const existingNames = new Set(tags.map((tag) => tag.name));
      const newTagDefs = nextTags
        .filter((tag) => !existingNames.has(tag))
        .map((tag) => ({
          name: tag,
          color: getTagColorClasses(tag),
        }));
      if (newTagDefs.length > 0) {
        const updatedTags = [...tags, ...newTagDefs].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        await storage.saveTags(updatedTags);
        setTags(updatedTags);
      }
      setBookmarks(await storage.getBookmarks());
      setEditingBookmarkId(null);
    },
    [tags, bookmarks],
  );

  const handleFilterTag = useCallback((tag: string) => {
    const nextValue = `#${tag}`;
    setInputValue(nextValue);
    setSearchQuery(nextValue);
    setStatus("");
    setSelectedBookmarkIndex(-1);
  }, []);

  const handleSelectBookmarkIndex = useCallback((index: number) => {
    setSelectedBookmarkIndex(index);
  }, []);

  const handleSelectBookmark = useCallback((index: number) => {
    setSelectedBookmarkIndex(index);
  }, []);

  // Update refs when handlers change
  useEffect(() => {
    openBookmarkRef.current = openBookmark;
    handleDeleteBookmarkRef.current = handleDeleteBookmark;
  }, [openBookmark, handleDeleteBookmark]);

  const handleInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Tab" || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      setStatus("");
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      const trimmedStart = inputValue.trimStart();
      const isTagMode = trimmedStart.startsWith("#");
      const nextValue = isTagMode
        ? trimmedStart.replace(/^#+/, "").trimStart()
        : `#${trimmedStart}`;
      setInputValue(nextValue);
      setSearchQuery(nextValue);
    },
    [inputValue],
  );

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    setStatus("");
    setSelectedBookmarkIndex(-1);
    setHoveredBookmarkIndex(-1);

    // Debounce search query updates
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 150); // 150ms debounce for snappy feel
  }, []);

  const addBookmarkFromValue = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;

    const looksUrl = isLikelyUrl(trimmed);

    if (!looksUrl) {
      setSearchQuery(trimmed);
      return;
    }

    const duplicate = isDuplicateUrl(trimmed, bookmarks);
    if (duplicate) {
      setStatus("This link already exists in your list.");
      return;
    }

    setLoading(true);
    setStatus("");

    const normalizedUrl = stripRefParam(trimmed);

    const saveBookmark = async (bookmark: Bookmark, statusMessage: string) => {
      await storage.addBookmark(bookmark);
      setBookmarks(await storage.getBookmarks());
      setLastAction({ type: "add_bookmark", bookmark });
      setInputValue("");
      setSearchQuery("");
      setStatus(statusMessage);
      setLastAddedBookmarkId(bookmark.id);
      inputRef.current?.focus();
    };

    try {
      const response = await fetch("/api/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      if (!response.ok) {
        throw new Error("Metadata request failed");
      }

      const metadata = await response.json();

      const newBookmark: Bookmark = {
        id: generateId(),
        url: normalizedUrl,
        title: metadata.title || normalizedUrl,
        description: metadata.description || "",
        icon: metadata.icon,
        image: metadata.image,
        tags: [],
        collectionId: activeCollectionId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveBookmark(newBookmark, "Saved.");
    } catch (err) {
      console.error(err);
      const fallbackBookmark: Bookmark = {
        id: generateId(),
        url: normalizedUrl,
        title: normalizedUrl,
        description: "",
        icon: "",
        image: "",
        tags: [],
        collectionId: activeCollectionId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await saveBookmark(fallbackBookmark, "Saved without metadata.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasteLink = (value: string) => {
    setSelectedBookmarkIndex(-1);
    setHoveredBookmarkIndex(-1);
    inputRef.current?.focus();
    const trimmed = value.trim();
    if (!trimmed || !isLikelyUrl(trimmed)) return false;
    addBookmarkFromValue(trimmed);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addBookmarkFromValue(inputValue);
  };

  const handleShowNewCollection = (show: boolean) => {
    setShowNewCollection(show);
    if (show) {
      const defaultColor =
        collectionColorOptions[
          collections.length % collectionColorOptions.length
        ];
      setNewCollectionColor(defaultColor);
    } else {
      setNewCollectionName("");
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;

    const collection: Collection = {
      id: generateId(),
      name: newCollectionName.trim(),
      icon: "",
      color: newCollectionColor,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await storage.addCollection(collection);
    setCollections(await storage.getCollections());
    setActiveCollectionId(collection.id);
    setLastAction({ type: "create_collection", collection });
    setNewCollectionName("");
    setShowNewCollection(false);
  };

  const deleteCollection = async (id: string) => {
    const removedCollection =
      collections.find((collection) => collection.id === id) || null;
    const removedBookmarks = bookmarks.filter(
      (bookmark) => bookmark.collectionId === id,
    );
    await storage.deleteCollection(id);
    setCollections(await storage.getCollections());
    setActiveCollectionId("default");
    setBookmarks(await storage.getBookmarks());
    if (removedCollection) {
      setLastAction({
        type: "delete_collection",
        collection: removedCollection,
        bookmarks: removedBookmarks,
      });
    }
  };

  const handleDeleteCollection = (id: string) => {
    setPendingDelete({
      type: "collection",
      id,
      title: "Delete this collection?",
      description: "All links inside will be removed.",
    });
  };

  const handleUpdateSettings = (updates: Partial<Settings>) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    settingsStorage.saveSettings(next);
  };

  const confirmPendingDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.type === "bookmark" && pendingDelete.id) {
      deleteBookmarks([pendingDelete.id]);
    } else if (pendingDelete.type === "collection" && pendingDelete.id) {
      deleteCollection(pendingDelete.id);
    }
    setPendingDelete(null);
  };

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="w-screen h-30 top-0 left-0 fixed z-10 bg-linear-to-b from-white to-transparent">
        <div className="w-screen h-10 backdrop-blur-sm -z-10"></div>
      </div>

      <div className="flex items-end w-screen h-30 bottom-0 left-0 fixed z-10 bg-linear-to-t from-white to-transparent pointer-events-none"></div>
      <div className="max-w-6xl mx-auto px-8 pt-10 pb-40">
        <div className="flex flex-row gap-8">
          <div className="z-30">
            <CollectionsSidebar
              collections={collections}
              activeCollectionId={activeCollectionId}
              collectionCounts={collectionCounts}
              showNewCollection={showNewCollection}
              newCollectionName={newCollectionName}
              newCollectionColor={newCollectionColor}
              canDeleteCollection={canDeleteCollection}
              onOpenCollectionLinks={(id) => {
                const target = settings.openLinksInNewTab ? "_blank" : "_self";
                const collectionBookmarks =
                  id === "default"
                    ? bookmarks
                    : bookmarks.filter(
                        (bookmark) => bookmark.collectionId === id,
                      );
                collectionBookmarks.forEach((bookmark) => {
                  window.open(bookmark.url, target);
                });
              }}
              onSelectCollection={setActiveCollectionId}
              onSetNewCollectionName={setNewCollectionName}
              onSetShowNewCollection={handleShowNewCollection}
              onSetNewCollectionColor={setNewCollectionColor}
              onCreateCollection={handleCreateCollection}
              onDeleteCollection={handleDeleteCollection}
              onSetSelectedBookmarkIndex={setSelectedBookmarkIndex}
              draggingBookmarkId={draggingBookmarkId}
              dragOverCollectionId={dragOverCollectionId}
              onDragEnterCollection={handleDragEnterCollection}
              onDragLeaveCollection={handleDragLeaveCollection}
              onDropBookmarkOnCollection={handleDropBookmarkOnCollection}
            />
          </div>

          <main className="w-full">
            <BookmarkForm
              ref={inputRef}
              inputValue={inputValue}
              status={status}
              loading={loading}
              onInputChange={handleInputChange}
              onSubmit={handleSubmit}
              onPasteLink={handlePasteLink}
              onKeyDown={handleInputKeyDown}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
            />

            <div className="pt-10">
              <BookmarksList
                bookmarks={visibleBookmarks}
                allBookmarks={filteredBookmarks}
                selectedBookmarkIndex={selectedBookmarkIndex}
                hoveredBookmarkIndex={hoveredBookmarkIndex}
                deletingBookmarkIds={deletingBookmarkIds}
                loadingCollection={loadingCollection}
                newlyImportedIds={newlyImportedIds}
                onOpenBookmark={openBookmark}
                onDeleteBookmark={handleDeleteBookmark}
                onEditTags={handleEditTags}
                onFilterTag={handleFilterTag}
                onRenameTitle={handleRenameTitle}
                tagColorMap={tagColorMap}
                isInputFocused={isInputFocused}
                collectionColorMap={collectionColorMap}
                activeCollectionId={activeCollectionId}
                onSelectBookmarkIndex={handleSelectBookmarkIndex}
                onSelectBookmark={handleSelectBookmark}
                onHoverBookmark={setHoveredBookmarkIndex}
                onClearHover={() => setHoveredBookmarkIndex(-1)}
                onStartDragBookmark={handleStartDragBookmark}
                onEndDragBookmark={handleEndDragBookmark}
              />
            </div>
          </main>
        </div>

        <FooterActions
          onShowShortcuts={() => setShowShortcuts(true)}
          onShowSettings={() => setShowSettings(true)}
        />

        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          activeCollectionId={activeCollectionId}
          collections={collections}
          tags={tags}
          onCollectionsUpdated={async () =>
            setCollections(await storage.getCollections())
          }
          onTagsUpdated={async () => {
            setTags(await storage.getTags());
            setBookmarks(await storage.getBookmarks());
          }}
          onBookmarksImported={() => {
            isImportingRef.current = true;
            storage.getBookmarks().then(setBookmarks);
          }}
        />

        <TagEditorModal
          open={!!editingBookmarkId}
          bookmark={editingBookmark}
          tags={
            tags.length > 0
              ? tags
              : allTags.map((name) => ({
                  name,
                  color: getTagColorClasses(name),
                }))
          }
          tagColorMap={tagColorMap}
          onClose={() => setEditingBookmarkId(null)}
          onSave={handleSaveTags}
        />

        <ConfirmModal
          open={!!pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmPendingDelete}
          title={pendingDelete?.title || ""}
          description={pendingDelete?.description}
          confirmLabel={
            pendingDelete?.type === "collection"
              ? "Delete collection"
              : "Delete"
          }
        />

        <ShortcutsHelp
          isOpen={showShortcuts}
          onClose={() => setShowShortcuts(false)}
        />
      </div>
    </div>
  );
}
