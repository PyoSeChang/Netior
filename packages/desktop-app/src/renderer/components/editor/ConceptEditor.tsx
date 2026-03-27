import React, { useEffect, useState, useCallback } from 'react';
import type { EditorTab, ConceptFile } from '@moc/shared/types';
import { Eye, Bot, Paperclip } from 'lucide-react';
import { conceptFileService } from '../../services';
import { useConceptStore } from '../../stores/concept-store';
import { useArchetypeStore } from '../../stores/archetype-store';
import { useEditorStore } from '../../stores/editor-store';
import { useProjectStore } from '../../stores/project-store';
import { ScrollArea } from '../ui/ScrollArea';
import { Badge } from '../ui/Badge';
import { ConceptPropertiesPanel } from './ConceptPropertiesPanel';
import { ConceptBodyEditor } from './ConceptBodyEditor';
import { ConceptAgentView } from './ConceptAgentView';
import { ContentEditableEditor } from './ContentEditableEditor';

type ConceptViewMode = 'human' | 'agent';

interface ConceptEditorProps {
  tab: EditorTab;
}

// --- Title editor (inline contentEditable) ---

function ConceptTitleEditor({ conceptId, title }: { conceptId: string; title: string }): JSX.Element {
  const updateConcept = useConceptStore((s) => s.updateConcept);
  const { updateTitle } = useEditorStore();

  const handleChange = useCallback(
    (newTitle: string) => {
      const trimmed = newTitle.trim();
      if (trimmed && trimmed !== title) {
        updateConcept(conceptId, { title: trimmed });
        // Sync editor tab title
        const tabId = `concept:${conceptId}`;
        updateTitle(tabId, trimmed);
      }
    },
    [conceptId, title, updateConcept, updateTitle],
  );

  return (
    <ContentEditableEditor
      value={title}
      onChange={handleChange}
      placeholder="Untitled"
      className="text-2xl font-bold text-default"
      singleLine
    />
  );
}

// --- Main editor ---

export function ConceptEditor({ tab }: ConceptEditorProps): JSX.Element {
  const [viewMode, setViewMode] = useState<ConceptViewMode>('human');
  const [files, setFiles] = useState<ConceptFile[]>([]);

  const currentProject = useProjectStore((s) => s.currentProject);
  const rootDir = currentProject?.root_dir ?? '';

  // Ensure concepts are loaded in the store
  const concepts = useConceptStore((s) => s.concepts);
  const loadByProject = useConceptStore((s) => s.loadByProject);
  const concept = concepts.find((c) => c.id === tab.targetId);

  useEffect(() => {
    if (concepts.length === 0 && currentProject) {
      loadByProject(currentProject.id);
    }
  }, [concepts.length, currentProject, loadByProject]);

  const archetype = useArchetypeStore((s) =>
    concept?.archetype_id ? s.archetypes.find((a) => a.id === concept.archetype_id) : undefined,
  );

  // Load attached files
  useEffect(() => {
    conceptFileService.getByConcept(tab.targetId).then(setFiles).catch(() => {});
  }, [tab.targetId]);

  // Open attached file as a separate file tab
  const handleFileClick = useCallback(
    (filePath: string) => {
      if (!rootDir) return;
      const absolutePath = `${rootDir}/${filePath}`;
      const fileName = filePath.replace(/\\/g, '/').split('/').pop() ?? filePath;
      useEditorStore.getState().openTab({
        type: 'file',
        targetId: absolutePath,
        title: fileName,
      });
    },
    [rootDir],
  );

  if (!concept) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* View mode toggle */}
      <div className="flex shrink-0 items-center border-b border-subtle bg-surface-panel px-2">
        <button
          className={`flex items-center gap-1 px-3 py-1.5 text-xs transition-colors ${
            viewMode === 'human' ? 'text-accent border-b-2 border-accent' : 'text-muted hover:text-default'
          }`}
          onClick={() => setViewMode('human')}
        >
          <Eye size={12} />
          Human
        </button>
        <button
          className={`flex items-center gap-1 px-3 py-1.5 text-xs transition-colors ${
            viewMode === 'agent' ? 'text-accent border-b-2 border-accent' : 'text-muted hover:text-default'
          }`}
          onClick={() => setViewMode('agent')}
        >
          <Bot size={12} />
          Agent
        </button>
      </div>

      {/* Agent View */}
      {viewMode === 'agent' && (
        <div className="flex-1 overflow-hidden">
          <ConceptAgentView conceptId={tab.targetId} agentContent={concept.agent_content} />
        </div>
      )}

      {/* Human View */}
      {viewMode === 'human' && (
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-[720px] px-6 py-6 flex flex-col gap-6">
            {/* Title */}
            <ConceptTitleEditor conceptId={concept.id} title={concept.title} />

            {/* Archetype badge */}
            {archetype && (
              <div>
                <Badge>{archetype.name}</Badge>
              </div>
            )}

            {/* Properties */}
            {concept.archetype_id && (
              <ConceptPropertiesPanel conceptId={concept.id} archetypeId={concept.archetype_id} />
            )}

            {/* Body */}
            <ConceptBodyEditor conceptId={concept.id} content={concept.content} />

            {/* Attached files */}
            {files.length > 0 && (
              <div className="flex flex-col gap-1 border-t border-subtle pt-4">
                <span className="text-xs font-medium text-muted mb-1">Attached Files</span>
                {files.map((f) => {
                  const name = f.file_path.replace(/\\/g, '/').split('/').pop() ?? f.file_path;
                  return (
                    <button
                      key={f.id}
                      className="flex items-center gap-2 px-2 py-1 text-sm text-default hover:bg-surface-hover rounded transition-colors text-left"
                      onClick={() => handleFileClick(f.file_path)}
                    >
                      <Paperclip size={12} className="text-muted shrink-0" />
                      {name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
