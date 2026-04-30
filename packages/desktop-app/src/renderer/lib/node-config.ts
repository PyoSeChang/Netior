import type {
  FieldMeaningBindingKey,
  NodeConfig,
  NodeConfigKind,
  NodeSortConfig,
  NodeSortDirection,
  NodeSortEmptyPlacement,
} from '@netior/shared/types';

export const NODE_CONFIG_METADATA_KEY = 'nodeConfig';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeDirection(value: unknown): NodeSortDirection | undefined {
  return value === 'asc' || value === 'desc' ? value : undefined;
}

function normalizeEmptyPlacement(value: unknown): NodeSortEmptyPlacement | undefined {
  return value === 'first' || value === 'last' ? value : undefined;
}

function normalizeSortConfig(raw: unknown): NodeSortConfig | null {
  if (!isRecord(raw) || typeof raw.kind !== 'string') return null;

  if (raw.kind === 'meaning_binding' && typeof raw.meaning === 'string' && raw.meaning.trim() !== '') {
    return {
      kind: 'meaning_binding',
      meaning: raw.meaning as FieldMeaningBindingKey,
      direction: normalizeDirection(raw.direction),
      emptyPlacement: normalizeEmptyPlacement(raw.emptyPlacement),
    };
  }

  if (raw.kind === 'property' && typeof raw.fieldId === 'string' && raw.fieldId.trim() !== '') {
    return {
      kind: 'property',
      fieldId: raw.fieldId,
      direction: normalizeDirection(raw.direction),
      emptyPlacement: normalizeEmptyPlacement(raw.emptyPlacement),
    };
  }

  return null;
}

function normalizeNodeConfigByKind(
  raw: Record<string, unknown>,
  kind: NodeConfigKind,
  sort: NodeSortConfig | null,
): NodeConfig {
  if (kind === 'freeform') {
    return { kind: 'freeform' };
  }

  if (kind === 'grid') {
    return {
      kind: 'grid',
      columns: normalizeNumber(raw.columns),
      gapX: normalizeNumber(raw.gapX),
      gapY: normalizeNumber(raw.gapY),
      padding: normalizeNumber(raw.padding),
      itemWidth: normalizeNumber(raw.itemWidth),
      itemHeight: normalizeNumber(raw.itemHeight),
      sort,
    };
  }

  return {
    kind: 'list',
    gap: normalizeNumber(raw.gap),
    padding: normalizeNumber(raw.padding),
    itemHeight: normalizeNumber(raw.itemHeight),
    sort,
  };
}

export function parseNodeMetadataObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value || !value.trim()) return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function stringifyNodeMetadataObject(metadata: Record<string, unknown>): string {
  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata, null, 2) : '';
}

export function normalizeNodeConfig(raw: unknown): NodeConfig | null {
  if (!isRecord(raw) || typeof raw.kind !== 'string') return null;

  // Backward compatibility for the temporary wrapper shape:
  // { kind: 'collection', layout: { kind: 'grid' | 'list' | 'freeform', ... }, sort }
  if (raw.kind === 'collection') {
    if (!isRecord(raw.layout) || typeof raw.layout.kind !== 'string') return null;
    if (raw.layout.kind !== 'freeform' && raw.layout.kind !== 'grid' && raw.layout.kind !== 'list') {
      return null;
    }
    return normalizeNodeConfigByKind(
      raw.layout,
      raw.layout.kind,
      normalizeSortConfig(raw.sort) ?? null,
    );
  }

  if (raw.kind !== 'freeform' && raw.kind !== 'grid' && raw.kind !== 'list') return null;

  return normalizeNodeConfigByKind(
    raw,
    raw.kind,
    normalizeSortConfig(raw.sort) ?? null,
  );
}

export function extractNodeConfig(metadata: Record<string, unknown> | null | undefined): NodeConfig | null {
  if (!metadata) return null;
  return normalizeNodeConfig(metadata[NODE_CONFIG_METADATA_KEY]);
}

export function upsertNodeConfigMetadata(
  metadata: Record<string, unknown>,
  nodeConfig: NodeConfig | null,
): Record<string, unknown> {
  const next = { ...metadata };
  if (nodeConfig) {
    next[NODE_CONFIG_METADATA_KEY] = nodeConfig;
  } else {
    delete next[NODE_CONFIG_METADATA_KEY];
  }
  return next;
}

export function createDefaultNodeConfig(kind: NodeConfigKind = 'grid'): NodeConfig {
  if (kind === 'freeform') {
    return { kind: 'freeform' };
  }

  if (kind === 'grid') {
    return {
      kind: 'grid',
      columns: 2,
      gapX: 16,
      gapY: 16,
      padding: 24,
      itemWidth: 160,
      itemHeight: 60,
      sort: null,
    };
  }

  return {
    kind: 'list',
    gap: 12,
    padding: 24,
    itemHeight: 60,
    sort: null,
  };
}
