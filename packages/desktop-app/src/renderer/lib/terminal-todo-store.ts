export interface TodoItem {
  id: string;
  text: string;
  checked: boolean;
  parentId: string | null;
  children: string[];
}

interface TodoSession {
  enabled: boolean;
  pinned: boolean;
  items: TodoItem[];
}

const sessions = new Map<string, TodoSession>();
const listeners = new Set<() => void>();
let version = 0;

function notify(): void {
  version++;
  for (const fn of listeners) fn();
}

function getSession(sessionId: string): TodoSession {
  let s = sessions.get(sessionId);
  if (!s) {
    s = { enabled: false, pinned: false, items: [] };
    sessions.set(sessionId, s);
  }
  return s;
}

export function isTodoEnabled(sessionId: string): boolean {
  return sessions.get(sessionId)?.enabled ?? false;
}

export function isTodoPinned(sessionId: string): boolean {
  return sessions.get(sessionId)?.pinned ?? false;
}

export function toggleTodoPinned(sessionId: string): void {
  const s = getSession(sessionId);
  s.pinned = !s.pinned;
  notify();
}

export function toggleTodoEnabled(sessionId: string): void {
  const s = getSession(sessionId);
  s.enabled = !s.enabled;
  notify();
}

export function getTodoItems(sessionId: string): TodoItem[] {
  return sessions.get(sessionId)?.items ?? [];
}

export function addTodoItem(sessionId: string, text: string, parentId?: string | null): void {
  const s = getSession(sessionId);
  const id = crypto.randomUUID();
  const item: TodoItem = { id, text, checked: false, parentId: parentId ?? null, children: [] };
  s.items.push(item);
  if (parentId) {
    const parent = s.items.find((i) => i.id === parentId);
    if (parent) parent.children.push(id);
  }
  notify();
}

export function toggleTodoChecked(sessionId: string, itemId: string): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  const item = s.items.find((i) => i.id === itemId);
  if (item) {
    item.checked = !item.checked;
    notify();
  }
}

function deleteRecursive(items: TodoItem[], itemId: string): void {
  const item = items.find((i) => i.id === itemId);
  if (!item) return;
  for (const childId of [...item.children]) {
    deleteRecursive(items, childId);
  }
  if (item.parentId) {
    const parent = items.find((i) => i.id === item.parentId);
    if (parent) parent.children = parent.children.filter((c) => c !== itemId);
  }
  const idx = items.indexOf(item);
  if (idx >= 0) items.splice(idx, 1);
}

export function deleteTodoItem(sessionId: string, itemId: string): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  deleteRecursive(s.items, itemId);
  notify();
}

export function updateTodoText(sessionId: string, itemId: string, text: string): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  const item = s.items.find((i) => i.id === itemId);
  if (item) {
    item.text = text;
    notify();
  }
}

export function indentTodoItem(sessionId: string, itemId: string): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  const item = s.items.find((i) => i.id === itemId);
  if (!item) return;

  const siblings = s.items.filter((i) => i.parentId === item.parentId);
  const myIdx = siblings.findIndex((i) => i.id === itemId);
  if (myIdx <= 0) return;

  const newParent = siblings[myIdx - 1];
  if (item.parentId) {
    const oldParent = s.items.find((i) => i.id === item.parentId);
    if (oldParent) oldParent.children = oldParent.children.filter((c) => c !== itemId);
  }
  item.parentId = newParent.id;
  newParent.children.push(itemId);
  notify();
}

export function unindentTodoItem(sessionId: string, itemId: string): void {
  const s = sessions.get(sessionId);
  if (!s) return;
  const item = s.items.find((i) => i.id === itemId);
  if (!item || !item.parentId) return;

  const parent = s.items.find((i) => i.id === item.parentId);
  if (!parent) return;

  parent.children = parent.children.filter((c) => c !== itemId);
  item.parentId = parent.parentId;
  if (parent.parentId) {
    const grandparent = s.items.find((i) => i.id === parent.parentId);
    if (grandparent) {
      const parentIdx = grandparent.children.indexOf(parent.id);
      grandparent.children.splice(parentIdx + 1, 0, itemId);
    }
  }
  notify();
}

export function moveTodoItem(sessionId: string, itemId: string, targetId: string, position: 'before' | 'after'): void {
  const s = sessions.get(sessionId);
  if (!s || itemId === targetId) return;
  const item = s.items.find((i) => i.id === itemId);
  const target = s.items.find((i) => i.id === targetId);
  if (!item || !target) return;

  // Remove from old parent's children
  if (item.parentId) {
    const oldParent = s.items.find((i) => i.id === item.parentId);
    if (oldParent) oldParent.children = oldParent.children.filter((c) => c !== itemId);
  }

  // Move to same parent as target
  item.parentId = target.parentId;
  if (target.parentId) {
    const newParent = s.items.find((i) => i.id === target.parentId);
    if (newParent) {
      const targetIdx = newParent.children.indexOf(targetId);
      const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
      newParent.children.splice(insertIdx, 0, itemId);
    }
  }

  // Also reorder in flat array to maintain root ordering
  const fromIdx = s.items.indexOf(item);
  s.items.splice(fromIdx, 1);
  const toIdx = s.items.indexOf(target);
  const insertIdx = position === 'before' ? toIdx : toIdx + 1;
  s.items.splice(insertIdx, 0, item);

  notify();
}

export function getTodoVersion(): number {
  return version;
}

export function subscribeTodoStore(callback: () => void): () => void {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}

export function cleanupSession(sessionId: string): void {
  if (sessions.delete(sessionId)) notify();
}
