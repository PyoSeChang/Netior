import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import type { Project, ProjectCreate } from '@moc/shared/types';

export function createProject(data: ProjectCreate): Project {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO projects (id, name, root_dir, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, data.name, data.root_dir, now, now);

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

export function deleteProject(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return result.changes > 0;
}
