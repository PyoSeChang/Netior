import React, { useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import type { EditorTab } from '@moc/shared/types';
import { useEditorStore } from '../../../stores/editor-store';
import { EditorViewModeSwitch } from '../EditorViewModeSwitch';
import { EditorContent } from '../EditorContent';
import { useI18n } from '../../../hooks/useI18n';
import { IconButton } from '../../ui/IconButton';

interface FloatWindowProps {
  tab: EditorTab;
  isActive: boolean;
  onActivate: () => void;
}

export function FloatWindow({ tab, isActive, onActivate }: FloatWindowProps): JSX.Element {
  const { t } = useI18n();
  const { updateFloatRect, setViewMode, toggleMinimize, closeTab } = useEditorStore();
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      // Ignore if clicking on a button
      if ((e.target as HTMLElement).closest('button')) return;
      e.preventDefault();
      onActivate();

      const startX = e.clientX;
      const startY = e.clientY;
      const origX = tab.floatRect.x;
      const origY = tab.floatRect.y;
      dragRef.current = { startX, startY, origX, origY };

      const handleMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        updateFloatRect(tab.id, {
          x: dragRef.current.origX + dx,
          y: dragRef.current.origY + dy,
        });
      };

      const handleUp = () => {
        dragRef.current = null;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [tab.id, tab.floatRect.x, tab.floatRect.y, updateFloatRect, onActivate],
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const origW = tab.floatRect.width;
      const origH = tab.floatRect.height;
      resizeRef.current = { startX, startY, origW, origH };

      const handleMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return;
        const dx = ev.clientX - resizeRef.current.startX;
        const dy = ev.clientY - resizeRef.current.startY;
        updateFloatRect(tab.id, {
          width: Math.max(300, resizeRef.current.origW + dx),
          height: Math.max(200, resizeRef.current.origH + dy),
        });
      };

      const handleUp = () => {
        resizeRef.current = null;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [tab.id, tab.floatRect.width, tab.floatRect.height, updateFloatRect],
  );

  return (
    <div
      className={`fixed flex flex-col overflow-hidden rounded-lg shadow-lg ${
        isActive ? 'z-50 shadow-xl' : 'z-40'
      } bg-surface-panel`}
      style={{
        left: tab.floatRect.x,
        top: tab.floatRect.y,
        width: tab.floatRect.width,
        height: tab.floatRect.height,
        pointerEvents: 'auto',
      }}
      onMouseDown={onActivate}
    >
      {/* Title bar */}
      <div
        className="flex shrink-0 cursor-grab items-center gap-2 border-b border-subtle bg-surface-card px-2 py-1.5 active:cursor-grabbing"
        onMouseDown={handleDragStart}
      >
        <span className="flex-1 truncate text-xs font-medium text-default">
          {tab.title}
          {tab.isDirty && <span className="ml-1 text-accent">*</span>}
        </span>

        <EditorViewModeSwitch
          currentMode={tab.viewMode}
          onModeChange={(mode) => setViewMode(tab.id, mode)}
          onMinimize={() => toggleMinimize(tab.id)}
        />

        <IconButton
          label={t('common.close')}
          className="w-7 h-7"
          onClick={() => closeTab(tab.id)}
          tooltipPosition="bottom"
        >
          <X size={14} />
        </IconButton>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <EditorContent tab={tab} />
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize"
        onMouseDown={handleResizeStart}
      />
    </div>
  );
}
