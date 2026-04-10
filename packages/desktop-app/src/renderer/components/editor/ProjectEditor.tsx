import React, { useCallback } from 'react';
import type { EditorTab } from '@netior/shared/types';
import { useProjectStore } from '../../stores/project-store';
import { useEditorStore } from '../../stores/editor-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { useI18n } from '../../hooks/useI18n';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import {
  NetworkObjectEditorShell,
  NetworkObjectEditorSection,
  NetworkObjectMetadataList,
} from './NetworkObjectEditorShell';

interface ProjectEditorProps {
  tab: EditorTab;
}

interface ProjectState {
  name: string;
}

export function ProjectEditor({ tab }: ProjectEditorProps): JSX.Element {
  const { t } = useI18n();
  const projectId = tab.targetId;
  const projects = useProjectStore((s) => s.projects);
  const currentProject = useProjectStore((s) => s.currentProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const openProject = useProjectStore((s) => s.openProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const project = projects.find((item) => item.id === projectId) ?? null;

  const session = useEditorSession<ProjectState>({
    tabId: tab.id,
    load: () => {
      const current = useProjectStore.getState().projects.find((item) => item.id === projectId);
      return { name: current?.name ?? '' };
    },
    save: async (state) => {
      const updated = await updateProject(projectId, { name: state.name });
      useEditorStore.getState().updateTitle(tab.id, updated.name);
    },
    deps: [projectId, project?.name],
  });

  const handleOpenWorkspace = useCallback(async () => {
    const target = useProjectStore.getState().projects.find((item) => item.id === projectId);
    if (!target) return;
    await openProject(target);
  }, [openProject, projectId]);

  const handleDelete = useCallback(async () => {
    await deleteProject(projectId);
    useEditorStore.getState().closeTab(tab.id);
  }, [deleteProject, projectId, tab.id]);

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        {t('project.noProject')}
      </div>
    );
  }

  if (session.isLoading) return <></>;

  return (
    <div className="h-full overflow-y-auto">
      <NetworkObjectEditorShell
        badge={t('project.name')}
        title={session.state.name || project.name}
        subtitle={currentProject?.id === project.id ? 'Current Project' : 'Project'}
        description={project.root_dir}
        actions={(
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => { void handleOpenWorkspace(); }}>
              {t('common.open')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-status-error hover:text-status-error"
              onClick={() => { void handleDelete(); }}
            >
              {t('common.delete')}
            </Button>
          </div>
        )}
      >
        <NetworkObjectEditorSection title={t('editorShell.overview' as never)}>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">{t('project.name')}</label>
            <Input
              value={session.state.name}
              onChange={(event) => {
                session.setState((prev) => ({ ...prev, name: event.target.value }));
              }}
            />
          </div>
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('project.folder')} defaultOpen={false}>
          <NetworkObjectMetadataList
            items={[
              { label: t('project.folder'), value: project.root_dir },
            ]}
          />
        </NetworkObjectEditorSection>

        <NetworkObjectEditorSection title={t('editorShell.metadata' as never)} defaultOpen={false}>
          <NetworkObjectMetadataList
            items={[
              { label: t('editorShell.objectId' as never), value: <code className="font-mono text-xs">{project.id}</code> },
              { label: 'Updated', value: project.updated_at },
            ]}
          />
        </NetworkObjectEditorSection>
      </NetworkObjectEditorShell>
    </div>
  );
}
