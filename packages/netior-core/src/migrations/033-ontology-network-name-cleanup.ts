import type Database from 'better-sqlite3';

function tableExists(db: Database.Database, table: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return !!row;
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  if (!tableExists(db, table)) return false;
  const columns = db.pragma(`table_info(${table})`) as { name: string }[];
  return columns.some((entry) => entry.name === column);
}

export function migrate033(db: Database.Database): void {
  if (!hasColumn(db, 'networks', 'kind')) {
    return;
  }

  db.exec(`
    UPDATE networks
       SET name = 'Ontology',
           scope = 'project',
           parent_network_id = NULL,
           updated_at = datetime('now')
     WHERE kind = 'ontology'
       AND scope = 'project'
  `);

  db.exec(`
    UPDATE networks
       SET kind = 'ontology',
           name = 'Ontology',
           scope = 'project',
           parent_network_id = NULL,
           updated_at = datetime('now')
     WHERE scope = 'project'
       AND project_id IS NOT NULL
       AND kind = 'network'
       AND parent_network_id IN (SELECT id FROM networks WHERE kind = 'universe')
       AND NOT EXISTS (SELECT 1 FROM network_nodes nn WHERE nn.network_id = networks.id)
       AND NOT EXISTS (SELECT 1 FROM edges e WHERE e.network_id = networks.id)
       AND NOT EXISTS (
         SELECT 1
           FROM networks existing
          WHERE existing.project_id = networks.project_id
            AND existing.kind = 'ontology'
            AND existing.id <> networks.id
       )
  `);
}
