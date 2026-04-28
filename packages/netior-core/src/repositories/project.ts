import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import { createObject, deleteObjectByRef } from './objects';
import { ensureProjectNodeInUniverseForDb, ensureProjectOntologyNetworkForDb } from './system-networks';
import { seedBuiltInSemanticModelsForProjectDb } from './semantic-model';
import type { Project, ProjectCreate, ProjectUpdate } from '@netior/shared/types';

export function createProject(data: ProjectCreate): Project {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO projects (id, name, root_dir, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    ).run(id, data.name, data.root_dir, now, now);

    createObject('project', 'app', null, id);
    seedBuiltInSemanticModelsForProjectDb(db, id);
    ensureProjectOntologyNetworkForDb(db, id);
    ensureProjectNodeInUniverseForDb(db, id);
  })();

  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project;
}

export function listProjects(): Project[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as Project[];
}

export function getProjectById(id: string): Project | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
}

export function updateProject(id: string, data: ProjectUpdate): Project | undefined {
  const db = getDatabase();
  const existing = getProjectById(id);
  if (!existing) return undefined;

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE projects SET name = ?, root_dir = ?, updated_at = ? WHERE id = ?`,
  ).run(
    data.name !== undefined ? data.name : existing.name,
    data.root_dir !== undefined ? data.root_dir : existing.root_dir,
    now,
    id,
  );

  return getProjectById(id);
}

export function updateProjectRootDir(id: string, rootDir: string): Project | undefined {
  return updateProject(id, { root_dir: rootDir });
}

export function deleteProject(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  if (result.changes > 0) {
    deleteObjectByRef('project', id);
    return true;
  }
  return false;
}
