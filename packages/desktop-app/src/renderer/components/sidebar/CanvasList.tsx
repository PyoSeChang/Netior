import React, { useState } from 'react';
import { Plus, Trash2, Layout } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvas-store';
import { useI18n } from '../../hooks/useI18n';

interface CanvasListProps {
  projectId: string;
}

export function CanvasList({ projectId }: CanvasListProps): JSX.Element {
  const { t } = useI18n();
  const { canvases, currentCanvas, createCanvas, openCanvas, deleteCanvas } = useCanvasStore();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const canvas = await createCanvas({ project_id: projectId, name: newName.trim() });
    await openCanvas(canvas.id);
    setNewName('');
    setCreating(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-medium text-secondary">{t('sidebar.canvases')}</span>
        <button
          className="rounded p-0.5 text-muted hover:bg-surface-hover hover:text-default"
          onClick={() => setCreating(true)}
        >
          <Plus size={14} />
        </button>
      </div>

      {creating && (
        <div className="flex gap-1 px-2">
          <input
            className="flex-1 rounded border border-subtle bg-input px-2 py-1 text-xs text-default outline-none focus:border-accent"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') { setCreating(false); setNewName(''); }
            }}
            placeholder={t('canvas.namePlaceholder')}
            autoFocus
          />
        </div>
      )}

      {canvases.map((c) => (
        <div
          key={c.id}
          className={`group flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs transition-colors ${
            currentCanvas?.id === c.id
              ? 'bg-accent/10 text-accent'
              : 'text-secondary hover:bg-surface-hover hover:text-default'
          }`}
          onClick={() => openCanvas(c.id)}
        >
          <Layout size={12} className="shrink-0" />
          <span className="flex-1 truncate">{c.name}</span>
          <button
            className="shrink-0 rounded p-0.5 text-muted opacity-0 hover:text-status-error group-hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); deleteCanvas(c.id); }}
          >
            <Trash2 size={10} />
          </button>
        </div>
      ))}
    </div>
  );
}
