import type Database from 'better-sqlite3';

export function migrate016(db: Database.Database): void {
  db.exec(`
    INSERT INTO objects (id, object_type, scope, project_id, ref_id, created_at)
    SELECT 'object-project-' || p.id, 'project', 'app', NULL, p.id, p.created_at
      FROM projects p
     WHERE NOT EXISTS (
       SELECT 1 FROM objects o WHERE o.object_type = 'project' AND o.ref_id = p.id
     )
  `);

  db.exec(`
    INSERT INTO objects (id, object_type, scope, project_id, ref_id, created_at)
    SELECT 'object-network-' || n.id, 'network', n.scope, n.project_id, n.id, n.created_at
      FROM networks n
     WHERE NOT EXISTS (
       SELECT 1 FROM objects o WHERE o.object_type = 'network' AND o.ref_id = n.id
     )
  `);

  db.exec(`
    INSERT INTO objects (id, object_type, scope, project_id, ref_id, created_at)
    SELECT 'object-concept-' || c.id, 'concept', 'project', c.project_id, c.id, c.created_at
      FROM concepts c
     WHERE NOT EXISTS (
       SELECT 1 FROM objects o WHERE o.object_type = 'concept' AND o.ref_id = c.id
     )
  `);

  db.exec(`
    INSERT INTO objects (id, object_type, scope, project_id, ref_id, created_at)
    SELECT 'object-file-' || f.id, 'file', 'project', f.project_id, f.id, f.created_at
      FROM files f
     WHERE NOT EXISTS (
       SELECT 1 FROM objects o WHERE o.object_type = 'file' AND o.ref_id = f.id
     )
  `);

  db.exec(`
    INSERT INTO objects (id, object_type, scope, project_id, ref_id, created_at)
    SELECT 'object-archetype-' || a.id, 'archetype', 'project', a.project_id, a.id, a.created_at
      FROM archetypes a
     WHERE NOT EXISTS (
       SELECT 1 FROM objects o WHERE o.object_type = 'archetype' AND o.ref_id = a.id
     )
  `);

  db.exec(`
    INSERT INTO objects (id, object_type, scope, project_id, ref_id, created_at)
    SELECT 'object-relation-type-' || rt.id, 'relation_type', 'project', rt.project_id, rt.id, rt.created_at
      FROM relation_types rt
     WHERE NOT EXISTS (
       SELECT 1 FROM objects o WHERE o.object_type = 'relation_type' AND o.ref_id = rt.id
     )
  `);

  db.exec(`
    INSERT INTO objects (id, object_type, scope, project_id, ref_id, created_at)
    SELECT 'object-context-' || c.id, 'context', 'project', n.project_id, c.id, c.created_at
      FROM contexts c
      LEFT JOIN networks n ON n.id = c.network_id
     WHERE NOT EXISTS (
       SELECT 1 FROM objects o WHERE o.object_type = 'context' AND o.ref_id = c.id
     )
  `);
}
