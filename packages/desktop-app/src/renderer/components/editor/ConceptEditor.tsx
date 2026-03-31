import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { EditorTab, ConceptFile } from '@moc/shared/types';
import { Eye, Bot, Paperclip, Save } from 'lucide-react';
import { conceptFileService } from '../../services';
import { useConceptStore } from '../../stores/concept-store';
import { useArchetypeStore } from '../../stores/archetype-store';
import { useEditorStore } from '../../stores/editor-store';
import { useProjectStore } from '../../stores/project-store';
import { useCanvasStore } from '../../stores/canvas-store';
import { ScrollArea } from '../ui/ScrollArea';
import { Badge } from '../ui/Badge';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { ConceptPropertiesPanel, FieldInput } from './ConceptPropertiesPanel';
import { ConceptBodyEditor } from './ConceptBodyEditor';
import { ContentEditableEditor } from './ContentEditableEditor';
import { ConceptAgentView } from './ConceptAgentView';
import { useI18n } from '../../hooks/useI18n';
type ConceptViewMode = 'human' | 'agent';

interface ConceptEditorProps {
  tab: EditorTab;
}

const isDraft = (tab: EditorTab) => tab.targetId.startsWith('draft-');

/** Draft mode: concept not yet created in DB */
function DraftConceptEditor({ tab }: ConceptEditorProps): JSX.Element {
  const { t } = useI18n();
  const currentProject = useProjectStore((s) => s.currentProject);
  const archetypes = useArchetypeStore((s) => s.archetypes);
  const { createConcept } = useConceptStore();
  const { addNode, openCanvas } = useCanvasStore();

  const fields = useArchetypeStore((s) => s.fields);
  const loadFields = useArchetypeStore((s) => s.loadFields);

  const [title, setTitle] = useState(tab.title);
  const [archetypeId, setArchetypeId] = useState<string>('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');
  const [content, setContent] = useState('');
  const [draftProperties, setDraftProperties] = useState<Record<string, string | null>>({});

  // Load fields when archetype changes
  useEffect(() => {
    if (archetypeId && !fields[archetypeId]) {
      loadFields(archetypeId);
    }
  }, [archetypeId, fields, loadFields]);

  // Apply archetype defaults
  useEffect(() => {
    if (archetypeId) {
      const arch = archetypes.find((a) => a.id === archetypeId);
      if (arch) {
        if (arch.icon && !icon) setIcon(arch.icon);
        if (arch.color && !color) setColor(arch.color);
      }
    }
    // Reset properties when archetype changes
    setDraftProperties({});
  }, [archetypeId]);

  const archetypeFields = archetypeId ? (fields[archetypeId] ?? []) : [];

  const archetypeOptions = useMemo(() => [
    { value: '', label: t('common.none') ?? 'None' },
    ...archetypes.map((a) => ({ value: a.id, label: a.name })),
  ], [archetypes, t]);

  const upsertProperty = useConceptStore((s) => s.upsertProperty);

  const handleSave = useCallback(async () => {
    if (!currentProject || !title.trim()) return;
    const draft = tab.draftData;

    // Create concept in DB
    const concept = await createConcept({
      project_id: currentProject.id,
      title: title.trim(),
      archetype_id: archetypeId || undefined,
      icon: icon || undefined,
      color: color || undefined,
      content: content || undefined,
    });

    // Save draft properties
    for (const [fieldId, value] of Object.entries(draftProperties)) {
      if (value != null) {
        await upsertProperty({ concept_id: concept.id, field_id: fieldId, value });
      }
    }

    // Add node to canvas if draft has canvas info
    if (draft?.canvasId) {
      await addNode({
        canvas_id: draft.canvasId,
        concept_id: concept.id,
        position_x: draft.positionX ?? 0,
        position_y: draft.positionY ?? 0,
      });
      await openCanvas(draft.canvasId);
    }

    // Close draft tab, open real concept tab
    const editorStore = useEditorStore.getState();
    editorStore.closeTab(tab.id);
    editorStore.openTab({
      type: 'concept',
      targetId: concept.id,
      title: concept.title,
    });
  }, [currentProject, title, archetypeId, icon, color, content, draftProperties, tab, createConcept, upsertProperty, addNode, openCanvas]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-subtle bg-surface-panel px-3 py-1.5">
        <span className="text-xs text-muted">{t('concept.create') ?? 'New Concept'}</span>
        <Button size="sm" onClick={handleSave} disabled={!title.trim()}>
          <Save size={12} />
          {t('common.save')}
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="mx-auto max-w-[720px] px-6 py-4 flex flex-col gap-4">
          {/* Title */}
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              useEditorStore.getState().updateTitle(tab.id, e.target.value);
            }}
            placeholder={t('concept.title') ?? 'Title'}
            autoFocus
          />

          {/* Archetype selector */}
          {archetypes.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-secondary">{t('concept.archetype') ?? 'Archetype'}</label>
              <Select
                options={archetypeOptions}
                value={archetypeId}
                onChange={(e) => setArchetypeId(e.target.value)}
                selectSize="sm"
              />
            </div>
          )}

          {/* Properties (from archetype fields) */}
          {archetypeFields.length > 0 && (
            <div className="flex flex-col gap-2 border-b border-subtle px-3 py-3">
              {archetypeFields.map((field) => (
                <FieldInput
                  key={field.id}
                  field={field}
                  value={draftProperties[field.id] ?? null}
                  onChange={(val) => setDraftProperties((prev) => ({ ...prev, [field.id]: val }))}
                />
              ))}
            </div>
          )}

          {/* Content */}
          <ContentEditableEditor
            value={content}
            onChange={setContent}
            placeholder="Write something..."
            className="min-h-[120px] text-sm text-default leading-relaxed"
          />
        </div>
      </ScrollArea>
    </div>
  );
}

