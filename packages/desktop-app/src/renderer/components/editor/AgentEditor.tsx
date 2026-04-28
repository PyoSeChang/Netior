import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, FileText, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import type { EditorTab, NarreUserAgentType, UserAgentRecord, UserAgentSkillSummary } from '@netior/shared/types';
import { agentService } from '../../services/agent-service';
import { useI18n } from '../../hooks/useI18n';
import { useProjectStore } from '../../stores/project-store';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { Badge } from '../ui/Badge';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Spinner } from '../ui/Spinner';

interface AgentEditorProps {
  tab: EditorTab;
}

interface AgentDraft {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userAgentType: NarreUserAgentType;
}

interface SkillDraft {
  id: string;
  name: string;
  description: string;
  body: string;
}

type PendingDelete =
  | { type: 'agent'; agent: UserAgentRecord }
  | { type: 'skill'; agent: UserAgentRecord; skill: UserAgentSkillSummary };

function toSafeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getAgentKey(agent: Pick<UserAgentRecord, 'userAgentType' | 'id'>): string {
  return `${agent.userAgentType}:${agent.id}`;
}

function toAgentDraft(agent: UserAgentRecord): AgentDraft {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    systemPrompt: agent.systemPrompt,
    userAgentType: agent.userAgentType,
  };
}

function toSkillDraft(skill: UserAgentSkillSummary): SkillDraft {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    body: skill.body,
  };
}

function buildEmptySkillBody(
  t: (key: import('@netior/shared/i18n').TranslationKey, params?: Record<string, string | number>) => string,
): string {
  return [
    `# ${t('agentEditor.defaultSkillBodyTitle')}`,
    '',
    t('agentEditor.defaultSkillBodyDescription'),
  ].join('\n');
}

