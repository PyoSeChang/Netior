import type Database from 'better-sqlite3';

export function migrate012(db: Database.Database): void {
  // ── objects table ──
  db.exec(`
    CREATE TABLE objects (
      id          TEXT PRIMARY KEY,
      object_type TEXT NOT NULL,
      scope       TEXT NOT NULL,
      project_id  TEXT,
      ref_id      TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
  db.exec(`CREATE UNIQUE INDEX idx_objects_ref ON objects(object_type, ref_id)`);

  // ── Rebuild network_nodes: remove concept_id/file_id, add object_id/node_type/parent_node_id ──
  db.exec(`
    CREATE TABLE network_nodes_new (
      id             TEXT PRIMARY KEY,
      network_id     TEXT NOT NULL,
      object_id      TEXT NOT NULL,
      node_type      TEXT NOT NULL DEFAULT 'basic',
      parent_node_id TEXT,
      metadata       TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (network_id) REFERENCES networks(id) ON DELETE CASCADE,
      FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_node_id) REFERENCES network_nodes_new(id) ON DELETE SET NULL
    )
  `);

  // Migrate existing nodes: create object records for each concept/file node, then insert into new table
  const existingNodes = db.prepare('SELECT * FROM network_nodes').all() as {
    id: string; network_id: string; concept_id: string | null; file_id: string | null; metadata: string | null;
  }[];

  const insertObject = db.prepare(
    `INSERT INTO objects (id, object_type, scope, project_id, ref_id, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
  );
  const insertNode = db.prepare(
    `INSERT INTO network_nodes_new (id, network_id, object_id, node_type, parent_node_id, metadata, created_at, updated_at)
     VALUES (?, ?, ?, 'basic', NULL, ?, datetime('now'), datetime('now'))`,
  );

  // Look up project_id from the network
  const getNetworkProject = db.prepare('SELECT project_id FROM networks WHERE id = ?');

  for (const node of existingNodes) {
    const network = getNetworkProject.get(node.network_id) as { project_id: string | null } | undefined;
    const projectId = network?.project_id ?? null;

    if (node.concept_id) {
      // Check if object already exists for this concept
      const existing = db.prepare('SELECT id FROM objects WHERE object_type = ? AND ref_id = ?').get('concept', node.concept_id) as { id: string } | undefined;
      const objectId = existing?.id ?? node.concept_id + '-obj';
      if (!existing) {
        insertObject.run(objectId, 'concept', 'project', projectId, node.concept_id);
      }
      insertNode.run(node.id, node.network_id, objectId, node.metadata);
    } else if (node.file_id) {
      const existing = db.prepare('SELECT id FROM objects WHERE object_type = ? AND ref_id = ?').get('file', node.file_id) as { id: string } | undefined;
      const objectId = existing?.id ?? node.file_id + '-obj';
      if (!existing) {
        insertObject.run(objectId, 'file', 'project', projectId, node.file_id);
      }
      insertNode.run(node.id, node.network_id, objectId, node.metadata);
    }
  }

  // Drop old layout_nodes/layout_edges that reference network_nodes (FK),
  // then drop network_nodes, rename new
  db.exec(`DELETE FROM layout_nodes WHERE node_id NOT IN (SELECT id FROM network_nodes_new)`);
  db.exec(`DROP TABLE network_nodes`);
  db.exec(`ALTER TABLE network_nodes_new RENAME TO network_nodes`);
  db.exec(`CREATE UNIQUE INDEX idx_network_nodes_object ON network_nodes(network_id, object_id)`);
}
