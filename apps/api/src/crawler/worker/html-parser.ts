/**
 * Native HTML parser using regex and string methods.
 * No external libraries (Cheerio, etc.) — per project constraints.
 */

export interface ParsedPage {
  title: string;
  bodyText: string;
  links: string[];
}

/** Extract the content of the first <title> tag */
export function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : '';
}

/** Strip all HTML tags and collapse whitespace to extract visible body text */
export function extractBodyText(html: string): string {
  let body = html;

  // Try to isolate <body> content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    body = bodyMatch[1];
  }

  // Remove script and style blocks entirely
  body = body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
  body = body.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
  body = body.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ');

  // Strip remaining HTML tags
  body = body.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  body = body
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Collapse whitespace
  body = body.replace(/\s+/g, ' ').trim();

  return body;
}

/** Extract all href values from anchor tags, resolving relative URLs */
export function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const hrefRegex = /<a\s[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('javascript:') || raw.startsWith('mailto:')) {
      continue;
    }

    try {
      const resolved = new URL(raw, baseUrl).href;
      // Only follow http/https links
      if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
        links.push(resolved);
      }
    } catch {
      // Malformed URL — skip
    }
  }

  return [...new Set(links)];
}

/** Tokenize text into lowercase terms for indexing */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && token.length < 50);
}

/** Build a term frequency map from title and body tokens */
export function buildTermFrequencies(
  title: string,
  bodyText: string,
): Map<string, { title: number; body: number }> {
  const freqs = new Map<string, { title: number; body: number }>();

  for (const token of tokenize(title)) {
    const entry = freqs.get(token) ?? { title: 0, body: 0 };
    entry.title++;
    freqs.set(token, entry);
  }

  for (const token of tokenize(bodyText)) {
    const entry = freqs.get(token) ?? { title: 0, body: 0 };
    entry.body++;
    freqs.set(token, entry);
  }

  return freqs;
}

/** Full parse pipeline: fetch result → structured data */
export function parsePage(html: string, baseUrl: string): ParsedPage {
  return {
    title: extractTitle(html),
    bodyText: extractBodyText(html),
    links: extractLinks(html, baseUrl),
  };
}
