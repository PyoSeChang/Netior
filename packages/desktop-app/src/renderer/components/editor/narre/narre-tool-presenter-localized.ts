import {
  getNetiorMcpToolSpec,
  getNarreToolMetadata,
  normalizeNetiorToolName,
} from '@netior/shared/constants';
import { translate, type Locale, type TranslationKey } from '@netior/shared/i18n';
import type { NarreToolCall, NarreToolCategory } from '@netior/shared/types';

const COUNT_NOUNS: Record<string, { ko: string; en: string }> = {
  list_concepts: { ko: '개념', en: 'concept' },
  list_archetypes: { ko: '아키타입', en: 'archetype' },
  list_relation_types: { ko: '관계 유형', en: 'relation type' },
  list_networks: { ko: '네트워크', en: 'network' },
  list_modules: { ko: '모듈', en: 'module' },
  list_type_groups: { ko: '타입 그룹', en: 'type group' },
  list_archetype_fields: { ko: '필드', en: 'field' },
  glob_files: { ko: '파일', en: 'file' },
  grep_files: { ko: '일치 항목', en: 'match' },
  list_directory: { ko: '항목', en: 'entry' },
};

function resolveLocale(locale: string): Locale {
  return locale.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function translateOrNull(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string | null {
  const translated = translate(locale, key as TranslationKey, params);
  return translated === key ? null : translated;
}

function trimErrorPrefix(value: string): string {
  return value.replace(/^Error:\s*/i, '').trim();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function looksLikeUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function preferReadableLabel(...values: unknown[]): string | null {
  for (const value of values) {
    const candidate = asNonEmptyString(value);
    if (!candidate || looksLikeUuid(candidate)) {
      continue;
    }
    return candidate;
  }

  return null;
}

function basename(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const normalized = value.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  return segments.at(-1) ?? normalized;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseResultPayload(raw: string | undefined): unknown | null {
  if (!raw || raw.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function formatCount(count: number, label: { ko: string; en: string }, locale: Locale): string {
  if (locale === 'ko') {
    return `${label.ko} ${count}개`;
  }

  return `${count} ${label.en}${count === 1 ? '' : 's'}`;
}

function formatDefaultCompletion(label: string, locale: Locale): string {
  return locale === 'ko'
    ? `${label}을 완료했습니다`
    : `${label} completed`;
}

function summarizeProjectSummary(
  payload: unknown,
  input: Record<string, unknown>,
  locale: Locale,
): string | null {
  const parsed = asRecord(payload);
  const project = asRecord(parsed?.project);
  const projectName = preferReadableLabel(project?.name, input.project_name, input.project_id);
  const conceptCount = asNumber(asRecord(parsed?.concepts)?.count);
  const networkCount = asNumber(asRecord(parsed?.networks)?.count);
  const archetypeCount = asNumber(asRecord(parsed?.archetypes)?.count);

  if (locale === 'ko') {
    const parts = [
      archetypeCount !== null ? `아키타입 ${archetypeCount}개` : null,
      conceptCount !== null ? `개념 ${conceptCount}개` : null,
      networkCount !== null ? `네트워크 ${networkCount}개` : null,
    ].filter((part): part is string => Boolean(part));
    if (projectName && parts.length > 0) {
      return `${projectName} 프로젝트 정보를 가져왔습니다 · ${parts.join(' · ')}`;
    }
    if (projectName) {
      return `${projectName} 프로젝트 정보를 가져왔습니다`;
    }
    if (parts.length > 0) {
      return `프로젝트 정보를 가져왔습니다 · ${parts.join(' · ')}`;
    }
    return '프로젝트 정보를 가져왔습니다';
  }

  return projectName ? `Loaded project summary for ${projectName}` : 'Loaded project summary';
}

function summarizeReadPdfPages(
  toolKey: string,
  payload: unknown,
  input: Record<string, unknown>,
  locale: Locale,
): string | null {
  const fileName = basename(input.file_path);
  const startPage = asNumber(input.start_page);
  const endPage = asNumber(input.end_page);
  const parsed = asRecord(payload);
  const pages = Array.isArray(parsed?.pages) ? parsed.pages.length : null;

  if (locale === 'ko') {
    const range = startPage !== null && endPage !== null ? `${startPage}-${endPage}페이지` : null;
    const base = toolKey === 'read_pdf_pages_vision' ? 'PDF 페이지 이미지를 읽었습니다' : 'PDF 페이지를 읽었습니다';
    if (fileName && range) {
      return `${fileName} ${range}를 읽었습니다`;
    }
    if (fileName && pages !== null) {
      return `${fileName}에서 ${pages}페이지를 읽었습니다`;
    }
    return base;
  }

  if (fileName && startPage !== null && endPage !== null) {
    return `Read ${fileName} pages ${startPage}-${endPage}`;
  }

  return toolKey === 'read_pdf_pages_vision' ? 'Read PDF pages with vision' : 'Read PDF pages';
}

function summarizeReadFile(
  payload: unknown,
  input: Record<string, unknown>,
  locale: Locale,
): string | null {
  const parsed = asRecord(payload);
  const fileName = basename(input.file_path);
  const totalLines = asNumber(parsed?.totalLines);

  if (locale === 'ko') {
    if (fileName && totalLines !== null) {
      return `${fileName} 파일을 읽었습니다 · ${totalLines}줄`;
    }
    if (fileName) {
      return `${fileName} 파일을 읽었습니다`;
    }
    return '파일을 읽었습니다';
  }

  if (fileName && totalLines !== null) {
    return `Read ${fileName} (${totalLines} lines)`;
  }

  return fileName ? `Read ${fileName}` : 'Read file';
}

function summarizeListDirectory(
  payload: unknown,
  input: Record<string, unknown>,
  locale: Locale,
): string | null {
  if (!Array.isArray(payload)) {
    return null;
  }

  const dirName = basename(input.dir_path);
  if (locale === 'ko') {
    return dirName
      ? `${dirName} 폴더에서 항목 ${payload.length}개를 찾았습니다`
      : `폴더 항목 ${payload.length}개를 찾았습니다`;
  }

  return dirName
    ? `Found ${payload.length} entries in ${dirName}`
    : `Found ${payload.length} directory entries`;
}

function summarizeSearchResults(
  toolKey: string,
  payload: unknown,
  locale: Locale,
): string | null {
  if (!Array.isArray(payload)) {
    return null;
  }

  const noun = COUNT_NOUNS[toolKey];
  if (!noun) {
    return null;
  }

  if (locale === 'ko') {
    return `${noun.ko} ${payload.length}개를 찾았습니다`;
  }

  return `Found ${formatCount(payload.length, noun, locale)}`;
}

function summarizeFileMetadata(
  payload: unknown,
  locale: Locale,
): string | null {
  const parsed = asRecord(payload);
  const fileName = basename(parsed?.path);
  if (locale === 'ko') {
    return fileName ? `${fileName} 메타데이터를 가져왔습니다` : '파일 메타데이터를 가져왔습니다';
  }

  return fileName ? `Loaded metadata for ${fileName}` : 'Loaded file metadata';
}

function summarizeUpdatedPdfToc(
  payload: unknown,
  locale: Locale,
): string | null {
  const parsed = asRecord(payload);
  const entriesCount = asNumber(parsed?.entries_count);
  if (locale === 'ko') {
    return entriesCount !== null
      ? `PDF 목차 ${entriesCount}개 항목을 저장했습니다`
      : 'PDF 목차를 저장했습니다';
  }

  return entriesCount !== null
    ? `Saved ${entriesCount} PDF TOC entries`
    : 'Saved PDF table of contents';
}

function summarizeGenericSuccess(
  toolKey: string,
  payload: unknown,
  input: Record<string, unknown>,
  locale: Locale,
): string {
  switch (toolKey) {
    case 'get_project_summary':
      return summarizeProjectSummary(payload, input, locale) ?? formatDefaultCompletion(getLocalizedToolLabel(toolKey, locale), locale);
    case 'read_pdf_pages':
    case 'read_pdf_pages_vision':
      return summarizeReadPdfPages(toolKey, payload, input, locale) ?? formatDefaultCompletion(getLocalizedToolLabel(toolKey, locale), locale);
    case 'read_file':
      return summarizeReadFile(payload, input, locale) ?? formatDefaultCompletion(getLocalizedToolLabel(toolKey, locale), locale);
    case 'list_directory':
      return summarizeListDirectory(payload, input, locale) ?? formatDefaultCompletion(getLocalizedToolLabel(toolKey, locale), locale);
    case 'get_file_metadata':
      return summarizeFileMetadata(payload, locale) ?? formatDefaultCompletion(getLocalizedToolLabel(toolKey, locale), locale);
    case 'update_file_pdf_toc':
      return summarizeUpdatedPdfToc(payload, locale) ?? formatDefaultCompletion(getLocalizedToolLabel(toolKey, locale), locale);
    default:
      break;
  }

  const searchSummary = summarizeSearchResults(toolKey, payload, locale);
  if (searchSummary) {
    return searchSummary;
  }

  const parsed = asRecord(payload);
  const count = asNumber(parsed?.count);
  if (count !== null) {
    if (locale === 'ko') {
      return `${getLocalizedToolLabel(toolKey, locale)} 결과 ${count}개를 확인했습니다`;
    }
    return `${getLocalizedToolLabel(toolKey, locale)} returned ${count} items`;
  }

  if (Array.isArray(payload)) {
    if (locale === 'ko') {
      return `${getLocalizedToolLabel(toolKey, locale)} 결과 ${payload.length}개를 확인했습니다`;
    }
    return `${getLocalizedToolLabel(toolKey, locale)} returned ${payload.length} items`;
  }

  return formatDefaultCompletion(getLocalizedToolLabel(toolKey, locale), locale);
}

function summarizeToolError(
  error: string | undefined,
  locale: Locale,
): string | null {
  if (!error) {
    return null;
  }

  const message = trimErrorPrefix(error);

  if (/^Project not found:\s*(.+)$/i.test(message)) {
    const [, projectId] = message.match(/^Project not found:\s*(.+)$/i) ?? [];
    return locale === 'ko'
      ? `\`${projectId}\` 프로젝트를 찾지 못했습니다`
      : `Project \`${projectId}\` was not found`;
  }

  if (/^Concept not found:\s*(.+)$/i.test(message)) {
    const [, conceptId] = message.match(/^Concept not found:\s*(.+)$/i) ?? [];
    return locale === 'ko'
      ? `개념 \`${conceptId}\`를 찾지 못했습니다`
      : `Concept \`${conceptId}\` was not found`;
  }

  if (/^File entity not found:\s*(.+)$/i.test(message)) {
    const [, fileId] = message.match(/^File entity not found:\s*(.+)$/i) ?? [];
    return locale === 'ko'
      ? `파일 항목 \`${fileId}\`를 찾지 못했습니다`
      : `File entity \`${fileId}\` was not found`;
  }

  if (message.includes('resources/list failed') && message.includes('-32601')) {
    return locale === 'ko'
      ? '이 MCP 서버는 리소스 목록 조회를 지원하지 않습니다'
      : 'This MCP server does not support resource listing';
  }

  if (message.includes('resources/templates/list failed') && message.includes('-32601')) {
    return locale === 'ko'
      ? '이 MCP 서버는 리소스 템플릿 조회를 지원하지 않습니다'
      : 'This MCP server does not support resource template listing';
  }

  if (message === 'No module paths registered for this project') {
    return locale === 'ko'
      ? '이 프로젝트에 등록된 모듈 경로가 없습니다'
      : 'No module paths are registered for this project';
  }

  if (message === 'end_page must be >= start_page') {
    return locale === 'ko'
      ? '끝 페이지는 시작 페이지보다 뒤여야 합니다'
      : 'End page must be greater than or equal to start page';
  }

  if (message.includes('Requested range') && message.includes('out of bounds')) {
    return locale === 'ko'
      ? '요청한 PDF 페이지 범위가 문서 범위를 벗어났습니다'
      : 'The requested PDF page range is out of bounds';
  }

  if (message.includes('canvas')) {
    return locale === 'ko'
      ? '비전 PDF 읽기에는 canvas 패키지가 필요합니다'
      : 'Vision PDF reading requires the canvas package';
  }

  return message;
}

export function getLocalizedToolLabel(
  toolName: string,
  locale: string,
  fallbackDisplayName?: string,
): string {
  const resolvedLocale = resolveLocale(locale);
  const normalizedToolName = normalizeNetiorToolName(toolName);
  const translated = translateOrNull(
    resolvedLocale,
    `narre.toolLabel.${snakeToCamel(normalizedToolName)}`,
  );
  if (translated) {
    return translated;
  }

  const spec = getNetiorMcpToolSpec(normalizedToolName);
  if (spec?.displayName) {
    return spec.displayName;
  }

  return fallbackDisplayName ?? getNarreToolMetadata(normalizedToolName).displayName;
}

export function getLocalizedToolCategoryLabel(category: NarreToolCategory, locale: string): string {
  return translate(
    resolveLocale(locale),
    `narre.toolCategory.${category}` as TranslationKey,
  );
}

export function getLocalizedToolWriteLabel(locale: string): string {
  return translate(resolveLocale(locale), 'narre.toolWrite');
}

export function getToolResultSummary(call: NarreToolCall, locale: string): string | null {
  const resolvedLocale = resolveLocale(locale);
  const normalizedToolName = normalizeNetiorToolName(call.tool);

  if (call.status === 'error') {
    return summarizeToolError(call.error ?? call.result, resolvedLocale);
  }

  if (call.status !== 'success') {
    return null;
  }

  const payload = parseResultPayload(call.result);
  return summarizeGenericSuccess(normalizedToolName, payload, call.input, resolvedLocale);
}
