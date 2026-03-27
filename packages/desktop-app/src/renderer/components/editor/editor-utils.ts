export type EditorType = 'code' | 'image' | 'pdf' | 'unsupported';

const EDITOR_MAP: Record<string, EditorType> = {
  md: 'code', mdx: 'code',
  txt: 'code', json: 'code', yaml: 'code', yml: 'code',
  csv: 'code', xml: 'code', html: 'code', css: 'code',
  js: 'code', ts: 'code', tsx: 'code', jsx: 'code',
  py: 'code', rb: 'code', go: 'code', rs: 'code', sh: 'code',
  toml: 'code', ini: 'code', env: 'code', gitignore: 'code',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', svg: 'image', webp: 'image',
  pdf: 'pdf',
};

export function getEditorType(filePath: string): EditorType {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return EDITOR_MAP[ext] ?? 'unsupported';
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
