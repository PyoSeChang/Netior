import React, { useEffect, useState, useCallback } from 'react';
import type { EditorTab } from '@moc/shared/types';
import type { ConceptFile } from '@moc/shared/types';
import { conceptFileService, conceptService } from '../../services';
import { useFileStore } from '../../stores/file-store';
import { useEditorStore } from '../../stores/editor-store';
import { useProjectStore } from '../../stores/project-store';
import { useI18n } from '../../hooks/useI18n';
import { renderEditor } from './FileEditor';
import { getEditorType, getMonacoLanguage } from './editor-utils';

interface ConceptEditorProps {
  tab: EditorTab;
}

export function ConceptEditor({ tab }: ConceptEditorProps): JSX.Element {
  const { t } = useI18n();
  const [files, setFiles] = useState<ConceptFile[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(tab.title);

  const { openFile, openFiles, updateContent, saveFile } = useFileStore();
  const { setActiveFile, setDirty } = useEditorStore();
  const currentProject = useProjectStore((s) => s.currentProject);

  const rootDir = currentProject?.root_dir ?? '';

  useEffect(() => {
    conceptFileService.getByConcept(tab.targetId).then(setFiles).catch(() => {});
  }, [tab.targetId]);

  useEffect(() => {
    if (!tab.activeFilePath && files.length > 0 && rootDir) {
      const first = files[0].file_path;
      openFile(first, rootDir).then(() => {
        setActiveFile(tab.id, first);
      });
    }
  }, [files, tab.activeFilePath, tab.id, rootDir, openFile, setActiveFile]);

  const handleFileSelect = useCallback(
    (filePath: string) => {
      if (rootDir) {
        openFile(filePath, rootDir).then(() => {
          setActiveFile(tab.id, filePath);
        });
      }
    },
    [rootDir, openFile, setActiveFile, tab.id],
  );

  const handleTitleSubmit = useCallback(() => {
    setEditingTitle(false);
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== tab.title) {
      conceptService.update(tab.targetId, { title: trimmed }).catch(() => {});
    }
  }, [titleValue, tab.title, tab.targetId]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleTitleSubmit();
      if (e.key === 'Escape') {
        setTitleValue(tab.title);
        setEditingTitle(false);
      }
    },
    [handleTitleSubmit, tab.title],
  );

  const activeFile = openFiles.find((f) => f.filePath === tab.activeFilePath);

  const handleContentChange = useCallback(
    (content: string) => {
      if (tab.activeFilePath) {
        updateContent(tab.activeFilePath, content);
        setDirty(tab.id, true);
      }
    },
    [tab.activeFilePath, tab.id, updateContent, setDirty],
  );

  const handleSave = useCallback(() => {
    if (tab.activeFilePath) {
      saveFile(tab.activeFilePath).then(() => {
        setDirty(tab.id, false);
      });
    }
  }, [tab.activeFilePath, tab.id, saveFile, setDirty]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {files.length > 0 && (
        <div className="flex shrink-0 items-center gap-0 overflow-x-auto border-b border-subtle bg-surface-panel">
          {files.map((f) => {
            const name = f.file_path.split('/').pop() ?? f.file_path;
            const isActive = f.file_path === tab.activeFilePath;
            return (
              <button
                key={f.id}
                className={`shrink-0 px-3 py-1.5 text-xs transition-colors ${
                  isActive
                    ? 'bg-surface-base text-default'
                    : 'text-muted hover:bg-surface-hover hover:text-default'
                }`}
                onClick={() => handleFileSelect(f.file_path)}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {activeFile ? (
          renderEditor(
            getEditorType(activeFile.filePath),
            {
              content: activeFile.content,
              filePath: activeFile.absolutePath,
              onChange: handleContentChange,
              onSave: handleSave,
            },
          )
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">
            {files.length === 0 ? t('concept.noFiles') : t('concept.selectFile')}
          </div>
        )}
      </div>
    </div>
  );
}
