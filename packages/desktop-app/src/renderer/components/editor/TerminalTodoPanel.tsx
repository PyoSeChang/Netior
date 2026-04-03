import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { X, Plus, Pin, GripVertical } from 'lucide-react';
import { Checkbox } from '../ui/Checkbox';
import { useI18n } from '../../hooks/useI18n';
import { Badge } from '../ui/Badge';
import { ScrollArea } from '../ui/ScrollArea';
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
  const [hovered, setHovered] = useState(false);
  const [autoShow, setAutoShow] = useState(autoShowSeconds > 0);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<'before' | 'after'>('after');
  const dragItemRef = useRef<string | null>(null);

  useSyncExternalStore(subscribeTodoStore, getTodoVersion);
  const items = getTodoItems(sessionId);
  const pinned = isTodoPinned(sessionId);

  useEffect(() => {
    if (autoShowSeconds <= 0) return;
    setAutoShow(true);
    autoHideTimerRef.current = setTimeout(() => setAutoShow(false), autoShowSeconds * 1000);
    return () => {
      if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
    };
  }, [autoShowSeconds]);

  const handleMouseEnter = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
    hoverTimerRef.current = setTimeout(() => setHovered(true), 150);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHovered(false);
      setAutoShow(false);
    }, 500);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragItemRef.current && dragOverId && dragItemRef.current !== dragOverId) {
      moveTodoItem(sessionId, dragItemRef.current, dragOverId, dragPosition);
    }
    dragItemRef.current = null;
    setDragOverId(null);
  }, [sessionId, dragOverId, dragPosition]);

  const visible = pinned || hovered || autoShow;
  const rootItems = items.filter((i) => i.parentId === null);
  const tabColor = 'color-mix(in srgb, var(--text-muted) 30%, transparent)';

  return (
    <>
      <svg
        className="pointer-events-none absolute right-[1px] z-30"
        style={{ top: '3rem' }}
        width="6"
        height="60"
        viewBox="0 0 6 60"
      >
        <path d="M6 0 L6 60 L0 52 L0 8 Z" fill={tabColor} />
      </svg>
      <div
        className="absolute right-0 top-0 z-30 w-1 h-full"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      <div
        className={`absolute right-3 top-10 z-30 flex flex-col rounded-lg border border-subtle bg-surface-card shadow-lg transition-all duration-200 ${
          visible ? 'translate-x-0 opacity-100' : 'translate-x-[calc(100%+12px)] opacity-0'
        }`}
        style={{ width: 260, maxHeight: 'calc(100% - 3rem)' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-subtle">
          <span className="text-xs font-medium text-default">{t('terminal.todoTitle')}</span>
          <Badge>{items.length}</Badge>
          <div className="ml-auto flex items-center gap-1">
            <button
              className="p-0.5 rounded text-muted hover:text-default transition-colors"
              onClick={() => addTodoItem(sessionId, '')}
            >
              <Plus size={12} />
            </button>
            <button
              className={`p-0.5 rounded transition-colors ${
                pinned ? 'text-accent' : 'text-muted hover:text-default'
              }`}
              onClick={() => toggleTodoPinned(sessionId)}
            >
              <Pin size={12} className={pinned ? 'fill-current' : ''} />
            </button>
          </div>
        </div>

        {/* List */}
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
      </div>
    </>
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
