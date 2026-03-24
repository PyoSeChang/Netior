import React from 'react';
import { X } from 'lucide-react';
import type { OpenFile } from '../../stores/file-store';

interface EditorTabBarProps {
  files: OpenFile[];
  activeFilePath: string | null;
  onSelect: (filePath: string) => void;
  onClose: (filePath: string) => void;
}

export function EditorTabBar({ files, activeFilePath, onSelect, onClose }: EditorTabBarProps): JSX.Element {
  if (files.length === 0) return <></>;

  return (
    <div className="flex h-8 shrink-0 items-center gap-0 overflow-x-auto border-b border-subtle bg-surface-panel">
      {files.map((f) => {
        const name = f.filePath.split('/').pop() ?? f.filePath;
        const isActive = f.filePath === activeFilePath;

        return (
          <div
            key={f.filePath}
            className={`group flex shrink-0 cursor-pointer items-center gap-1 border-r border-subtle px-3 py-1 text-xs transition-colors ${
              isActive
                ? 'bg-surface-base text-default'
                : 'text-muted hover:bg-surface-hover hover:text-default'
            }`}
            onClick={() => onSelect(f.filePath)}
          >
            {f.isDirty && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
            <span className="max-w-[120px] truncate">{name}</span>
            <button
              className="ml-1 rounded p-0.5 text-muted opacity-0 hover:text-default group-hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); onClose(f.filePath); }}
            >
              <X size={10} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
