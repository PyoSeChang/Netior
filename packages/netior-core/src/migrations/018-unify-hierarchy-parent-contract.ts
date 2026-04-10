import type Database from 'better-sqlite3';

export function migrate018(db: Database.Database): void {
  db.exec(`
    UPDATE edges
       SET system_contract = 'core:hierarchy_parent'
     WHERE system_contract IN ('core:root_child', 'core:tree_parent')
  `);
}
