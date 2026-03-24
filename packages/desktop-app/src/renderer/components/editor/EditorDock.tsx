import React from 'react';
import { useFileStore } from '../../stores/file-store';
import { useUIStore } from '../../stores/ui-store';
import { EditorTabBar } from './EditorTabBar';
import { MarkdownEditor } from './MarkdownEditor';
import { PlainTextEditor } from './PlainTextEditor';
import { ImageViewer } from './ImageViewer';
import { UnsupportedFallback } from './UnsupportedFallback';

export function EditorDock(): JSX.Element | null {
  const { editorDockOpen } = useUIStore();
  const { openFiles, activeFilePath, setActiveFile, closeFile, updateContent, saveFile } = useFileStore();

  if (!editorDockOpen || openFiles.length === 0) return null;

  const activeFile = openFiles.find((f) => f.filePath === activeFilePath);

  return (
    <div className="flex h-full w-[400px] shrink-0 flex-col border-l border-subtle bg-surface-panel">
      <EditorTabBar
        files={openFiles}
        activeFilePath={activeFilePath}
        onSelect={setActiveFile}
        onClose={closeFile}
      />

      <div className="flex-1 overflow-hidden">
        {activeFile ? (
          <>
            {activeFile.editorType === 'markdown' && (
              <MarkdownEditor
                content={activeFile.content}
                onChange={(c) => updateContent(activeFile.filePath, c)}
                onSave={() => saveFile(activeFile.filePath)}
              />
            )}
            {activeFile.editorType === 'plain-text' && (
              <PlainTextEditor
                content={activeFile.content}
                onChange={(c) => updateContent(activeFile.filePath, c)}
                onSave={() => saveFile(activeFile.filePath)}
              />
            )}
            {activeFile.editorType === 'image' && (
              <ImageViewer absolutePath={activeFile.absolutePath} />
            )}
            {activeFile.editorType === 'unsupported' && (
              <UnsupportedFallback filePath={activeFile.filePath} absolutePath={activeFile.absolutePath} />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">
            No file selected
          </div>
        )}
      </div>
    </div>
  );
}
