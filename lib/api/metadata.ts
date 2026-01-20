/**
 * Metadata extraction utilities for bookmarks
 * These functions are used by the API route to extract metadata from HTML
 */

export function extractTitle(html: string, url: string): string {
  // Try og:title first
  let match = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
  if (match && match[1]) return decodeHtmlEntities(match[1]);

  // Try twitter:title
  match = html.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']*)["']/i);
  if (match && match[1]) return decodeHtmlEntities(match[1]);

  // Try regular title tag
  match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (match && match[1]) return decodeHtmlEntities(match[1]);

  // Fallback to domain
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'Untitled';
  }
}

export function extractDescription(html: string): string {
  // Try og:description
  let match = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i);
  if (match && match[1]) return decodeHtmlEntities(match[1]);

  // Try twitter:description
  match = html.match(/<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']*)["']/i);
  if (match && match[1]) return decodeHtmlEntities(match[1]);

  // Try meta description
  match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  if (match && match[1]) return decodeHtmlEntities(match[1]);

  return '';
}

export function extractIcon(html: string, url: string): string | undefined {
  try {
    const urlObj = new URL(url);
    const origin = urlObj.origin;

    // Try apple-touch-icon
    let match = html.match(/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']*)["']/i);
    if (match && match[1]) return resolveUrl(match[1], origin);

    // Try icon with type image/png
    match = html.match(/<link[^>]*rel=["']icon["'][^>]*type=["']image\/png["'][^>]*href=["']([^"']*)["']/i);
    if (match && match[1]) return resolveUrl(match[1], origin);

    // Try shortcut icon
    match = html.match(/<link[^>]*rel=["']shortcut icon["'][^>]*href=["']([^"']*)["']/i);
    if (match && match[1]) return resolveUrl(match[1], origin);

    // Try any icon
    match = html.match(/<link[^>]*rel=["']icon["'][^>]*href=["']([^"']*)["']/i);
    if (match && match[1]) return resolveUrl(match[1], origin);

    // Fallback to /favicon.ico
    return `${origin}/favicon.ico`;
  } catch {
    return undefined;
  }
}

export function extractImage(html: string, url: string): string | undefined {
  try {
    const urlObj = new URL(url);
    const origin = urlObj.origin;

    // Try og:image
    let match = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i);
    if (match && match[1]) return resolveUrl(match[1], origin);

    // Try twitter:image
    match = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']*)["']/i);
    if (match && match[1]) return resolveUrl(match[1], origin);

    return undefined;
  } catch {
    return undefined;
  }
}

function resolveUrl(href: string, base: string): string {
  try {
    if (href.startsWith('http')) return href;
    if (href.startsWith('//')) return `https:${href}`;
    if (href.startsWith('/')) return `${base}${href}`;
    return `${base}/${href}`;
  } catch {
    return href;
  }
}

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
  };
  return text.replace(/&[^;]+;/g, match => entities[match] || match);
}

