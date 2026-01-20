import { Bookmark, Collection, TagDefinition } from "../types";
import { collectionColorOptions, normalizeUrl, stripRefParam } from "../utils";

const BOOKMARKS_ENDPOINT = "/api/storage/bookmarks";
const COLLECTIONS_ENDPOINT = "/api/storage/collections";
const TAGS_ENDPOINT = "/api/storage/tags";
const LEGACY_BOOKMARKS_KEY = "collection_bookmarks";
const LEGACY_COLLECTIONS_KEY = "collection_collections";

function normalizeCompareUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return url;
  try {
    const normalized = normalizeUrl(trimmed);
    const parsed = new URL(normalized);
    parsed.hostname = parsed.hostname.replace(/^www\./, "");
    parsed.hash = "";
    parsed.searchParams.delete("ref");
    Array.from(parsed.searchParams.keys()).forEach((key) => {
      if (key.toLowerCase().startsWith("utm_")) {
        parsed.searchParams.delete(key);
      }
    });
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function dedupeBookmarks(bookmarks: Bookmark[]): Bookmark[] {
  const byUrl = new Map<string, Bookmark>();
  for (const bookmark of bookmarks) {
    const normalized = normalizeCompareUrl(stripRefParam(bookmark.url));
    const existing = byUrl.get(normalized);
    const existingInDefault = existing?.collectionId === "default";
    const incomingInDefault = bookmark.collectionId === "default";
    const preferIncoming =
      !existing ||
      (existingInDefault && !incomingInDefault) ||
      ((existingInDefault === incomingInDefault) &&
        (bookmark.updatedAt ?? 0) > (existing.updatedAt ?? 0));
    if (preferIncoming) {
      byUrl.set(normalized, {
        ...bookmark,
        url: normalized,
        updatedAt: bookmark.updatedAt ?? Date.now(),
        createdAt: bookmark.createdAt ?? Date.now(),
      });
    }
  }
  return Array.from(byUrl.values());
}

async function fetchJson<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Storage request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export const storage = {
  migrateLocalStorage: async (): Promise<{ migrated: boolean }> => {
    if (typeof window === "undefined") return { migrated: false };

    const rawBookmarks = localStorage.getItem(LEGACY_BOOKMARKS_KEY);
    const rawCollections = localStorage.getItem(LEGACY_COLLECTIONS_KEY);
    if (!rawBookmarks && !rawCollections) return { migrated: false };

    let parsedBookmarks: Bookmark[] = [];
    let parsedCollections: Collection[] = [];

    if (rawBookmarks) {
      try {
        parsedBookmarks = JSON.parse(rawBookmarks) as Bookmark[];
      } catch (error) {
        console.warn("Failed to parse legacy bookmarks data:", error);
      }
    }

    if (rawCollections) {
      try {
        parsedCollections = JSON.parse(rawCollections) as Collection[];
      } catch (error) {
        console.warn("Failed to parse legacy collections data:", error);
      }
    }

    const now = Date.now();
    const collections =
      parsedCollections.length > 0
        ? parsedCollections.map((collection, index) => ({
            ...collection,
            icon: collection.icon ?? "",
            color:
              collection.color ??
              collectionColorOptions[index % collectionColorOptions.length],
            createdAt: collection.createdAt ?? now,
            updatedAt: collection.updatedAt ?? now,
          }))
        : [
            {
              id: "default",
              name: "All Bookmarks",
              icon: "",
              color: collectionColorOptions[0],
              createdAt: now,
              updatedAt: now,
            },
          ];

    const collectionIds = new Set(collections.map((collection) => collection.id));
    const migratedBookmarks = dedupeBookmarks(
      parsedBookmarks.map((bookmark) => ({
        ...bookmark,
        url: stripRefParam(bookmark.url),
        collectionId: collectionIds.has(bookmark.collectionId)
          ? bookmark.collectionId
          : "default",
        tags: bookmark.tags ?? [],
        createdAt: bookmark.createdAt ?? now,
        updatedAt: bookmark.updatedAt ?? now,
      })),
    );

    await storage.saveCollections(collections);
    await storage.saveBookmarks(migratedBookmarks);

    localStorage.removeItem(LEGACY_BOOKMARKS_KEY);
    localStorage.removeItem(LEGACY_COLLECTIONS_KEY);

    return { migrated: true };
  },
  // Bookmarks
  getBookmarks: async (): Promise<Bookmark[]> => {
    if (typeof window === "undefined") return [];
    try {
      const data = await fetchJson<{ bookmarks: Bookmark[] }>(
        BOOKMARKS_ENDPOINT,
      );
      return Array.isArray(data.bookmarks) ? data.bookmarks : [];
    } catch (error) {
      console.error("Failed to load bookmarks:", error);
      return [];
    }
  },

  saveBookmarks: async (bookmarks: Bookmark[]): Promise<void> => {
    if (typeof window === "undefined") return;
    await fetchJson(BOOKMARKS_ENDPOINT, {
      method: "PUT",
      body: JSON.stringify({ bookmarks }),
    });
  },

  addBookmark: async (bookmark: Bookmark): Promise<void> => {
    const bookmarks = await storage.getBookmarks();
    bookmarks.unshift(bookmark);
    await storage.saveBookmarks(bookmarks);
  },

  updateBookmark: async (
    id: string,
    updates: Partial<Bookmark>,
  ): Promise<void> => {
    const bookmarks = await storage.getBookmarks();
    const index = bookmarks.findIndex((b) => b.id === id);
    if (index !== -1) {
      bookmarks[index] = {
        ...bookmarks[index],
        ...updates,
        updatedAt: Date.now(),
      };
      await storage.saveBookmarks(bookmarks);
    }
  },

  deleteBookmark: async (id: string): Promise<void> => {
    const bookmarks = (await storage.getBookmarks()).filter((b) => b.id !== id);
    await storage.saveBookmarks(bookmarks);
  },

  deleteBookmarks: async (ids: string[]): Promise<void> => {
    const idSet = new Set(ids);
    const bookmarks = (await storage.getBookmarks()).filter(
      (b) => !idSet.has(b.id),
    );
    await storage.saveBookmarks(bookmarks);
  },

  dedupeBookmarksByUrl: async (): Promise<{ removed: number }> => {
    const bookmarks = await storage.getBookmarks();
    let normalizedRef = 0;
    const refStripped = bookmarks.map((bookmark) => {
      const sanitizedUrl = stripRefParam(bookmark.url);
      if (sanitizedUrl !== bookmark.url) {
        normalizedRef += 1;
        return { ...bookmark, url: sanitizedUrl };
      }
      return bookmark;
    });
    const deduped = dedupeBookmarks(refStripped);
    const removed = Math.max(0, bookmarks.length - deduped.length);
    if (removed > 0 || normalizedRef > 0) {
      await storage.saveBookmarks(deduped);
    }
    return { removed, normalizedRef };
  },

  // Collections
  getCollections: async (): Promise<Collection[]> => {
    if (typeof window === "undefined") return [];
    try {
      const data = await fetchJson<{ collections: Collection[] }>(
        COLLECTIONS_ENDPOINT,
      );
      const parsed = Array.isArray(data.collections) ? data.collections : [];

      if (parsed.length === 0) {
        const defaultCollection: Collection = {
          id: "default",
          name: "All Bookmarks",
          icon: "",
          color: collectionColorOptions[0],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await storage.saveCollections([defaultCollection]);
        return [defaultCollection];
      }

      let didUpdate = false;
      const normalized = parsed.map((collection, index) => {
        if (collection.color) return collection;
        didUpdate = true;
        return {
          ...collection,
          color: collectionColorOptions[index % collectionColorOptions.length],
        };
      });
      if (didUpdate) {
        await storage.saveCollections(normalized);
      }
      return normalized;
    } catch (error) {
      console.error("Failed to load collections:", error);
      return [
        {
          id: "default",
          name: "All Bookmarks",
          icon: "",
          color: collectionColorOptions[0],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];
    }
  },

  // Tags
  getTags: async (): Promise<TagDefinition[]> => {
    if (typeof window === "undefined") return [];
    try {
      const data = await fetchJson<{ tags: TagDefinition[] }>(TAGS_ENDPOINT);
      return Array.isArray(data.tags) ? data.tags : [];
    } catch (error) {
      console.error("Failed to load tags:", error);
      return [];
    }
  },

  saveTags: async (tags: TagDefinition[]): Promise<void> => {
    if (typeof window === "undefined") return;
    await fetchJson(TAGS_ENDPOINT, {
      method: "PUT",
      body: JSON.stringify({ tags }),
    });
  },

  saveCollections: async (collections: Collection[]): Promise<void> => {
    if (typeof window === "undefined") return;
    await fetchJson(COLLECTIONS_ENDPOINT, {
      method: "PUT",
      body: JSON.stringify({ collections }),
    });
  },

  addCollection: async (collection: Collection): Promise<void> => {
    const collections = await storage.getCollections();
    collections.push(collection);
    await storage.saveCollections(collections);
  },

  updateCollection: async (
    id: string,
    updates: Partial<Collection>,
  ): Promise<void> => {
    const collections = await storage.getCollections();
    const index = collections.findIndex((c) => c.id === id);
    if (index !== -1) {
      collections[index] = {
        ...collections[index],
        ...updates,
        updatedAt: Date.now(),
      };
      await storage.saveCollections(collections);
    }
  },

  deleteCollection: async (id: string): Promise<void> => {
    const collections = (await storage.getCollections()).filter(
      (c) => c.id !== id,
    );
    await storage.saveCollections(collections);
    const bookmarks = (await storage.getBookmarks()).filter(
      (b) => b.collectionId !== id,
    );
    await storage.saveBookmarks(bookmarks);
  },
};
