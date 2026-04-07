import { randomUUID } from 'crypto';
import { getDatabase } from '../connection';
import { createObject, deleteObjectByRef } from './objects';
import type { Context, ContextCreate, ContextUpdate, ContextMember } from '@netior/shared/types';

export function createContext(data: ContextCreate): Context {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO contexts (id, network_id, name, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, data.network_id, data.name, data.description ?? null, now, now);

  // Register object record — look up project_id from the network
  const network = db.prepare('SELECT project_id FROM networks WHERE id = ?').get(data.network_id) as { project_id: string | null } | undefined;
  const projectId = network?.project_id ?? null;
  createObject('context', 'project', projectId, id);

  return db.prepare('SELECT * FROM contexts WHERE id = ?').get(id) as Context;
}

export function listContexts(networkId: string): Context[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM contexts WHERE network_id = ? ORDER BY created_at').all(networkId) as Context[];
}

export function getContext(id: string): Context | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM contexts WHERE id = ?').get(id) as Context | undefined;
}

export function updateContext(id: string, data: ContextUpdate): Context | undefined {
  const db = getDatabase();
  const existing = db.prepare('SELECT * FROM contexts WHERE id = ?').get(id) as Context | undefined;
  if (!existing) return undefined;

  const now = new Date().toISOString();

  db.prepare(
    `UPDATE contexts SET name = ?, description = ?, updated_at = ? WHERE id = ?`,
  ).run(
    data.name !== undefined ? data.name : existing.name,
    data.description !== undefined ? data.description : existing.description,
    now,
    id,
  );

  return db.prepare('SELECT * FROM contexts WHERE id = ?').get(id) as Context;
}

export function deleteContext(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM contexts WHERE id = ?').run(id);
  if (result.changes > 0) {
    deleteObjectByRef('context', id);
    return true;
  }
  return false;
}

export function addContextMember(contextId: string, memberType: 'object' | 'edge', memberId: string): ContextMember {
  const db = getDatabase();
  const id = randomUUID();

  db.prepare(
    `INSERT INTO context_members (id, context_id, member_type, member_id) VALUES (?, ?, ?, ?)`,
  ).run(id, contextId, memberType, memberId);

  return { id, context_id: contextId, member_type: memberType, member_id: memberId };
}

export function removeContextMember(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM context_members WHERE id = ?').run(id);
  return result.changes > 0;
}

export function getContextMembers(contextId: string): ContextMember[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM context_members WHERE context_id = ?').all(contextId) as ContextMember[];
}
