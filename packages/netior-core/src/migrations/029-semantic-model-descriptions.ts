import type Database from 'better-sqlite3';

const BUILT_IN_MODEL_DESCRIPTIONS: Readonly<Record<string, string>> = {
  temporal: 'Represents objects that occupy time with a start point and optional end context.',
  dueable: 'Represents objects that have one deadline or due point.',
  recurring: 'Represents objects that repeat through frequency, interval, calendar constraints, and end conditions.',
  statusful: 'Represents objects whose workflow state can be read by boards, lists, and filters.',
  assignable: 'Represents objects that can be assigned to one or more responsible actors.',
  prioritizable: 'Represents objects that carry a priority value for ranking and triage.',
  progressable: 'Represents objects with measurable progress and completion timing.',
  estimable: 'Represents objects with estimated and actual effort, cost, or resource values.',
  hierarchical: 'Represents objects arranged in parent-child structures.',
  ordered: 'Represents objects with an explicit manual sort position.',
  taggable: 'Represents objects classified by a lightweight set of tags.',
  categorizable: 'Represents objects classified by one category or taxonomy key.',
  sourceable: 'Represents objects that can cite where their information came from.',
  attachable: 'Represents objects that can reference attached files or external assets.',
  versioned: 'Represents objects with version, revision, and supersession metadata.',
  locatable: 'Represents objects that can be placed by location, address, or coordinates.',
  measurable: 'Represents objects with measured values, units, and optional targets.',
  budgeted: 'Represents objects with budget amount, currency, and limit metadata.',
  ownable: 'Represents objects with an accountable owner.',
  approvable: 'Represents objects with approval state, approver, and approval time.',
};

export function migrate029(db: Database.Database): void {
  const updateDescription = db.prepare(`
    UPDATE semantic_models
       SET description = ?
     WHERE key = ?
       AND built_in = 1
       AND (description IS NULL OR trim(description) = '')
  `);

  for (const [key, description] of Object.entries(BUILT_IN_MODEL_DESCRIPTIONS)) {
    updateDescription.run(description, key);
  }
}
