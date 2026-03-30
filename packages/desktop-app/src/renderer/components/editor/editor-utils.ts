export type EditorType = 'code' | 'markdown' | 'image' | 'pdf' | 'unsupported';

/** 1:N mapping — first element is the default editor for the extension */
const EDITOR_MAP: Record<string, EditorType[]> = {
  md: ['markdown', 'code'], mdx: ['markdown', 'code'],
  txt: ['code'], json: ['code'], yaml: ['code'], yml: ['code'],
  csv: ['code'], xml: ['code'], html: ['code'], css: ['code'],
  js: ['code'], ts: ['code'], tsx: ['code'], jsx: ['code'],
  py: ['code'], rb: ['code'], go: ['code'], rs: ['code'], sh: ['code'],
  toml: ['code'], ini: ['code'], env: ['code'], gitignore: ['code'],
  png: ['image'], jpg: ['image'], jpeg: ['image'], gif: ['image'], svg: ['image'], webp: ['image'],
  pdf: ['pdf'],
};

/** Display labels for editor types (used in context menus) */
export const EDITOR_LABELS: Record<EditorType, string> = {
  markdown: 'Markdown Editor',
  code: 'Code Editor',
  image: 'Image Viewer',
  pdf: 'PDF Viewer',
  unsupported: 'Unsupported',
};

export function getEditorType(filePath: string): EditorType {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return EDITOR_MAP[ext]?.[0] ?? 'unsupported';
}

export function getAvailableEditors(filePath: string): EditorType[] {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return EDITOR_MAP[ext] ?? ['unsupported'];
}

const LANGUAGE_MAP: Record<string, string> = {
  md: 'markdown', mdx: 'markdown',
  js: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  json: 'json',
  yaml: 'yaml', yml: 'yaml',
  xml: 'xml', svg: 'xml',
  html: 'html', htm: 'html',
  css: 'css',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  sh: 'shell',
  toml: 'toml',
  ini: 'ini',
  csv: 'plaintext',
  txt: 'plaintext',
};

export function getMonacoLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return LANGUAGE_MAP[ext] ?? 'plaintext';
}

/**
 * Read a CSS custom property's computed value and return it as a hex color.
 * Falls back to `fallback` if the property is empty or conversion fails.
 */
export function getCssColorAsHex(property: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(property).trim();
  if (!raw) return fallback;

  // Already hex
  if (raw.startsWith('#')) return raw;

  // Use an off-screen element to resolve any CSS color string to rgb
  const el = document.createElement('div');
  el.style.color = raw;
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  document.body.removeChild(el);

  const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return fallback;

  const [, r, g, b] = match;
  return `#${Number(r).toString(16).padStart(2, '0')}${Number(g).toString(16).padStart(2, '0')}${Number(b).toString(16).padStart(2, '0')}`;
}
