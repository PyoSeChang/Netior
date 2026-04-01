import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SLASH_COMMANDS } from '@netior/shared/constants';
import type { SlashCommand } from '@netior/shared/types';
import { useI18n } from '../../../hooks/useI18n';

interface NarreSlashPickerProps {
  query: string;
  position: { bottom: number; left: number };
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}

export function NarreSlashPicker({
  query,
  position,
  onSelect,
  onClose,
}: NarreSlashPickerProps): JSX.Element {
  const { t } = useI18n();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(query.toLowerCase()) ||
      t(cmd.description as any).toLowerCase().includes(query.toLowerCase()),
  );

  // Reset selection when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation (capture phase, same pattern as NarreMentionPicker)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopImmediatePropagation();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [filtered, selectedIndex, onSelect, onClose]);

  // Close on outside click
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  if (filtered.length === 0) return <></>;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed z-[10001] w-[280px] rounded-lg border border-default bg-surface-panel shadow-lg overflow-hidden"
      style={{ bottom: position.bottom, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="max-h-[200px] overflow-y-auto py-1">
        {filtered.map((cmd, idx) => (
          <div
            key={cmd.name}
            className={[
              'flex flex-col px-3 py-1.5 cursor-pointer',
              idx === selectedIndex ? 'bg-surface-hover' : '',
            ].join(' ')}
            onMouseEnter={() => setSelectedIndex(idx)}
            onClick={() => onSelect(cmd)}
          >
            <span className="text-xs font-medium text-default">/{cmd.name}</span>
            <span className="text-xs text-muted">{t(cmd.description as any)}</span>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