/** Existing concept editor (read/update mode) */
function ExistingConceptEditor({ tab }: ConceptEditorProps): JSX.Element {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState<ConceptViewMode>('human');
  const [files, setFiles] = useState<ConceptFile[]>([]);

  const currentProject = useProjectStore((s) => s.currentProject);
  const rootDir = currentProject?.root_dir ?? '';

  const concepts = useConceptStore((s) => s.concepts);
  const loadByProject = useConceptStore((s) => s.loadByProject);
  const updateConcept = useConceptStore((s) => s.updateConcept);
  const concept = concepts.find((c) => c.id === tab.targetId);

  useEffect(() => {
    if (concepts.length === 0 && currentProject) {
      loadByProject(currentProject.id);
    }
  }, [concepts.length, currentProject, loadByProject]);

  const archetypes = useArchetypeStore((s) => s.archetypes);
  const archetype = useArchetypeStore((s) =>
    concept?.archetype_id ? s.archetypes.find((a) => a.id === concept.archetype_id) : undefined,
  );

  const archetypeOptions = useMemo(() => [
    { value: '', label: t('common.none') ?? 'None' },
    ...archetypes.map((a) => ({ value: a.id, label: a.name })),
  ], [archetypes, t]);

  const handleArchetypeChange = useCallback(async (archetypeId: string) => {
    if (!concept) return;
    await updateConcept(concept.id, { archetype_id: archetypeId || null });
  }, [concept, updateConcept]);

  const handleTitleChange = useCallback(async (title: string) => {
    if (!concept) return;
    await updateConcept(concept.id, { title });
    useEditorStore.getState().updateTitle(tab.id, title);
  }, [concept, tab.id, updateConcept]);

  useEffect(() => {
    conceptFileService.getByConcept(tab.targetId).then(setFiles).catch(() => {});
  }, [tab.targetId]);

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

      {viewMode === 'agent' && (
        <div className="flex-1 overflow-hidden">
          <ConceptAgentView conceptId={tab.targetId} agentContent={concept.agent_content} />
        </div>
      )}

      {viewMode === 'human' && (
        <ScrollArea className="flex-1 min-h-0">
          <div className="mx-auto max-w-[720px] px-6 py-4 flex flex-col gap-4">
            {/* Title */}
            <Input
              value={concept.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder={t('concept.title') ?? 'Title'}
              inputSize="sm"
            />

            {/* Archetype selector */}
            {archetypes.length > 0 && (
              <div>
                <Select
                  options={archetypeOptions}
                  value={concept.archetype_id ?? ''}
                  onChange={(e) => handleArchetypeChange(e.target.value)}
                  selectSize="sm"
                />
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

export function ConceptEditor({ tab }: ConceptEditorProps): JSX.Element {
  if (isDraft(tab)) return <DraftConceptEditor tab={tab} />;
  return <ExistingConceptEditor tab={tab} />;
}
