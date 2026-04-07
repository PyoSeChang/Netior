import type Database from 'better-sqlite3';

export function migrate010(db: Database.Database): void {
  // Rename tables
  db.exec(`ALTER TABLE canvases RENAME TO networks`);
  db.exec(`ALTER TABLE canvas_nodes RENAME TO network_nodes`);

  // Drop canvas_type tables
  db.exec(`DROP TABLE IF EXISTS canvas_type_allowed_relations`);
  db.exec(`DROP TABLE IF EXISTS canvas_types`);

  // Rename columns
  db.exec(`ALTER TABLE edges RENAME COLUMN canvas_id TO network_id`);
  db.exec(`ALTER TABLE network_nodes RENAME COLUMN canvas_id TO network_id`);

  // Drop canvas_type_id column from networks
  db.exec(`ALTER TABLE networks DROP COLUMN canvas_type_id`);

  // Recreate index
  db.exec(`DROP INDEX IF EXISTS idx_canvas_nodes_concept`);
  db.exec(`
    CREATE UNIQUE INDEX idx_network_nodes_concept
      ON network_nodes(network_id, concept_id) WHERE concept_id IS NOT NULL
  `);
}
