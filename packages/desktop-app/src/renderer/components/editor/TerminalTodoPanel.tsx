import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { X, Plus, GripVertical } from 'lucide-react';
import { Checkbox } from '../ui/Checkbox';
import { useI18n } from '../../hooks/useI18n';
import { Badge } from '../ui/Badge';
import { ScrollArea } from '../ui/ScrollArea';
import { EdgePanel } from '../ui/EdgePanel';
import {
  subscribeTodoStore,
  getTodoVersion,
  getTodoItems,
  isTodoPinned,
  toggleTodoPinned,
  addTodoItem,
  toggleTodoChecked,
  deleteTodoItem,
  updateTodoText,
  moveTodoItem,
  type TodoItem,
} from '../../lib/terminal-todo-store';

interface TerminalTodoPanelProps {
  sessionId: string;
  autoShowSeconds?: number;
}

export function TerminalTodoPanel({ sessionId, autoShowSeconds = 0 }: TerminalTodoPanelProps): JSX.Element {
  const { t } = useI18n();
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<'before' | 'after'>('after');
  const dragItemRef = useRef<string | null>(null);

  useSyncExternalStore(subscribeTodoStore, getTodoVersion);
  const items = getTodoItems(sessionId);
  const pinned = isTodoPinned(sessionId);

  const handleDragEnd = useCallback(() => {
    if (dragItemRef.current && dragOverId && dragItemRef.current !== dragOverId) {
      moveTodoItem(sessionId, dragItemRef.current, dragOverId, dragPosition);
    }
    dragItemRef.current = null;
    setDragOverId(null);
  }, [sessionId, dragOverId, dragPosition]);

  const rootItems = items.filter((i) => i.parentId === null);

  return (
    <EdgePanel
      side="right"
      width={260}
      pinned={pinned}
      onPinChange={() => toggleTodoPinned(sessionId)}
      title={t('terminal.todoTitle')}
      headerActions={
        <>
          <Badge>{items.length}</Badge>
          <button
            className="p-0.5 rounded text-muted hover:text-default transition-colors"
            onClick={() => addTodoItem(sessionId, '')}
          >
            <Plus size={12} />
          </button>
        </>
      }
      autoShowMs={autoShowSeconds > 0 ? autoShowSeconds * 1000 : undefined}
      showDelay={150}
      hideDelay={500}
    >
      <ScrollArea className="flex-1 min-h-0 py-1">
        {rootItems.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted">{t('terminal.todoEmpty')}</p>
        ) : (
          rootItems.map((item, idx) => (
            <React.Fragment key={item.id}>
              {idx > 0 && <div className="mx-3 my-0.5 border-t border-subtle" />}
              <TodoTree
                item={item}
                allItems={items}
                sessionId={sessionId}
                depth={0}
                dragItemRef={dragItemRef}
                dragOverId={dragOverId}
                dragPosition={dragPosition}
                onDragOver={setDragOverId}
                onDragPosition={setDragPosition}
                onDragEnd={handleDragEnd}
              />
            </React.Fragment>
          ))
        )}
      </ScrollArea>
    </EdgePanel>
  );
}

// ── Tree node (recursive) ──

interface TodoTreeProps {
  item: TodoItem;
  allItems: TodoItem[];
  sessionId: string;
  depth: number;
  dragItemRef: React.MutableRefObject<string | null>;
  dragOverId: string | null;
  dragPosition: 'before' | 'after';
  onDragOver: (id: string | null) => void;
  onDragPosition: (p: 'before' | 'after') => void;
  onDragEnd: () => void;
}

