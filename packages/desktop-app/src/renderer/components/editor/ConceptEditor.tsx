import React, { useEffect, useState, useMemo } from 'react';
import type { EditorTab, ConceptFile } from '@netior/shared/types';
import { Eye, Bot, Paperclip } from 'lucide-react';
import { conceptFileService, conceptPropertyService } from '../../services';
import { useConceptStore } from '../../stores/concept-store';
import { useArchetypeStore } from '../../stores/archetype-store';
import { useEditorStore } from '../../stores/editor-store';
import { useProjectStore } from '../../stores/project-store';
import { useCanvasStore } from '../../stores/canvas-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { ScrollArea } from '../ui/ScrollArea';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { ConceptPropertiesPanel, FieldInput } from './ConceptPropertiesPanel';
import { ConceptBodyEditor } from './ConceptBodyEditor';
import { ConceptAgentView } from './ConceptAgentView';
import { useI18n } from '../../hooks/useI18n';

type ConceptViewMode = 'human' | 'agent';

interface ConceptEditorProps {
  tab: EditorTab;
}

interface ConceptEditorState {
  title: string;
  archetypeId: string | null;
  icon: string | null;
  color: string | null;
  content: string | null;
  properties: Record<string, string | null>;
}

const isDraftTab = (tab: EditorTab) => tab.targetId.startsWith('draft-');

