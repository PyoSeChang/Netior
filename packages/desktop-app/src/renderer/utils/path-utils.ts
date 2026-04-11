/**
 * Renderer-side path utilities.
 * Since Node's `path` module is not available in the renderer,
 * these operate on normalized forward-slash paths.
 */

/** Normalize a path to forward slashes and strip trailing slash. */
export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/$/, '');
}

/**
 * Convert an absolute path to a path relative to rootDir.
 * Returns the original path if it's not under rootDir.
 */
export function toRelativePath(rootDir: string, absolutePath: string): string {
  const root = normalizePath(rootDir);
  const abs = normalizePath(absolutePath);
  const prefix = root + '/';
  if (abs.startsWith(prefix)) {
    return abs.slice(prefix.length);
  }
  if (abs === root) {
    return '';
  }
  return abs;
}

/**
 * Convert a relative path (from project root) to an absolute path.
 * If the input is already absolute, return it normalized.
 * Both inputs are normalized to forward slashes.
 */
export function toAbsolutePath(rootDir: string, relativePath: string): string {
  const root = normalizePath(rootDir);
  const normalizedPath = normalizePath(relativePath);

  if (/^(?:[A-Za-z]:\/|\/|\/\/)/.test(normalizedPath)) {
    return normalizedPath;
  }

  const rel = normalizedPath.replace(/^\//, '');
  return root ? `${root}/${rel}` : rel;
}
