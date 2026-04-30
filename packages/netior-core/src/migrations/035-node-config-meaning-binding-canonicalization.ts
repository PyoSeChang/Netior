import type Database from 'better-sqlite3';

interface NetworkNodeMetadataRow {
  id: string;
  metadata: string | null;
}

const SLOT_TO_FIELD_MEANING: Record<string, string> = {
  start_at: 'time.start',
  end_at: 'time.end',
  all_day: 'time.all_day',
  timezone: 'time.timezone',
  due_at: 'time.due',
  recurrence_rule: 'time.recurrence_rule',
  recurrence_frequency: 'time.recurrence_frequency',
  recurrence_interval: 'time.recurrence_interval',
  recurrence_weekdays: 'time.recurrence_weekdays',
  recurrence_monthday: 'time.recurrence_monthday',
  recurrence_until: 'time.recurrence_until',
  recurrence_count: 'time.recurrence_count',
  status: 'workflow.status',
  status_changed_at: 'workflow.status_changed_at',
  assignee_refs: 'workflow.assignees',
  primary_assignee_ref: 'workflow.primary_assignee',
  priority: 'workflow.priority',
  progress_ratio: 'workflow.progress',
  completed_at: 'workflow.completed_at',
  estimate_value: 'workflow.estimate_value',
  estimate_unit: 'workflow.estimate_unit',
  actual_value: 'workflow.actual_value',
  parent_ref: 'structure.parent',
  order_index: 'structure.order',
  tag_keys: 'structure.tags',
  category_key: 'structure.category',
  source_url: 'knowledge.source_url',
  source_ref: 'knowledge.source_ref',
  citation: 'knowledge.citation',
  attachment_refs: 'knowledge.attachments',
  version: 'knowledge.version',
  revision: 'knowledge.revision',
  supersedes_ref: 'knowledge.supersedes',
  place_ref: 'space.place',
  address: 'space.address',
  lat: 'space.lat',
  lng: 'space.lng',
  measure_value: 'quant.measure_value',
  measure_unit: 'quant.measure_unit',
  target_value: 'quant.target_value',
  budget_amount: 'quant.budget_amount',
  budget_currency: 'quant.budget_currency',
  budget_limit: 'quant.budget_limit',
  owner_ref: 'governance.owner',
  approval_state: 'governance.approval_state',
  approved_by_ref: 'governance.approved_by',
  approved_at: 'governance.approved_at',
};

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
  return Boolean(row);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSort(sort: unknown): { sort: unknown; changed: boolean } {
  if (!isRecord(sort) || typeof sort.kind !== 'string') return { sort, changed: false };

  let meaning: string | null = null;
  if (sort.kind === 'meaning_slot' && typeof sort.slot === 'string') {
    meaning = SLOT_TO_FIELD_MEANING[sort.slot] ?? null;
  } else if (sort.kind === 'meaning_key' && typeof sort.annotation === 'string') {
    meaning = sort.annotation;
  } else if (sort.kind === 'semantic_role' && typeof sort.role === 'string') {
    meaning = sort.role;
  } else if (sort.kind === 'semantic_aspect' && typeof sort.aspect === 'string') {
    meaning = sort.aspect;
  }

  if (!meaning || !meaning.trim()) return { sort, changed: false };

  return {
    sort: {
      kind: 'meaning_binding',
      meaning,
      direction: sort.direction,
      emptyPlacement: sort.emptyPlacement,
    },
    changed: true,
  };
}

function normalizeMetadata(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const metadata = JSON.parse(raw) as unknown;
    if (!isRecord(metadata) || !isRecord(metadata.nodeConfig)) return raw;
    const { sort, changed } = normalizeSort(metadata.nodeConfig.sort);
    if (!changed) return raw;
    return JSON.stringify({
      ...metadata,
      nodeConfig: {
        ...metadata.nodeConfig,
        sort,
      },
    });
  } catch {
    return raw;
  }
}

export function migrate035(db: Database.Database): void {
  if (!tableExists(db, 'network_nodes')) return;

  const rows = db.prepare(
    `SELECT id, metadata FROM network_nodes WHERE metadata IS NOT NULL AND metadata <> ''`,
  ).all() as NetworkNodeMetadataRow[];
  const update = db.prepare('UPDATE network_nodes SET metadata = ? WHERE id = ?');

  for (const row of rows) {
    const nextMetadata = normalizeMetadata(row.metadata);
    if (nextMetadata !== row.metadata) {
      update.run(nextMetadata, row.id);
    }
  }
}