export function AgentEditor({ tab }: AgentEditorProps): JSX.Element {
  const { t } = useI18n();
  const tk = (key: string, params?: Record<string, string | number>) =>
    t(key as import('@netior/shared/i18n').TranslationKey, params);
  const currentProject = useProjectStore((state) => state.currentProject);
  const projectId = tab.targetId === 'global' ? currentProject?.id ?? null : tab.targetId;
  const [agents, setAgents] = useState<UserAgentRecord[]>([]);
  const [selectedAgentKey, setSelectedAgentKey] = useState<string | null>(null);
  const [agentDraft, setAgentDraft] = useState<AgentDraft | null>(null);
  const [isNewAgent, setIsNewAgent] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [skillDraft, setSkillDraft] = useState<SkillDraft | null>(null);
  const [isNewSkill, setIsNewSkill] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const selectionRef = useRef<{ agentKey: string | null; skillId: string | null }>({
    agentKey: null,
    skillId: null,
  });

  useEffect(() => {
    selectionRef.current = {
      agentKey: selectedAgentKey,
      skillId: selectedSkillId,
    };
  }, [selectedAgentKey, selectedSkillId]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => getAgentKey(agent) === selectedAgentKey) ?? null,
    [agents, selectedAgentKey],
  );

  const selectedSkill = useMemo(
    () => selectedAgent?.skills.find((skill) => skill.id === selectedSkillId) ?? null,
    [selectedAgent, selectedSkillId],
  );

  const translateAgentError = useCallback((message: string): string => {
    switch (message) {
      case 'Failed to load agents':
        return tk('agentEditor.error.loadAgents');
      case 'Failed to save agent':
        return tk('agentEditor.error.saveAgent');
      case 'Failed to delete agent':
        return tk('agentEditor.error.deleteAgent');
      case 'Failed to save skill':
        return tk('agentEditor.error.saveSkill');
      case 'Failed to delete skill':
        return tk('agentEditor.error.deleteSkill');
      case 'Agent name is required':
        return tk('agentEditor.error.agentNameRequired');
      case 'Skill name is required':
        return tk('agentEditor.error.skillNameRequired');
      case 'Skill description is required':
        return tk('agentEditor.error.skillDescriptionRequired');
      case 'Skill body is required':
        return tk('agentEditor.error.skillBodyRequired');
      case 'projectId is required for project agents':
      case 'Project agent requires an active project':
        return tk('agentEditor.error.projectIdRequired');
      default:
        if (message.startsWith('Invalid id: ')) {
          return tk('agentEditor.error.invalidId', { value: message.slice('Invalid id: '.length) });
        }
        return message;
    }
  }, [t]);

  const selectAgent = useCallback((agent: UserAgentRecord): void => {
    setSelectedAgentKey(getAgentKey(agent));
    setAgentDraft(toAgentDraft(agent));
    setIsNewAgent(false);
    const firstSkill = agent.skills[0] ?? null;
    setSelectedSkillId(firstSkill?.id ?? null);
    setSkillDraft(firstSkill ? toSkillDraft(firstSkill) : null);
    setIsNewSkill(false);
    setView('detail');
  }, []);

  const loadAgents = useCallback(async (preferredAgentKey?: string | null, preferredSkillId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const nextAgents = await agentService.listDefinitions(projectId);
      setAgents(nextAgents);
      const currentSelection = selectionRef.current;
      const nextSelected = nextAgents.find((agent) => getAgentKey(agent) === preferredAgentKey)
        ?? nextAgents.find((agent) => getAgentKey(agent) === currentSelection.agentKey)
        ?? null;

      if (nextSelected) {
        setSelectedAgentKey(getAgentKey(nextSelected));
        setAgentDraft(toAgentDraft(nextSelected));
        setIsNewAgent(false);
        const nextSkill = nextSelected.skills.find((skill) => skill.id === preferredSkillId)
          ?? nextSelected.skills.find((skill) => skill.id === currentSelection.skillId)
          ?? nextSelected.skills[0]
          ?? null;
        setSelectedSkillId(nextSkill?.id ?? null);
        setSkillDraft(nextSkill ? toSkillDraft(nextSkill) : null);
        setIsNewSkill(false);
      } else {
        setSelectedAgentKey(null);
        setAgentDraft(null);
        setIsNewAgent(false);
        setSelectedSkillId(null);
        setSkillDraft(null);
        setIsNewSkill(false);
        setView('list');
      }
    } catch (loadError) {
      setError(translateAgentError(loadError instanceof Error ? loadError.message : 'Failed to load agents'));
    } finally {
      setLoading(false);
    }
  }, [projectId, translateAgentError]);

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  const startNewAgent = (userAgentType: NarreUserAgentType): void => {
    setSelectedAgentKey(null);
    setAgentDraft({
      id: '',
      name: userAgentType === 'project' ? tk('agentEditor.scopeProject') : tk('agentEditor.scopeGlobal'),
      description: '',
      systemPrompt: '',
      userAgentType,
    });
    setIsNewAgent(true);
    setSelectedSkillId(null);
    setSkillDraft(null);
    setIsNewSkill(false);
    setView('detail');
  };

  const saveAgent = async (): Promise<void> => {
    if (!agentDraft) {
      return;
    }
    if (agentDraft.userAgentType === 'project' && !projectId) {
      setError(tk('agentEditor.projectRequired'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await agentService.upsertDefinition({
        id: agentDraft.id || undefined,
        name: agentDraft.name,
        description: agentDraft.description,
        systemPrompt: agentDraft.systemPrompt,
        userAgentType: agentDraft.userAgentType,
        ...(agentDraft.userAgentType === 'project' && projectId ? { projectId } : {}),
      });
      await loadAgents(getAgentKey(saved), selectedSkillId);
      setView('detail');
    } catch (saveError) {
      setError(translateAgentError(saveError instanceof Error ? saveError.message : 'Failed to save agent'));
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedAgent = async (agent: UserAgentRecord): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      await agentService.deleteDefinition({
        agentId: agent.id,
        userAgentType: agent.userAgentType,
        ...(agent.projectId ? { projectId: agent.projectId } : {}),
      });
      setPendingDelete(null);
      setView('list');
      await loadAgents(null, null);
    } catch (deleteError) {
      setError(translateAgentError(deleteError instanceof Error ? deleteError.message : 'Failed to delete agent'));
    } finally {
      setSaving(false);
    }
  };

  const startNewSkill = (): void => {
    setSelectedSkillId(null);
    setSkillDraft({
      id: '',
      name: tk('agentEditor.defaultSkillName'),
      description: '',
      body: buildEmptySkillBody(t),
    });
    setIsNewSkill(true);
  };

  const selectSkill = (skill: UserAgentSkillSummary): void => {
    setSelectedSkillId(skill.id);
    setSkillDraft(toSkillDraft(skill));
    setIsNewSkill(false);
  };

  const saveSkill = async (): Promise<void> => {
    if (!selectedAgent || !skillDraft) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await agentService.upsertSkill({
        agentId: selectedAgent.id,
        userAgentType: selectedAgent.userAgentType,
        ...(selectedAgent.projectId ? { projectId: selectedAgent.projectId } : {}),
        skillId: skillDraft.id || undefined,
        name: skillDraft.name,
        description: skillDraft.description,
        body: skillDraft.body,
      });
      await loadAgents(getAgentKey(selectedAgent), saved.id);
    } catch (saveError) {
      setError(translateAgentError(saveError instanceof Error ? saveError.message : 'Failed to save skill'));
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedSkill = async (agent: UserAgentRecord, skill: UserAgentSkillSummary): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      await agentService.deleteSkill({
        agentId: agent.id,
        userAgentType: agent.userAgentType,
        ...(agent.projectId ? { projectId: agent.projectId } : {}),
        skillId: skill.id,
      });
      setPendingDelete(null);
      await loadAgents(getAgentKey(agent), null);
    } catch (deleteError) {
      setError(translateAgentError(deleteError instanceof Error ? deleteError.message : 'Failed to delete skill'));
    } finally {
      setSaving(false);
    }
  };

  const canCreateProjectAgent = Boolean(projectId);

  const handleBackToList = (): void => {
    setView('list');
    setError(null);
    if (isNewAgent) {
      setAgentDraft(null);
      setIsNewAgent(false);
      setSelectedAgentKey(null);
      setSelectedSkillId(null);
      setSkillDraft(null);
      setIsNewSkill(false);
    }
  };

  const confirmDialog = (
    <ConfirmDialog
      open={Boolean(pendingDelete)}
      onClose={() => setPendingDelete(null)}
      title={pendingDelete?.type === 'agent' ? tk('agentEditor.deleteAgentTitle') : tk('agentEditor.deleteSkillTitle')}
      message={pendingDelete?.type === 'agent'
        ? tk('agentEditor.deleteAgentMessage', { name: pendingDelete.agent.name })
        : tk('agentEditor.deleteSkillMessage', { name: pendingDelete?.skill.name ?? '' })}
      confirmLabel={t('common.delete')}
      isLoading={saving}
      onConfirm={() => {
        if (!pendingDelete) {
          return;
        }
        if (pendingDelete.type === 'agent') {
          void deleteSelectedAgent(pendingDelete.agent);
          return;
        }
        void deleteSelectedSkill(pendingDelete.agent, pendingDelete.skill);
      }}
    />
  );

  if (view === 'list') {
    return (
      <div className="editor-scrollbar h-full min-h-0 overflow-y-scroll bg-surface-editor text-default">
        <div className="mx-auto flex w-full max-w-[980px] flex-col gap-5 px-6 py-5">
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => void loadAgents()}>
              <RefreshCw size={14} />
              {tk('agentEditor.refresh')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => startNewAgent('global')}>
              <Plus size={14} />
              {tk('agentEditor.newGlobal')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!canCreateProjectAgent}
              onClick={() => startNewAgent('project')}
            >
              <Plus size={14} />
              {tk('agentEditor.newProject')}
            </Button>
          </div>

          {error && (
            <div className="rounded-xl border border-subtle bg-surface-card px-4 py-3 text-sm text-status-error">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : agents.length === 0 ? (
            <div className="rounded-xl border border-subtle bg-surface-card px-5 py-12 text-center text-sm text-muted">
              {tk('agentEditor.noAgents')}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {agents.map((agent) => {
                const key = getAgentKey(agent);
                return (
                  <button
                    key={key}
                    type="button"
                    className="group flex min-h-[148px] flex-col justify-between rounded-xl border border-subtle bg-surface-card p-4 text-left transition-colors hover:border-default hover:bg-state-hover"
                    onClick={() => selectAgent(agent)}
                  >
                    <span className="flex min-w-0 items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-base font-semibold text-default">{agent.name}</span>
                        <span className="mt-1 block truncate text-sm text-secondary">{agent.description || agent.id}</span>
                      </span>
                      <Badge variant={agent.userAgentType === 'project' ? 'accent' : 'default'}>
                        {agent.userAgentType === 'project' ? tk('agentEditor.scopeProject') : tk('agentEditor.scopeGlobal')}
                      </Badge>
                    </span>
                    <span className="mt-4 flex items-center justify-between gap-3 text-xs text-muted">
                      <span>{tk('agentEditor.skillCount', { count: agent.skills.length })}</span>
                      <span className="font-mono">{agent.id}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {confirmDialog}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-editor text-default">
      <div className="editor-scrollbar min-h-0 flex-1 overflow-y-scroll overflow-x-hidden">
        <div className="mx-auto flex w-full max-w-[980px] flex-col gap-5 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button size="sm" variant="ghost" onClick={handleBackToList}>
              <ArrowLeft size={14} />
              {tk('agentEditor.backToList')}
            </Button>
            {agentDraft && (
              <div className="flex shrink-0 flex-wrap gap-2">
                {selectedAgent && !isNewAgent && (
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={saving}
                    onClick={() => setPendingDelete({ type: 'agent', agent: selectedAgent })}
                  >
                    <Trash2 size={14} />
                    {t('common.delete')}
                  </Button>
                )}
                <Button size="sm" disabled={saving} isLoading={saving} onClick={() => void saveAgent()}>
                  <Save size={14} />
                  {t('common.save')}
                </Button>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-subtle bg-surface-card px-4 py-3 text-sm text-status-error">
              {error}
            </div>
          )}

          {agentDraft ? (
            <>
              <section className="rounded-xl border border-subtle bg-surface-card p-5">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-default">{tk('agentEditor.agentSectionTitle')}</h3>
                  <p className="mt-1 text-xs text-muted">{tk('agentEditor.agentSectionDescription')}</p>
                </div>
                <div className="flex max-w-[720px] flex-col gap-4">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                    <Field label={tk('agentEditor.idLabel')}>
                      <Input
                        value={agentDraft.id}
                        disabled={!isNewAgent}
                        placeholder={toSafeId(agentDraft.name) || tk('agentEditor.idPlaceholder')}
                        onChange={(event) => setAgentDraft({ ...agentDraft, id: event.target.value })}
                      />
                    </Field>
                    <Field label={tk('agentEditor.scopeLabel')}>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          isActive={agentDraft.userAgentType === 'global'}
                          disabled={!isNewAgent}
                          onClick={() => setAgentDraft({ ...agentDraft, userAgentType: 'global' })}
                        >
                          {tk('agentEditor.scopeGlobal')}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          isActive={agentDraft.userAgentType === 'project'}
                          disabled={!isNewAgent || !canCreateProjectAgent}
                          onClick={() => setAgentDraft({ ...agentDraft, userAgentType: 'project' })}
                        >
                          {tk('agentEditor.scopeProject')}
                        </Button>
                      </div>
                    </Field>
                  </div>
                  <Field label={tk('agentEditor.nameLabel')}>
                    <Input
                      value={agentDraft.name}
                      onChange={(event) => {
                        const name = event.target.value;
                        setAgentDraft({
                          ...agentDraft,
                          name,
                          id: isNewAgent ? toSafeId(name) : agentDraft.id,
                        });
                      }}
                    />
                  </Field>
                  <Field label={tk('agentEditor.descriptionLabel')}>
                    <TextArea
                      value={agentDraft.description}
                      className="min-h-[96px]"
                      onChange={(event) => setAgentDraft({ ...agentDraft, description: event.target.value })}
                    />
                  </Field>
                  <Field label={tk('agentEditor.systemPromptLabel')}>
                    <TextArea
                      value={agentDraft.systemPrompt}
                      className="min-h-[220px]"
                      placeholder={tk('agentEditor.systemPromptPlaceholder')}
                      onChange={(event) => setAgentDraft({ ...agentDraft, systemPrompt: event.target.value })}
                    />
                  </Field>
                  {selectedAgent && !isNewAgent && (
                    <Field label={tk('agentEditor.storageLabel')}>
                      <div className="break-all rounded-lg border border-subtle bg-surface-editor px-3 py-2 text-xs text-muted">
                        {selectedAgent.rootDir}
                      </div>
                    </Field>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-subtle bg-surface-card p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-default">{tk('agentEditor.skillSectionTitle')}</h3>
                    <p className="mt-1 text-xs text-muted">{tk('agentEditor.skillSectionDescription')}</p>
                  </div>
                  <Button size="sm" variant="secondary" disabled={!selectedAgent || isNewAgent} onClick={startNewSkill}>
                    <Plus size={14} />
                    {tk('agentEditor.newSkill')}
                  </Button>
                </div>

                {!selectedAgent || isNewAgent ? (
                  <div className="rounded-lg border border-subtle bg-surface-editor px-4 py-6 text-sm text-muted">
                    {tk('agentEditor.saveBeforeSkills')}
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="flex flex-col gap-2">
                      {selectedAgent.skills.length === 0 ? (
                        <div className="rounded-lg border border-subtle bg-surface-editor px-4 py-6 text-sm text-muted">
                          {tk('agentEditor.noSkills')}
                        </div>
                      ) : (
                        selectedAgent.skills.map((skill) => (
                          <button
                            key={skill.id}
                            type="button"
                            className={[
                              'flex items-start gap-3 rounded-lg border border-subtle px-3 py-3 text-left transition-colors',
                              skill.id === selectedSkillId ? 'bg-state-selected text-accent' : 'bg-surface-editor text-default hover:bg-state-hover',
                            ].join(' ')}
                            onClick={() => selectSkill(skill)}
                          >
                            <FileText size={15} className="mt-0.5 shrink-0" />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">/{skill.name}</span>
                              <span className="block truncate text-xs text-muted">{skill.description || skill.id}</span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>

                    <div className="rounded-lg border border-subtle bg-surface-editor p-4">
                      {skillDraft ? (
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-default">{skillDraft.name || tk('agentEditor.newSkill')}</div>
                              <div className="mt-1 text-xs text-muted">{skillDraft.id || tk('agentEditor.skillIdPlaceholder')}</div>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              {selectedAgent && selectedSkill && !isNewSkill && (
                                <Button
                                  variant="danger"
                                  size="sm"
                                  disabled={saving}
                                  onClick={() => setPendingDelete({ type: 'skill', agent: selectedAgent, skill: selectedSkill })}
                                >
                                  <Trash2 size={13} />
                                  {t('common.delete')}
                                </Button>
                              )}
                              <Button size="sm" disabled={!selectedAgent || saving} isLoading={saving} onClick={() => void saveSkill()}>
                                <Save size={13} />
                                {t('common.save')}
                              </Button>
                            </div>
                          </div>
                          <Field label={tk('agentEditor.skillIdLabel')}>
                            <Input
                              value={skillDraft.id}
                              disabled={!isNewSkill}
                              placeholder={toSafeId(skillDraft.name) || tk('agentEditor.skillIdPlaceholder')}
                              onChange={(event) => setSkillDraft({ ...skillDraft, id: event.target.value })}
                            />
                          </Field>
                          <Field label={tk('agentEditor.skillNameLabel')}>
                            <Input
                              value={skillDraft.name}
                              onChange={(event) => {
                                const name = event.target.value;
                                setSkillDraft({
                                  ...skillDraft,
                                  name,
                                  id: isNewSkill ? toSafeId(name) : skillDraft.id,
                                });
                              }}
                            />
                          </Field>
                          <Field label={tk('agentEditor.skillDescriptionLabel')}>
                            <TextArea
                              value={skillDraft.description}
                              onChange={(event) => setSkillDraft({ ...skillDraft, description: event.target.value })}
                            />
                          </Field>
                          <Field label={tk('agentEditor.skillBodyLabel')}>
                            <TextArea
                              value={skillDraft.body}
                              className="min-h-[280px] font-mono"
                              onChange={(event) => setSkillDraft({ ...skillDraft, body: event.target.value })}
                            />
                          </Field>
                          {selectedSkill && !isNewSkill && (
                            <Field label={tk('agentEditor.fileLabel')}>
                              <div className="break-all rounded-lg border border-subtle bg-surface-panel px-3 py-2 text-xs text-muted">
                                {selectedSkill.skillFilePath}
                              </div>
                            </Field>
                          )}
                        </div>
                      ) : (
                        <EmptyState title={tk('agentEditor.noSkillSelectedTitle')} detail={tk('agentEditor.noSkillSelectedDetail')} />
                      )}
                    </div>
                  </div>
                )}
              </section>
            </>
          ) : (
            <EmptyState title={tk('agentEditor.noAgentSelectedTitle')} detail={tk('agentEditor.noAgentSelectedDetail')} />
          )}
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="block">
      <span className="mb-1.5 block text-xs font-medium text-secondary">{label}</span>
      {children}
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }): JSX.Element {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center">
      <div className="text-center">
        <div className="text-sm font-medium text-default">{title}</div>
        <div className="mt-1 text-xs text-muted">{detail}</div>
      </div>
    </div>
  );
}
