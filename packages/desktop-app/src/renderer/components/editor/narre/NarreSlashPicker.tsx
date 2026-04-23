import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SLASH_TRIGGER_SKILLS } from '@netior/shared/constants';
import type { SkillDefinition } from '@netior/shared/types';
import { useI18n } from '../../../hooks/useI18n';
import { logShortcut } from '../../../shortcuts/shortcut-utils';

interface NarreSlashPickerProps {
  query: string;
  position: { bottom: number; left: number };
  skills?: readonly SkillDefinition[];
  onSelect: (skill: SkillDefinition) => void;
  onClose: () => void;
}

function getSkillLabel(skill: SkillDefinition): string {
  return skill.trigger?.type === 'slash' ? `/${skill.trigger.name}` : skill.name;
}

export function NarreSlashPicker({
  query,
  position,
  skills = SLASH_TRIGGER_SKILLS,
  onSelect,
  onClose,
}: NarreSlashPickerProps): JSX.Element {
  const { t } = useI18n();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = skills.filter(
    (skill) =>
      skill.name.toLowerCase().includes(query.toLowerCase()) ||
      getSkillLabel(skill).toLowerCase().includes(query.toLowerCase()) ||
      (skill.source === 'builtin' ? t(skill.description as any) : skill.description)
        .toLowerCase()
        .includes(query.toLowerCase()),
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
        logShortcut('shortcut.narreSlashPicker.selectNext');
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopImmediatePropagation();
        logShortcut('shortcut.narreSlashPicker.selectPrevious');
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (filtered[selectedIndex]) {
          logShortcut('shortcut.narreSlashPicker.confirmSelection');
          onSelect(filtered[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        logShortcut('shortcut.narreSlashPicker.close');
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
      className="fixed z-[10001] w-[320px] rounded-lg border border-default bg-surface-panel shadow-lg overflow-hidden"
      style={{ bottom: position.bottom, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="max-h-[200px] overflow-y-auto py-1">
        {filtered.map((skill, idx) => (
          <div
            key={`${skill.source}:${skill.trigger?.type === 'slash' ? skill.trigger.name : skill.id}`}
            className={[
              'flex flex-col px-3 py-1.5 cursor-pointer',
              idx === selectedIndex ? 'bg-surface-hover' : '',
            ].join(' ')}
            onMouseEnter={() => setSelectedIndex(idx)}
            onClick={() => onSelect(skill)}
          >
            <span className="text-xs font-medium text-default">{getSkillLabel(skill)}</span>
            <span className="text-xs text-muted">
              {skill.source === 'builtin' ? t(skill.description as any) : skill.description}
            </span>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
