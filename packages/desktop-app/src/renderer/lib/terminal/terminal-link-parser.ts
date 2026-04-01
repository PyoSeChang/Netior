export interface FileLink {
  path: string;
  line?: number;
  col?: number;
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
  // Windows absolute: C:\...\file.ext[:line[:col]]  or  C:\...\file.ext(line,col)
  /([A-Za-z]:\\[^\s:*?"<>|]+\.\w+)(?:\((\d+),\s*(\d+)\)|:(\d+)(?::(\d+))?)?/g,
  // Unix absolute: /path/to/file.ext[:line[:col]]
  /(\/[^\s:*?"<>|]+\.\w+)(?::(\d+)(?::(\d+))?)?/g,
  // Relative: ./path or path/to/file.ext[:line[:col]]  (must contain / or \)
  /(\.?\.?[/\\][^\s:*?"<>|]*\.\w+)(?:\((\d+),\s*(\d+)\)|:(\d+)(?::(\d+))?)?/g,
];

/**
 * Extract file links from a line of terminal text.
 * Returns all matches with their character ranges.
 */
export function extractFileLinks(text: string): Array<FileLink & { start: number; end: number }> {
  const results: Array<FileLink & { start: number; end: number }> = [];
  const seen = new Set<number>();

  for (const pattern of FILE_LINK_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      if (seen.has(start)) continue;
      seen.add(start);

      const path = match[1];
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

  return results.sort((a, b) => a.start - b.start);
}

/**
 * Find the file link at a specific column position in a line.
 */
export function extractFileLink(text: string, col: number): FileLink | null {
  const links = extractFileLinks(text);
  for (const link of links) {
    if (col >= link.start && col <= link.end) {
      return { path: link.path, line: link.line, col: link.col };
    }
  }
  return null;
}
