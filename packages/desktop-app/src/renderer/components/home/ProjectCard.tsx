import React from 'react';
import { Folder, Trash2 } from 'lucide-react';
import type { Project } from '@netior/shared/types';

interface ProjectCardProps {
  project: Project;
  onOpen: (project: Project) => void;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps): JSX.Element {
  return (
    <div
      className="group flex cursor-pointer items-center gap-3 rounded-lg border border-subtle bg-surface-card px-4 py-3 transition-colors duration-fast hover:border-default hover:bg-surface-hover"
      onClick={() => onOpen(project)}
    >
      <Folder size={20} className="shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-default">{project.name}</p>
        <p className="truncate text-xs text-muted">{project.root_dir}</p>
      </div>
      <button
        className="shrink-0 rounded p-1 text-muted opacity-0 transition-opacity duration-fast hover:bg-surface-hover hover:text-status-error group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(project.id);
        }}
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
