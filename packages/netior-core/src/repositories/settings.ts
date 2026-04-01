import { getDatabase } from '../connection';

export function getSetting(key: string): string | undefined {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(key, value);
}

export function deleteSetting(key: string): void {
  const db = getDatabase();
  db.prepare('DELETE FROM app_settings WHERE key = ?').run(key);
}