function TodoTree({ item, allItems, sessionId, depth, dragItemRef, dragOverId, dragPosition, onDragOver, onDragPosition, onDragEnd }: TodoTreeProps): JSX.Element {
  const [editing, setEditing] = useState(() => item.text === '');
  const [editText, setEditText] = useState(item.text);
  const [rowHovered, setRowHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const children = item.children
    .map((cid) => allItems.find((i) => i.id === cid))
    .filter(Boolean) as TodoItem[];

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const commitEdit = useCallback(() => {
    const trimmed = editText.trim();
    if (trimmed) {
      updateTodoText(sessionId, item.id, trimmed);
    } else if (item.text === '') {
      deleteTodoItem(sessionId, item.id);
    } else {
      setEditText(item.text);
    }
    setEditing(false);
  }, [editText, item.text, item.id, sessionId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commitEdit();
    else if (e.key === 'Escape') {
      if (item.text === '') {
        deleteTodoItem(sessionId, item.id);
      } else {
        setEditText(item.text);
      }
      setEditing(false);
    }
  }, [commitEdit, item.text, item.id, sessionId]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    dragItemRef.current = item.id;
    e.dataTransfer.effectAllowed = 'move';
  }, [item.id, dragItemRef]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    onDragPosition(e.clientY < midY ? 'before' : 'after');
    onDragOver(item.id);
  }, [item.id, onDragOver, onDragPosition]);

  const isDragTarget = dragOverId === item.id && dragItemRef.current !== item.id;

  return (
    <>
      <div
        className={`flex items-center gap-1 pr-2 py-0.5 transition-colors hover:bg-surface-hover ${
          isDragTarget && dragPosition === 'before' ? 'border-t-2 border-accent' : ''
        } ${isDragTarget && dragPosition === 'after' ? 'border-b-2 border-accent' : ''}`}
        style={{ paddingLeft: depth * 14 + 8 }}
        onMouseEnter={() => setRowHovered(true)}
        onMouseLeave={() => setRowHovered(false)}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={onDragEnd}
        onDragEnd={() => { dragItemRef.current = null; onDragOver(null); }}
      >
        {/* Drag handle */}
        <span className={`flex-shrink-0 cursor-grab transition-opacity ${rowHovered ? 'opacity-50' : 'opacity-0'}`}>
          <GripVertical size={10} className="text-muted" />
        </span>

        {/* Checkbox */}
        <div className="flex-shrink-0 mt-px scale-90">
          <Checkbox checked={item.checked} onChange={() => toggleTodoChecked(sessionId, item.id)} />
        </div>

        {/* Text */}
        {editing ? (
          <input
            ref={inputRef}
            className="flex-1 min-w-0 bg-transparent text-xs text-default outline-none px-1"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            placeholder="..."
          />
        ) : (
          <span
            className={`flex-1 min-w-0 truncate text-xs px-1 cursor-default ${
              item.checked ? 'text-muted line-through' : 'text-default'
            }`}
            onDoubleClick={() => { setEditing(true); setEditText(item.text); }}
          >
            {item.text}
          </span>
        )}

        {/* Actions */}
        <div className={`flex items-center gap-0.5 flex-shrink-0 transition-opacity ${rowHovered && !editing ? 'opacity-100' : 'opacity-0'}`}>
          <button
            className="p-0.5 text-muted hover:text-default rounded transition-colors"
            onClick={() => addTodoItem(sessionId, '', item.id)}
          >
            <Plus size={10} />
          </button>
          <button
            className="p-0.5 text-muted hover:text-status-error rounded transition-colors"
            onClick={() => deleteTodoItem(sessionId, item.id)}
          >
            <X size={10} />
          </button>
        </div>
      </div>

      {/* Children (indented, no divider between siblings at child level) */}
      {children.map((child) => (
        <TodoTree
          key={child.id}
          item={child}
          allItems={allItems}
          sessionId={sessionId}
          depth={depth + 1}
          dragItemRef={dragItemRef}
          dragOverId={dragOverId}
          dragPosition={dragPosition}
          onDragOver={onDragOver}
          onDragPosition={onDragPosition}
          onDragEnd={onDragEnd}
        />
      ))}
    </>
  );
}
