"use client";

import { useEffect, useState, useRef } from "react";
import { Settings } from "@/lib/settings";
import {
  extractUrlsFromMarkdown,
  normalizeUrl,
  isDuplicateUrl,
  generateId,
  collectionColorOptions,
  tagColorOptions,
  getTagColorClasses,
  formatTagLabel,
} from "@/lib/utils";
import { Bookmark, Collection, TagDefinition } from "@/lib/types";
import { storage } from "@/lib/storage";

const exportFormatOptions = [
  { value: "html", label: "HTML", extension: "html", mimeType: "text/html" },
  {
    value: "markdown",
    label: "Markdown",
    extension: "md",
    mimeType: "text/markdown",
  },
  {
    value: "text",
    label: "Plain Txt",
    extension: "txt",
    mimeType: "text/plain",
  },
  {
    value: "json",
    label: "JSON",
    extension: "json",
    mimeType: "application/json",
  },
] as const;

type ExportFormat = (typeof exportFormatOptions)[number]["value"];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdateSettings: (updates: Partial<Settings>) => void;
  activeCollectionId: string;
  collections: Collection[];
  tags: TagDefinition[];
  onCollectionsUpdated: () => void;
  onTagsUpdated: () => void;
  onBookmarksImported: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  activeCollectionId,
  collections,
  tags,
  onCollectionsUpdated,
  onTagsUpdated,
  onBookmarksImported,
}: SettingsModalProps) {
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
  });
  const [importStatus, setImportStatus] = useState("");
  const [importFailures, setImportFailures] = useState<
    Array<{ url: string; error: string }>
  >([]);
  const [exportStatus, setExportStatus] = useState("");
  const [dedupeStatus, setDedupeStatus] = useState("");
  const [selectedTagName, setSelectedTagName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bulkLinksText, setBulkLinksText] = useState("");
  const [bulkLinksStatus, setBulkLinksStatus] = useState("");
  const [selectedCollectionForBulk, setSelectedCollectionForBulk] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!isOpen) {
      setImportText("");
      setImportStatus("");
      setImportProgress({ current: 0, total: 0 });
      setImportFailures([]);
      setExportStatus("");
      setDedupeStatus("");
      setBulkLinksText("");
      setBulkLinksStatus("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (tags.length === 0) {
      setSelectedTagName(null);
      return;
    }
    setSelectedTagName((current) => {
      if (current && tags.some((tag) => tag.name === current)) {
        return current;
      }
      return tags[0].name;
    });
  }, [isOpen, tags]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Only loads bookmarks when Export button is clicked, not when format is selected
  const getBookmarksForExport = async (): Promise<Bookmark[]> => {
    const allBookmarks = await storage.getBookmarks();
    const selectedIds = settings.exportCollectionIds ?? [];

    if (selectedIds.length === 0) {
      if (activeCollectionId === "default") return allBookmarks;
      return allBookmarks.filter(
        (bookmark) => bookmark.collectionId === activeCollectionId,
      );
    }

    if (selectedIds.includes("default")) return allBookmarks;

    return allBookmarks.filter((bookmark) =>
      selectedIds.includes(bookmark.collectionId),
    );
  };

  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const escapeMarkdown = (value: string): string =>
    value.replace(/[[\]\\]/g, "\\$&");

  const buildExportContent = (bookmarks: Bookmark[], format: ExportFormat) => {
    if (format === "html") {
      const listItems = bookmarks
        .map((bookmark) => {
          const title = escapeHtml(bookmark.title || bookmark.url);
          const url = escapeHtml(bookmark.url);
          return `<li><a href="${url}">${title}</a></li>`;
        })
        .join("");
      return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bookmarks Export</title></head><body><ul>${listItems}</ul></body></html>`;
    }

    if (format === "markdown") {
      return bookmarks
        .map((bookmark) => {
          const title = escapeMarkdown(bookmark.title || bookmark.url);
          return `- [${title}](${bookmark.url})`;
        })
        .join("\n");
    }

    if (format === "text") {
      return bookmarks.map((bookmark) => bookmark.url).join("\n");
    }

    return JSON.stringify(
      bookmarks.map((bookmark) => ({
        title: bookmark.title,
        url: bookmark.url,
        description: bookmark.description,
        tags: bookmark.tags,
        createdAt: bookmark.createdAt,
        updatedAt: bookmark.updatedAt,
        collectionId: bookmark.collectionId,
      })),
      null,
      2,
    );
  };

  const toFileName = (value: string): string => {
    const base = value
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return base || "bookmarks";
  };

  // Only called when Export button is clicked - loads bookmarks and generates file
  const handleExport = async () => {
    const bookmarksToExport = await getBookmarksForExport();
    if (bookmarksToExport.length === 0) {
      setExportStatus("No bookmarks to export.");
      return;
    }

    const formatConfig = exportFormatOptions.find(
      (option) => option.value === settings.exportFormat,
    );
    if (!formatConfig) return;

    const content = buildExportContent(
      bookmarksToExport,
      settings.exportFormat as ExportFormat,
    );

    const selectedIds = settings.exportCollectionIds ?? [];
    const hasCustomSelection = selectedIds.length > 0;
    const usesAllBookmarks =
      selectedIds.includes("default") ||
      (!hasCustomSelection && activeCollectionId === "default");

    let filenameBase = "bookmarks";
    if (usesAllBookmarks) {
      filenameBase = "all-bookmarks";
    } else if (!hasCustomSelection) {
      const activeCollection = collections.find(
        (collection) => collection.id === activeCollectionId,
      );
      filenameBase = activeCollection?.name || "bookmarks";
    } else if (selectedIds.length === 1) {
      const selectedCollection = collections.find(
        (collection) => collection.id === selectedIds[0],
      );
      filenameBase = selectedCollection?.name || "bookmarks";
    } else {
      filenameBase = "collections";
    }

    const filename = `${toFileName(filenameBase)}.${formatConfig.extension}`;

    const blob = new Blob([content], { type: formatConfig.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    setExportStatus(
      `Exported ${bookmarksToExport.length} link${bookmarksToExport.length === 1 ? "" : "s"} as ${formatConfig.label}.`,
    );
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportText(text);
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    if (!importText.trim() || importing) return;

    const urls = extractUrlsFromMarkdown(importText);
    if (urls.length === 0) {
      setImportStatus("No URLs found in the markdown.");
      return;
    }

    setImporting(true);
    setImportStatus(`Found ${urls.length} URLs. Importing...`);
    setImportProgress({ current: 0, total: urls.length });

    const existingBookmarks = await storage.getBookmarks();
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const failures: Array<{ url: string; error: string }> = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      setImportProgress({ current: i + 1, total: urls.length });

      // Check for duplicates
      if (isDuplicateUrl(url, existingBookmarks)) {
        skipped++;
        continue;
      }

      try {
        // Fetch metadata
        const response = await fetch("/api/metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (!response.ok) {
          failed++;
          failures.push({
            url,
            error: `Metadata request failed (${response.status})`,
          });
          continue;
        }

        const metadata = await response.json();

        const bookmark: Bookmark = {
          id: generateId(),
          url: normalizeUrl(url),
          title: metadata.title || url,
          description: metadata.description || "",
          icon: metadata.icon,
          image: metadata.image,
          tags: [],
          collectionId: activeCollectionId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await storage.addBookmark(bookmark);
        existingBookmarks.push(bookmark);
        imported++;
      } catch (error) {
        console.error(`Failed to import ${url}:`, error);
        failed++;
        failures.push({
          url,
          error:
            error instanceof Error
              ? error.message
              : "Unexpected error occurred",
        });
      }

      // Small delay to avoid overwhelming the API
      if (i < urls.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    setImporting(false);
    setImportStatus(
      `Import complete: ${imported} imported, ${skipped} skipped (duplicates), ${failed} failed.`,
    );
    setImportFailures(failures);
    setImportText("");
    onBookmarksImported();
  };

  const handleTagColorChange = async (tagName: string, color: string) => {
    const nextTags = tags.map((tag) =>
      tag.name === tagName ? { ...tag, color } : tag,
    );
    await storage.saveTags(nextTags);
    onTagsUpdated();
  };

  const handleDeleteTag = async (tagName: string) => {
    const nextTags = tags.filter((tag) => tag.name !== tagName);
    await storage.saveTags(nextTags);
    const bookmarks = await storage.getBookmarks();
    const updatedBookmarks = bookmarks.map((bookmark) => ({
      ...bookmark,
      tags: (bookmark.tags ?? []).filter((tag) => tag !== tagName),
    }));
    await storage.saveBookmarks(updatedBookmarks);
    onTagsUpdated();
  };

  const handleDedupeLinks = async () => {
    const result = await storage.dedupeBookmarksByUrl();
    if (result.removed > 0 && result.normalizedRef > 0) {
      setDedupeStatus(
        `Removed ${result.removed} duplicate link${
          result.removed === 1 ? "" : "s"
        } and stripped ref params from ${result.normalizedRef} link${
          result.normalizedRef === 1 ? "" : "s"
        }.`,
      );
    } else if (result.removed > 0) {
      setDedupeStatus(
        `Removed ${result.removed} duplicate link${
          result.removed === 1 ? "" : "s"
        }.`,
      );
    } else if (result.normalizedRef > 0) {
      setDedupeStatus(
        `Stripped ref params from ${result.normalizedRef} link${
          result.normalizedRef === 1 ? "" : "s"
        }.`,
      );
    } else {
      setDedupeStatus("No duplicates found.");
    }
    onBookmarksImported();
  };

  const parseBulkLinks = (): string[] => {
    return bulkLinksText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && line.startsWith("http"));
  };

  const handleOpenAllLinks = () => {
    const links = parseBulkLinks();
    if (links.length === 0) {
      setBulkLinksStatus("No valid links found.");
      return;
    }

    links.forEach((url) => {
      window.open(url, "_blank");
    });

    setBulkLinksStatus(`Opened ${links.length} link${links.length === 1 ? "" : "s"}.`);
    setBulkLinksText("");
  };

  const handleCreateCollectionFromLinks = async () => {
    const links = parseBulkLinks();
    if (links.length === 0) {
      setBulkLinksStatus("No valid links found.");
      return;
    }

    const collectionName = `Collection ${collections.length}`;
    const newCollection: Collection = {
      id: generateId(),
      name: collectionName,
      icon: "",
      color:
        collectionColorOptions[
          collections.length % collectionColorOptions.length
        ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await storage.addCollection(newCollection);
    onCollectionsUpdated();

    const existingBookmarks = await storage.getBookmarks();
    let added = 0;

    for (const url of links) {
      if (isDuplicateUrl(url, existingBookmarks)) {
        continue;
      }

      try {
        const response = await fetch("/api/metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (!response.ok) {
          continue;
        }

        const metadata = await response.json();

        const bookmark: Bookmark = {
          id: generateId(),
          url: normalizeUrl(url),
          title: metadata.title || url,
          description: metadata.description || "",
          icon: metadata.icon,
          image: metadata.image,
          tags: [],
          collectionId: newCollection.id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await storage.addBookmark(bookmark);
        existingBookmarks.push(bookmark);
        added++;

        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Failed to add ${url}:`, error);
      }
    }

    setBulkLinksStatus(
      `Created collection "${collectionName}" with ${added} link${added === 1 ? "" : "s"}.`,
    );
    setBulkLinksText("");
    onBookmarksImported();
  };

  const handleAddToExistingCollection = async () => {
    const links = parseBulkLinks();
    if (links.length === 0) {
      setBulkLinksStatus("No valid links found.");
      return;
    }

    if (!selectedCollectionForBulk) {
      setBulkLinksStatus("Please select a collection.");
      return;
    }

    const existingBookmarks = await storage.getBookmarks();
    let added = 0;

    for (const url of links) {
      if (isDuplicateUrl(url, existingBookmarks)) {
        continue;
      }

      try {
        const response = await fetch("/api/metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (!response.ok) {
          continue;
        }

        const metadata = await response.json();

        const bookmark: Bookmark = {
          id: generateId(),
          url: normalizeUrl(url),
          title: metadata.title || url,
          description: metadata.description || "",
          icon: metadata.icon,
          image: metadata.image,
          tags: [],
          collectionId: selectedCollectionForBulk,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await storage.addBookmark(bookmark);
        existingBookmarks.push(bookmark);
        added++;

        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Failed to add ${url}:`, error);
      }
    }

    const selectedCollection = collections.find(
      (c) => c.id === selectedCollectionForBulk,
    );
    setBulkLinksStatus(
      `Added ${added} link${added === 1 ? "" : "s"} to "${selectedCollection?.name || "collection"}".`,
    );
    setBulkLinksText("");
    onBookmarksImported();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-5">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-white/50 cursor-pointer"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white/50 backdrop-blur-sm backdrop-saturate-150 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden border border-black/10">
        {/* Header */}
        <div
          className={`flex items-center justify-between px-2 py-1 border-b border-black/10`}
        >
          <p className="text-xs font-medium">Settings</p>
          <button
            onClick={onClose}
            className="text-xs cursor-pointer font-medium"
          >
            <p>Close</p>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(80vh-80px)] px-2">
          <div className="divide-y divide-black/10">
            {/* Collection Color */}
            {(() => {
              const activeCollection = collections.find(
                (c) => c.id === activeCollectionId,
              );
              if (!activeCollection) return null;

              const currentColor =
                activeCollection.color || collectionColorOptions[0];

              return (
                <div className="py-2 flex items-start gap-1 flex-col">
                  <div>
                    <label className="text-xs font-medium block">
                      Collection Color
                    </label>
                    <p className="text-xs text-black/50">
                      Change the collection color of "{activeCollection.name}"
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {collectionColorOptions.map((color) => {
                      const isSelected = currentColor === color;
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={async () => {
                            await storage.updateCollection(activeCollectionId, {
                              color,
                            });
                            onCollectionsUpdated();
                          }}
                          className={`w-5 h-5 rounded-lg cursor-pointer ${color} ${
                            isSelected
                              ? "ring-1 ring-black ring-offset-1 ring-offset-white"
                              : "hover:ring-1 hover:ring-black/20"
                          }`}
                          aria-pressed={isSelected}
                          title={`Select ${color}`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Sort By */}
            <div className="flex items-center justify-between py-2">
              <label className="text-xs font-medium">Sort Bookmarks</label>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { value: "newest", label: "Newest First" },
                    { value: "oldest", label: "Oldest First" },
                    { value: "alphabetical", label: "A-Z" },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => onUpdateSettings({ sortBy: value })}
                    className={`px-2 py-0.5 text-xs font-medium rounded-lg border cursor-pointer ${
                      settings.sortBy === value
                        ? "bg-black text-white border-transparent"
                        : "bg-black/5 border-black/10"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle Options */}
            <div className="divide-y divide-black/10">
              <SettingToggle
                label="Show Descriptions"
                description="Display bookmark descriptions in cards"
                checked={settings.showDescriptions}
                onChange={(checked) =>
                  onUpdateSettings({ showDescriptions: checked })
                }
              />
              <SettingToggle
                label="Show Images"
                description="Display preview images when available"
                checked={settings.showImages}
                onChange={(checked) =>
                  onUpdateSettings({ showImages: checked })
                }
              />
              <SettingToggle
                label="Open Links in New Tab"
                description="Open bookmarks in a new browser tab"
                checked={settings.openLinksInNewTab}
                onChange={(checked) =>
                  onUpdateSettings({ openLinksInNewTab: checked })
                }
              />
              <SettingToggle
                label="Confirm Before Delete"
                description="Show confirmation dialog when deleting bookmarks"
                checked={settings.confirmDelete}
                onChange={(checked) =>
                  onUpdateSettings({ confirmDelete: checked })
                }
              />
            </div>

            {/* Tags */}
            <div className="py-2">
              <h3 className="text-xs font-medium mb-1">Tags</h3>
              <div className="rounded-xl border border-black/10">
                <div className="flex flex-wrap gap-1 p-2">
                  {tags.length === 0 ? (
                    <p className="text-xs text-black/50">No tags yet.</p>
                  ) : (
                    tags.map((tag) => (
                      <button
                        key={tag.name}
                        type="button"
                        onClick={() => setSelectedTagName(tag.name)}
                        className={`text-xs font-medium px-1.5 py-0.5 rounded-md cursor-pointer ${getTagColorClasses(
                          tag.name,
                          { [tag.name]: tag.color },
                        )} ${
                          selectedTagName === tag.name
                            ? "ring-1 ring-black ring-offset-1 ring-offset-white"
                            : ""
                        }`}
                      >
                        {formatTagLabel(tag.name)}
                      </button>
                    ))
                  )}
                </div>
                {selectedTagName && (
                  <div className="border-t border-black/10 p-2">
                    {(() => {
                      const tag = tags.find(
                        (item) => item.name === selectedTagName,
                      );
                      if (!tag) return null;
                      return (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {tagColorOptions.map((color) => {
                              const isSelected = tag.color === color;
                              return (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() =>
                                    handleTagColorChange(tag.name, color)
                                  }
                                  className={`w-4 h-4 rounded-md border cursor-pointer ${color} ${
                                    isSelected
                                      ? "ring-1 ring-black ring-offset-1 ring-offset-white"
                                      : ""
                                  }`}
                                  aria-pressed={isSelected}
                                  title={`Select ${color}`}
                                />
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteTag(tag.name)}
                            className="text-xs  text-red-500 font-medium cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Export Bookmarks */}
            <div className="py-3">
              <h3 className="text-xs font-medium mb-3">Export Links</h3>
              <div className="rounded-xl border border-black/10">
                <div className="flex flex-col">
                  <div className="flex flex-col gap-1 pl-2 pr-1 py-1 border-b border-black/10">
                    <div className="flex items-start justify-between gap-20">
                      <p className="text-xs font-medium text-black/70">
                        Collections to include
                      </p>
                      <div className="flex flex-wrap items-end justify-end gap-1">
                        {collections.map((collection) => {
                          const selectedIds =
                            settings.exportCollectionIds ?? [];
                          const isSelected = selectedIds.includes(
                            collection.id,
                          );
                          return (
                            <button
                              key={collection.id}
                              onClick={() => {
                                const current =
                                  settings.exportCollectionIds ?? [];
                                const next = current.includes(collection.id)
                                  ? current.filter((id) => id !== collection.id)
                                  : [...current, collection.id];
                                onUpdateSettings({
                                  exportCollectionIds: next,
                                });
                              }}
                              className={`px-2 py-0.5 text-xs font-medium rounded-lg border cursor-pointer ${
                                isSelected
                                  ? "bg-black text-white border-transparent"
                                  : "bg-black/5 border-black/10"
                              }`}
                            >
                              {collection.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-between items-center pl-2 pr-1 py-1">
                    <p className="text-xs font-medium text-black/70">
                      Export format
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {exportFormatOptions.map((format) => (
                        <button
                          key={format.value}
                          onClick={() =>
                            onUpdateSettings({ exportFormat: format.value })
                          }
                          className={`px-2 py-0.5 text-xs font-medium rounded-lg border cursor-pointer ${
                            settings.exportFormat === format.value
                              ? "bg-black text-white border-transparent"
                              : "bg-black/5 border-black/10"
                          }`}
                        >
                          {format.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-2 py-1">
                    <p className="text-xs text-black/50">
                      {settings.exportCollectionIds.length === 0
                        ? "Export the active collection as "
                        : `Export the selected collection${
                            settings.exportCollectionIds.length === 1 ? "" : "s"
                          } as `}
                      {settings.exportFormat === "text"
                        ? "Plain Txt"
                        : settings.exportFormat.toUpperCase()}
                      .
                    </p>
                    <button
                      onClick={handleExport}
                      className="font-medium text-xs  cursor-pointer"
                    >
                      Export
                    </button>
                  </div>
                  {exportStatus && (
                    <div className="w-full border-t border-black/10 px-2 py-1">
                      <p className="text-xs">{exportStatus}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dedupe Bookmarks */}
            <div className="py-3">
              <h3 className="text-xs font-medium mb-3">Duplicates</h3>
              <div className="rounded-xl border border-black/10 p-2 flex items-center justify-between gap-3">
                <p className="text-xs text-black/50">
                  Remove duplicate links (e.g. www and non-www).
                </p>
                <button
                  onClick={handleDedupeLinks}
                  className="px-2 py-0.5 text-xs rounded-lg border border-black/10 bg-black/5 cursor-pointer"
                >
                  Remove duplicates
                </button>
              </div>
              {dedupeStatus && (
                <p className="text-xs text-black/60 mt-2">{dedupeStatus}</p>
              )}
            </div>

            {/* Import Bookmarks */}
            <div className="py-2">
              <h3 className="text-xs font-medium mb-3">Import from Markdown</h3>
              <div className="rounded-xl border border-black/10">
                <div className="">
                  <div className="flex items-center gap-2 px-2 py-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".md,.markdown,.txt"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="markdown-file-input"
                    />
                    <label
                      htmlFor="markdown-file-input"
                      className="text-xs font-medium cursor-pointer"
                    >
                      Choose File
                    </label>
                    <span className="text-xs text-black/50">
                      or paste markdown below
                    </span>
                  </div>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Paste markdown with links here...&#10;&#10;Example:&#10;[Example](https://example.com)&#10;[Another Link](https://another.com)"
                    className="w-full h-30 p-2 border-t border-black/10
                               focus:outline-none resize-none font-mono text-xs"
                    disabled={importing}
                  />

                  <div className="w-full flex items-end justify-between px-2 py-1 border-t border-black/10">
                    <div className="">
                      {importProgress.total > 0 && (
                        <div className="">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-black/50">
                              Processing {importProgress.current} of{" "}
                              {importProgress.total}
                            </span>
                            <span className="text-black/50">
                              {Math.round(
                                (importProgress.current /
                                  importProgress.total) *
                                  100,
                              )}
                              %
                            </span>
                          </div>
                          <div className="">
                            <div
                              className="h-full bg-black"
                              style={{
                                width: `${(importProgress.current / importProgress.total) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                      {importStatus && (
                        <p
                          className={`text-xs ${importStatus.includes("complete") ? "text-black" : "text-black/50"}`}
                        >
                          {importStatus}
                        </p>
                      )}
                      {importFailures.length > 0 && (
                        <div className="mt-2 ">
                          <p className="text-xs font-medium mb-1">
                            Failed imports
                          </p>
                          <div className="space-y-1">
                            {importFailures.map((failure, index) => (
                              <div key={`${failure.url}-${index}`}>
                                <p className="text-xs font-mono break-all">
                                  {failure.url}
                                </p>
                                <p className="text-xs text-black/50">
                                  {failure.error}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleImport}
                      disabled={!importText.trim() || importing}
                      className={`px-2 text-xs rounded-md font-medium border border-black/10 bg-black/5 flex items-center justify-center gap-2 ${
                        !importText.trim() || importing
                          ? "cursor-not-allowed"
                          : " cursor-pointer"
                      }`}
                    >
                      {importing && (
                        <div className="w-2 h-2 border border-black border-t-black/50 rounded-full animate-spin" />
                      )}
                      {importing
                        ? "Importing..."
                        : `Import ${extractUrlsFromMarkdown(importText).length} Links`}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bulk Link Operations */}
            <div className="py-2">
              <h3 className="text-xs font-medium mb-3">Bulk Link Actions</h3>
              <div className="rounded-xl border border-black/10">
                <div className="">
                  <textarea
                    value={bulkLinksText}
                    onChange={(e) => setBulkLinksText(e.target.value)}
                    placeholder="Paste links here, one per line...&#10;&#10;https://example.com&#10;https://another.com&#10;https://third.com"
                    className="w-full h-30 p-2 border-b border-black/10
                               focus:outline-none resize-none font-mono text-xs"
                  />

                  <div className="w-full flex flex-col gap-2 px-2 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={handleOpenAllLinks}
                        disabled={!bulkLinksText.trim()}
                        className={`px-2 py-0.5 text-xs font-medium rounded-lg border border-black/10 bg-black/5 ${
                          !bulkLinksText.trim()
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer"
                        }`}
                      >
                        Open All in Tabs
                      </button>
                      <button
                        onClick={handleCreateCollectionFromLinks}
                        disabled={!bulkLinksText.trim()}
                        className={`px-2 py-0.5 text-xs font-medium rounded-lg border border-black/10 bg-black/5 ${
                          !bulkLinksText.trim()
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer"
                        }`}
                      >
                        Create New Collection
                      </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={selectedCollectionForBulk || ""}
                        onChange={(e) =>
                          setSelectedCollectionForBulk(e.target.value || null)
                        }
                        className="px-2 py-0.5 text-xs font-medium rounded-lg border border-black/10 bg-black/5 cursor-pointer"
                      >
                        <option value="">Select collection...</option>
                        {collections
                          .filter((c) => c.id !== "default")
                          .map((collection) => (
                            <option key={collection.id} value={collection.id}>
                              {collection.name}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={handleAddToExistingCollection}
                        disabled={
                          !bulkLinksText.trim() || !selectedCollectionForBulk
                        }
                        className={`px-2 py-0.5 text-xs font-medium rounded-lg border border-black/10 bg-black/5 ${
                          !bulkLinksText.trim() || !selectedCollectionForBulk
                            ? "cursor-not-allowed opacity-50"
                            : "cursor-pointer"
                        }`}
                      >
                        Add to Collection
                      </button>
                    </div>

                    {bulkLinksStatus && (
                      <p className="text-xs text-black/60">{bulkLinksStatus}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1">
        <p className="text-xs font-medium leading-tight">{label}</p>
        <p className="text-xs text-black/50">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-13 items-center rounded-full cursor-pointer ${
          checked ? "bg-black/20" : "bg-black/10"
        }`}
      >
        <span
          className={`inline-block h-4 w-6 transform rounded-full bg-black/50 ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
