import { Bookmark } from "../types";

export const collectionColorOptions = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-yellow-500",
  "bg-green-500",
  "bg-cyan-500",
  "bg-sky-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-purple-500",
  "bg-pink-500",
];

export const tagColorOptions = [
  "bg-amber-100 text-amber-900 border-amber-200",
  "bg-emerald-100 text-emerald-900 border-emerald-200",
  "bg-sky-100 text-sky-900 border-sky-200",
  "bg-rose-100 text-rose-900 border-rose-200",
  "bg-violet-100 text-violet-900 border-violet-200",
  "bg-lime-100 text-lime-900 border-lime-200",
  "bg-orange-100 text-orange-900 border-orange-200",
  "bg-cyan-100 text-cyan-900 border-cyan-200",
];

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function stripRefParam(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return url;
  try {
    const normalized = normalizeUrl(trimmed);
    const parsed = new URL(normalized);
    parsed.searchParams.delete("ref");
    return parsed.href;
  } catch {
    return url;
  }
}

export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url.startsWith("http") ? url : `https://${url}`);
    return urlObj.href;
  } catch {
    return url;
  }
}

export function isDuplicateUrl(
  url: string,
  bookmarks: Bookmark[],
): Bookmark | null {
  const normalized = stripRefParam(url);
  const duplicate = bookmarks.find(
    (b) => stripRefParam(b.url) === normalized,
  );
  return duplicate || null;
}

export function searchBookmarks(
  bookmarks: Bookmark[],
  query: string,
): Bookmark[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return bookmarks;

  const tagOnly =
    trimmedQuery.startsWith("#") ||
    trimmedQuery.toLowerCase().startsWith("tag:");
  const rawTagQuery = tagOnly
    ? trimmedQuery.replace(/^#+/, "").replace(/^tag:/i, "").trim()
    : trimmedQuery;

  const normalizedQuery = normalizeSearchText(rawTagQuery);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    if (!tagOnly) return bookmarks;
    return bookmarks.filter((bookmark) => (bookmark.tags ?? []).length > 0);
  }

  return bookmarks.filter((bookmark) => {
    const title = normalizeSearchText(bookmark.title);
    const url = normalizeSearchText(bookmark.url);
    const description = normalizeSearchText(bookmark.description || "");
    const tags = (bookmark.tags ?? []).map((tag) => normalizeSearchText(tag));
    const tagsText = tags.join(" ");

    if (tagOnly) {
      return matchesTokens(tagsText, tokens);
    }

    const combined = [title, url, description, tagsText].join(" ");
    if (matchesTokens(combined, tokens)) return true;

    if (tokens.length === 1) {
      const compactToken = tokens[0].replace(/\s+/g, "");
      if (!compactToken) return false;
      const compactCombined = combined.replace(/\s+/g, "");
      return compactCombined.includes(compactToken);
    }

    return false;
  });
}

export function getDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return "";
  }
}

export function isLikelyUrl(value: string): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.includes(" ")) return false;

  try {
    // Allow inputs without protocol by prefixing https
    // URL parsing will throw on plain words without a dot
    // eslint-disable-next-line no-new
    new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return true;
  } catch {
    return false;
  }
}

export function getTagColorClasses(
  tag: string,
  tagColorMap?: Record<string, string>,
): string {
  if (!tag) return "bg-black/5 text-black/70 border-black/10";
  if (tagColorMap && tagColorMap[tag]) return tagColorMap[tag];
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) % 2147483647;
  }
  const index = Math.abs(hash) % tagColorOptions.length;
  return tagColorOptions[index];
}

export function formatTagLabel(tag: string): string {
  if (!tag) return "";
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesTokens(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  return tokens.every((token) => text.includes(token));
}

/**
 * Extract URLs from markdown text
 * Supports:
 * - [text](url)
 * - [text](url "title")
 * - Plain URLs
 * - URLs in code blocks (but we'll skip those)
 */
export function extractUrlsFromMarkdown(markdown: string): string[] {
  const urls: string[] = [];
  const urlSet = new Set<string>();

  // Remove code blocks first (we don't want URLs from code)
  const withoutCodeBlocks = markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "");

  // Match markdown links: [text](url) or [text](url "title")
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = markdownLinkRegex.exec(withoutCodeBlocks)) !== null) {
    const url = match[2].trim().split(/\s+/)[0]; // Get URL, remove title if present
    if (url && !url.startsWith("#")) {
      // Skip anchor links
      try {
        const normalized = normalizeUrl(url);
        if (!urlSet.has(normalized)) {
          urls.push(normalized);
          urlSet.add(normalized);
        }
      } catch {
        // Invalid URL, skip
      }
    }
  }

  // Also find plain URLs in the text
  const urlRegex = /(https?:\/\/[^\s\)]+|www\.[^\s\)]+)/gi;
  while ((match = urlRegex.exec(withoutCodeBlocks)) !== null) {
    const url = match[0].trim();
    try {
      const normalized = normalizeUrl(url);
      if (!urlSet.has(normalized)) {
        urls.push(normalized);
        urlSet.add(normalized);
      }
    } catch {
      // Invalid URL, skip
    }
  }

  return urls;
}