export function ConceptEditor({ tab }: ConceptEditorProps): JSX.Element {
  const { t } = useI18n();
  const isDraft = isDraftTab(tab);
  const currentProject = useProjectStore((s) => s.currentProject);
  const concepts = useConceptStore((s) => s.concepts);
  const { createConcept, updateConcept, loadByProject, upsertProperty } = useConceptStore();
  const archetypes = useArchetypeStore((s) => s.archetypes);
  const fields = useArchetypeStore((s) => s.fields);
  const loadFields = useArchetypeStore((s) => s.loadFields);
  const { addNode, openCanvas } = useCanvasStore();

  const concept = isDraft ? undefined : concepts.find((c) => c.id === tab.targetId);
  const [viewMode, setViewMode] = useState<ConceptViewMode>('human');
  const [files, setFiles] = useState<ConceptFile[]>([]);
  const rootDir = currentProject?.root_dir ?? '';

  // Load concept if missing
  useEffect(() => {
    if (!isDraft && !concept && currentProject) {
      loadByProject(currentProject.id);
    }
  }, [isDraft, concept, currentProject, loadByProject]);

  // Load files for existing concept
  useEffect(() => {
    if (!isDraft) {
      conceptFileService.getByConcept(tab.targetId).then(setFiles).catch(() => {});
    }
  }, [isDraft, tab.targetId]);

  const session = useEditorSession<ConceptEditorState>({
    tabId: tab.id,
    load: isDraft
      ? () => ({
          title: tab.title,
          archetypeId: null,
          icon: null,
          color: null,
          content: null,
          properties: {},
        })
      : async () => {
          const c = useConceptStore.getState().concepts.find((cc) => cc.id === tab.targetId);
          // Load properties
          const props = await conceptPropertyService.getByConcept(tab.targetId);
          const propsMap: Record<string, string | null> = {};
          for (const p of props) {
            propsMap[p.field_id] = p.value;
          }
          return {
            title: c?.title ?? '',
            archetypeId: c?.archetype_id ?? null,
            icon: c?.icon ?? null,
            color: c?.color ?? null,
            content: c?.content ?? null,
            properties: propsMap,
          };
        },
    save: isDraft
      ? async (state) => {
          if (!currentProject || !state.title.trim()) return;
          const draft = tab.draftData;
          const newConcept = await createConcept({
            project_id: currentProject.id,
            title: state.title.trim(),
            archetype_id: state.archetypeId || undefined,
            icon: state.icon || undefined,
            color: state.color || undefined,
            content: state.content || undefined,
          });
          // Save properties
          for (const [fieldId, value] of Object.entries(state.properties)) {
            if (value != null) {
              await upsertProperty({ concept_id: newConcept.id, field_id: fieldId, value });
            }
          }
          // Add node to canvas if draft has canvas info
          if (draft?.canvasId) {
            await addNode({
              canvas_id: draft.canvasId,
              concept_id: newConcept.id,
              position_x: draft.positionX ?? 0,
              position_y: draft.positionY ?? 0,
            });
            await openCanvas(draft.canvasId);
            const canvasStore = useCanvasStore.getState();
            if (canvasStore.currentCanvas?.project_id) {
              await canvasStore.loadCanvasTree(canvasStore.currentCanvas.project_id);
            }
          }
          // Close draft tab, open real concept tab
          const editorStore = useEditorStore.getState();
          editorStore.closeTab(tab.id);
          editorStore.openTab({
            type: 'concept',
            targetId: newConcept.id,
            title: newConcept.title,
          });
        }
      : async (state) => {
          const conceptId = tab.targetId;
          await updateConcept(conceptId, {
            title: state.title,
            archetype_id: state.archetypeId,
            icon: state.icon,
            color: state.color,
            content: state.content,
          });
          // Upsert each property
          for (const [fieldId, value] of Object.entries(state.properties)) {
            await upsertProperty({ concept_id: conceptId, field_id: fieldId, value });
          }
          useEditorStore.getState().updateTitle(tab.id, state.title);
        },
    deps: isDraft ? [] : [tab.targetId, concept?.archetype_id],
  });

  // Load fields when archetype changes
  const currentArchetypeId = session.state?.archetypeId;
  useEffect(() => {
    if (currentArchetypeId && !fields[currentArchetypeId]) {
      loadFields(currentArchetypeId);
    }
  }, [currentArchetypeId, fields, loadFields]);

  // Apply archetype defaults for draft
  useEffect(() => {
    if (!isDraft || !currentArchetypeId) return;
    const arch = archetypes.find((a) => a.id === currentArchetypeId);
    if (arch) {
      session.setState((prev) => ({
        ...prev,
        icon: prev.icon || arch.icon || null,
        color: prev.color || arch.color || null,
      }));
    }
  }, [isDraft, currentArchetypeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select first archetype if restricted
  const allowedIds = tab.draftData?.allowedArchetypeIds;
  const filteredArchetypes = allowedIds
    ? archetypes.filter((a) => allowedIds.includes(a.id))
    : archetypes;

  useEffect(() => {
    if (isDraft && allowedIds && !currentArchetypeId && filteredArchetypes.length > 0) {
      session.setState((prev) => ({ ...prev, archetypeId: filteredArchetypes[0].id }));
    }
  }, [isDraft, allowedIds, currentArchetypeId, filteredArchetypes]); // eslint-disable-line react-hooks/exhaustive-deps

  const archetypeOptions = useMemo(() => [
    ...(allowedIds ? [] : [{ value: '', label: t('common.none') ?? 'None' }]),
    ...filteredArchetypes.map((a) => ({ value: a.id, label: a.name })),
  ], [filteredArchetypes, allowedIds, t]);

  const archetypeFields = currentArchetypeId ? (fields[currentArchetypeId] ?? []) : [];

  const handleFileClick = (filePath: string) => {
    if (!rootDir) return;
    const absolutePath = `${rootDir}/${filePath}`;
    const fileName = filePath.replace(/\\/g, '/').split('/').pop() ?? filePath;
    useEditorStore.getState().openTab({
      type: 'file',
      targetId: absolutePath,
      title: fileName,
    });
  };

  // Loading states
  if (!isDraft && !concept) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        Loading...
      </div>
    );
  }

  if (session.isLoading) return <></>;

  const update = (patch: Partial<ConceptEditorState>) => {
    session.setState((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* View mode toggle (existing only) / Draft header */}
      {isDraft ? (
        <div className="flex shrink-0 items-center justify-between border-b border-subtle bg-surface-panel px-3 py-1.5">
          <span className="text-xs text-muted">{t('concept.create') ?? 'New Concept'}</span>
        </div>
      ) : (
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
      )}

      {/* Agent view (existing only) */}
      {!isDraft && viewMode === 'agent' && (
        <div className="flex-1 overflow-hidden">
          <ConceptAgentView conceptId={tab.targetId} agentContent={concept?.agent_content ?? null} />
        </div>
      )}

      {/* Human view (both draft and existing) */}
      {(isDraft || viewMode === 'human') && (
        <ScrollArea className="flex-1 min-h-0">
          <div className="mx-auto max-w-[720px] px-6 py-4 flex flex-col gap-4">
            {/* Title */}
            <Input
              value={session.state.title}
              onChange={(e) => {
                update({ title: e.target.value });
                useEditorStore.getState().updateTitle(tab.id, e.target.value);
              }}
              placeholder={t('concept.title') ?? 'Title'}
              inputSize={isDraft ? undefined : 'sm'}
              autoFocus={isDraft}
            />

            {/* Archetype selector */}
            {archetypes.length > 0 && (
              <div>
                {isDraft && <label className="mb-1 block text-xs font-medium text-secondary">{t('concept.archetype') ?? 'Archetype'}</label>}
                <Select
                  options={archetypeOptions}
                  value={session.state.archetypeId ?? ''}
                  onChange={(e) => {
                    update({ archetypeId: e.target.value || null, properties: {} });
                  }}
                  selectSize="sm"
                />
              </div>
            )}

            {/* Properties */}
            {session.state.archetypeId && (
              isDraft ? (
                archetypeFields.length > 0 && (
                  <div className="flex flex-col gap-2 border-b border-subtle px-3 py-3">
                    {archetypeFields.map((field) => (
                      <FieldInput
                        key={field.id}
                        field={field}
                        value={session.state.properties[field.id] ?? null}
                        onChange={(val) => update({
                          properties: { ...session.state.properties, [field.id]: val },
                        })}
                      />
                    ))}
                  </div>
                )
              ) : (
                <ConceptPropertiesPanel
                  archetypeId={session.state.archetypeId}
                  properties={session.state.properties}
                  onChange={(fieldId, value) => update({
                    properties: { ...session.state.properties, [fieldId]: value },
                  })}
                />
              )
            )}

            {/* Body */}
            <ConceptBodyEditor
              content={session.state.content ?? ''}
              onChange={(content) => update({ content: content || null })}
            />

            {/* Attached files (existing only) */}
            {!isDraft && files.length > 0 && (
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
