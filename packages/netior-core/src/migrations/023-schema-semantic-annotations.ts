import type Database from 'better-sqlite3';

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const columns = db.pragma(`table_info(${table})`) as { name: string }[];
  return columns.some((entry) => entry.name === column);
}

export function migrate023(db: Database.Database): void {
  if (!hasColumn(db, 'archetypes', 'facets')) {
    db.exec(`ALTER TABLE archetypes ADD COLUMN facets TEXT NOT NULL DEFAULT '[]'`);
    db.exec(`
      UPDATE archetypes
         SET facets = COALESCE(NULLIF(semantic_traits, ''), '[]')
       WHERE facets = '[]'
    `);
  }

  if (!hasColumn(db, 'archetype_fields', 'semantic_annotation')) {
    db.exec('ALTER TABLE archetype_fields ADD COLUMN semantic_annotation TEXT');
    db.exec(`
      UPDATE archetype_fields
         SET semantic_annotation = CASE system_slot
           WHEN 'start_at' THEN 'time.start'
           WHEN 'end_at' THEN 'time.end'
           WHEN 'all_day' THEN 'time.all_day'
           WHEN 'timezone' THEN 'time.timezone'
           WHEN 'due_at' THEN 'time.due'
           WHEN 'recurrence_rule' THEN 'time.recurrence_rule'
           WHEN 'recurrence_until' THEN 'time.recurrence_until'
           WHEN 'recurrence_count' THEN 'time.recurrence_count'
           WHEN 'status' THEN 'workflow.status'
           WHEN 'status_changed_at' THEN 'workflow.status_changed_at'
           WHEN 'assignee_refs' THEN 'workflow.assignees'
           WHEN 'primary_assignee_ref' THEN 'workflow.primary_assignee'
           WHEN 'priority' THEN 'workflow.priority'
           WHEN 'progress_ratio' THEN 'workflow.progress'
           WHEN 'completed_at' THEN 'workflow.completed_at'
           WHEN 'estimate_value' THEN 'workflow.estimate_value'
           WHEN 'estimate_unit' THEN 'workflow.estimate_unit'
           WHEN 'actual_value' THEN 'workflow.actual_value'
           WHEN 'parent_ref' THEN 'structure.parent'
           WHEN 'order_index' THEN 'structure.order'
           WHEN 'tag_keys' THEN 'structure.tags'
           WHEN 'category_key' THEN 'structure.category'
           WHEN 'source_url' THEN 'knowledge.source_url'
           WHEN 'source_ref' THEN 'knowledge.source_ref'
           WHEN 'citation' THEN 'knowledge.citation'
           WHEN 'attachment_refs' THEN 'knowledge.attachments'
           WHEN 'version' THEN 'knowledge.version'
           WHEN 'revision' THEN 'knowledge.revision'
           WHEN 'supersedes_ref' THEN 'knowledge.supersedes'
           WHEN 'place_ref' THEN 'space.place'
           WHEN 'address' THEN 'space.address'
           WHEN 'lat' THEN 'space.lat'
           WHEN 'lng' THEN 'space.lng'
           WHEN 'measure_value' THEN 'quant.measure_value'
           WHEN 'measure_unit' THEN 'quant.measure_unit'
           WHEN 'target_value' THEN 'quant.target_value'
           WHEN 'budget_amount' THEN 'quant.budget_amount'
           WHEN 'budget_currency' THEN 'quant.budget_currency'
           WHEN 'budget_limit' THEN 'quant.budget_limit'
           WHEN 'owner_ref' THEN 'governance.owner'
           WHEN 'approval_state' THEN 'governance.approval_state'
           WHEN 'approved_by_ref' THEN 'governance.approved_by'
           WHEN 'approved_at' THEN 'governance.approved_at'
           ELSE semantic_annotation
         END
       WHERE system_slot IS NOT NULL
    `);
  }

  if (!hasColumn(db, 'edges', 'semantic_annotation')) {
    db.exec('ALTER TABLE edges ADD COLUMN semantic_annotation TEXT');
    db.exec(`
      UPDATE edges
         SET semantic_annotation = CASE system_contract
           WHEN 'core:contains' THEN 'structure.contains'
           WHEN 'core:entry_portal' THEN 'structure.entry_portal'
           WHEN 'core:hierarchy_parent' THEN 'structure.parent'
           ELSE semantic_annotation
         END
       WHERE system_contract IS NOT NULL
    `);
  }
}
