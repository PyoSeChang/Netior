import React from 'react';
import type { Project } from '@moc/shared/types';
import { Sidebar } from '../sidebar/Sidebar';
import { ConceptWorkspace } from './ConceptWorkspace';
import { EditorDock } from '../editor/EditorDock';

interface WorkspaceShellProps {
  project: Project;
}

export function WorkspaceShell({ project }: WorkspaceShellProps): JSX.Element {
  return (
    <div className="flex h-full">
      <Sidebar project={project} />
      <div className="flex-1 overflow-hidden">
        <ConceptWorkspace projectId={project.id} />
      </div>
      <EditorDock />
    </div>
  );
}
