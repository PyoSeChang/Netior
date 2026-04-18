export interface FileLink {
  path: string;
  line?: number;
  col?: number;
}

export interface UrlLink {
  url: string;
}

// Match file paths with optional line:col
// Patterns:
//   C:\Users\foo\bar.ts            (Windows absolute)
//   C:\Users\foo\bar.ts:42         (with line)
//   C:\Users\foo\bar.ts:42:10      (with line:col)
//   C:\Users\foo\bar.ts(42,10)     (tsc/msbuild style)
//   /home/user/bar.ts              (Unix absolute)
//   ./src/bar.ts:42:10             (relative)
//   src/bar.ts:42                  (relative without ./)

const FILE_LINK_PATTERNS = [
  // Windows absolute: C:\...\file.ext, C:/...\file.ext, /C:/...\file.ext
  /((?:\/)?[A-Za-z]:[\\/](?:[^\\/:*?"<>|\r\n]+[\\/])*[^\\/:*?"<>|\r\n]+\.\w+)(?:\((\d+),\s*(\d+)\)|:(\d+)(?::(\d+))?)?/g,
  // Unix absolute: /path/to/file.ext[:line[:col]]
  /(\/[^\s:*?"<>|]+\.\w+)(?::(\d+)(?::(\d+))?)?/g,
  // Relative: ./path or path/to/file.ext[:line[:col]]  (must contain / or \)
  /(\.?\.?[/\\][^\s:*?"<>|]*\.\w+)(?:\((\d+),\s*(\d+)\)|:(\d+)(?::(\d+))?)?/g,
  // Repo-relative: packages/app/src/file.ts[:line[:col]]
  /((?:[\w@.+-]+[/\\])+[^\s:*?"<>|]*\.\w+)(?:\((\d+),\s*(\d+)\)|:(\d+)(?::(\d+))?)?/g,
];

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/g;
const DELIMITED_PATH_PATTERN = /(["'`])([^"'`]+?\.\w+(?::\d+(?::\d+)?)?)\1/g;
const ESCAPED_SPACE_PATH_PATTERN = /((?:[A-Za-z]:[\\/]|\.?\.?[\\/]|(?:[\w@.+-]+[\\/])+)(?:[^\s:*?"<>|]|\\ )+\.\w+)(?:\((\d+),\s*(\d+)\)|:(\d+)(?::(\d+))?)?/g;
const PATH_START_PATTERN = /[A-Za-z]:[\\/]|\/(?!\/)|\.?\.?[\\/]|(?:[\w@.+-]+[\\/])/;

function trimUrl(rawUrl: string): string {
  return rawUrl.replace(/[)\].,;:!?]+$/g, '');
}

function isInsideAnyRange(start: number, end: number, ranges: Array<{ start: number; end: number }>): boolean {
  return ranges.some((range) => start >= range.start && end <= range.end);
}

function unescapePath(path: string): string {
  return path.replace(/\\ /g, ' ');
}

function looksPathLike(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path)
    || /^\.?\.?[\\/]/.test(path)
    || /^\/(?!\/)/.test(path)
    || /[/\\]/.test(path);
}

function sliceToPathStart(rawPath: string): { path: string; offset: number } | null {
  const match = rawPath.match(PATH_START_PATTERN);
  if (!match || match.index == null) return null;
  return { path: rawPath.slice(match.index), offset: match.index };
}

function parseLineSuffix(path: string): { path: string; line?: number; col?: number } {
  const match = path.match(/^(.*?\.\w+):(\d+)(?::(\d+))?$/);
  if (!match) return { path };
  return {
    path: match[1],
    line: parseInt(match[2], 10),
    col: match[3] ? parseInt(match[3], 10) : undefined,
  };
}

function isOverlapping(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

function preferLongNonOverlappingLinks<T extends { start: number; end: number }>(links: T[]): T[] {
  const preferred = [...links].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return (b.end - b.start) - (a.end - a.start);
  });
  const kept: T[] = [];

  for (const link of preferred) {
    const overlapping = kept.find((existing) => isOverlapping(existing, link));
    if (!overlapping) {
      kept.push(link);
      continue;
    }
    if (link.end - link.start > overlapping.end - overlapping.start) {
      kept.splice(kept.indexOf(overlapping), 1, link);
    }
  }

  return kept.sort((a, b) => a.start - b.start);
}

export function extractUrls(text: string): Array<UrlLink & { start: number; end: number }> {
  const results: Array<UrlLink & { start: number; end: number }> = [];

  URL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_PATTERN.exec(text)) !== null) {
    const url = trimUrl(match[0]);
    results.push({ url, start: match.index, end: match.index + url.length });
  }

  return results;
}

/**
 * Extract file links from a line of terminal text.
 * Returns all matches with their character ranges.
 */
export function extractFileLinks(text: string): Array<FileLink & { start: number; end: number }> {
  const results: Array<FileLink & { start: number; end: number }> = [];
  const seen = new Set<number>();
  const urls = extractUrls(text);

  for (const pattern of FILE_LINK_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      if (seen.has(start)) continue;
      seen.add(start);

      const path = match[1];
      const end = start + path.length;
      if (isInsideAnyRange(start, end, urls)) continue;
      // For the Windows pattern: groups are (path)(tscLine)(tscCol)(colonLine)(colonCol)
      // For Unix/relative: groups are (path)(line)(col)
      let line: number | undefined;
      let col: number | undefined;

      if (match[2]) {
        line = parseInt(match[2], 10);
        col = match[3] ? parseInt(match[3], 10) : undefined;
      }
      if (match[4]) {
        line = parseInt(match[4], 10);
        col = match[5] ? parseInt(match[5], 10) : undefined;
      }

      results.push({ path, line, col, start, end: start + match[0].length });
    }
  }

  for (const pattern of [DELIMITED_PATH_PATTERN, ESCAPED_SPACE_PATH_PATTERN]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const rawPathWithPrefix = pattern === DELIMITED_PATH_PATTERN ? match[2] : match[1];
      const sliced = pattern === DELIMITED_PATH_PATTERN
        ? sliceToPathStart(rawPathWithPrefix)
        : { path: rawPathWithPrefix, offset: 0 };
      if (!sliced) continue;

      const rawPath = sliced.path;
      const start = match.index + (pattern === DELIMITED_PATH_PATTERN ? match[0].indexOf(rawPathWithPrefix) : 0) + sliced.offset;
      const end = start + rawPath.length;
      if (seen.has(start) || isInsideAnyRange(start, end, urls)) continue;
      if (!looksPathLike(rawPath)) continue;

      const parsed = parseLineSuffix(unescapePath(rawPath));
      seen.add(start);
      results.push({ ...parsed, start, end });
    }
  }

  return preferLongNonOverlappingLinks(results);
}

export function extractUrl(text: string, col: number): UrlLink | null {
  const links = extractUrls(text);
  for (const link of links) {
    if (col >= link.start && col < link.end) {
      return { url: link.url };
    }
  }
  return null;
}

/**
 * Find the file link at a specific column position in a line.
 */
export function extractFileLink(text: string, col: number): FileLink | null {
  const links = extractFileLinks(text);
  for (const link of links) {
    if (col >= link.start && col < link.end) {
      return { path: link.path, line: link.line, col: link.col };
    }
  }
  return null;
}
