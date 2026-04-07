import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import type { ObjectRecord, NetworkObjectType } from '@netior/shared/types';

export function createObject(
  objectType: NetworkObjectType,
  scope: string,
  projectId: string | null,
  refId: string,
): ObjectRecord {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO objects (id, object_type, scope, project_id, ref_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, objectType, scope, projectId, refId, now);

  return { id, object_type: objectType, scope, project_id: projectId, ref_id: refId, created_at: now };
}

export function getObject(id: string): ObjectRecord | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM objects WHERE id = ?').get(id) as ObjectRecord | undefined;
}

export function getObjectByRef(objectType: NetworkObjectType, refId: string): ObjectRecord | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM objects WHERE object_type = ? AND ref_id = ?').get(objectType, refId) as ObjectRecord | undefined;
}

export function deleteObject(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM objects WHERE id = ?').run(id);
  return result.changes > 0;
}

export function deleteObjectByRef(objectType: NetworkObjectType, refId: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM objects WHERE object_type = ? AND ref_id = ?').run(objectType, refId);
  return result.changes > 0;
}
