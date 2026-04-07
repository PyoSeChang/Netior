import React, { useCallback } from 'react';
import type { EditorTab } from '@netior/shared/types';
import { useContextStore } from '../../stores/context-store';
import { useEditorStore } from '../../stores/editor-store';
import { useEditorSession } from '../../hooks/useEditorSession';
import { useI18n } from '../../hooks/useI18n';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { Button } from '../ui/Button';
import { ScrollArea } from '../ui/ScrollArea';

interface ContextEditorProps {
  tab: EditorTab;
}

interface ContextState {
  name: string;
  description: string;
}

export function ContextEditor({ tab }: ContextEditorProps): JSX.Element {
  const { t } = useI18n();
  const contextId = tab.targetId;
  const contexts = useContextStore((s) => s.contexts);
  const context = contexts.find((c) => c.id === contextId);

  const session = useEditorSession<ContextState>({
    tabId: tab.id,
    load: () => {
      const c = useContextStore.getState().contexts.find((ctx) => ctx.id === contextId);
      if (!c) return { name: '', description: '' };
      return { name: c.name, description: c.description ?? '' };
    },
    save: async (state) => {
      await useContextStore.getState().updateContext(contextId, {
        name: state.name,
        description: state.description || null,
      });
      useEditorStore.getState().updateTitle(tab.id, state.name);
    },
    deps: [contextId],
  });

  const handleDelete = useCallback(async () => {
    await useContextStore.getState().deleteContext(contextId);
    useEditorStore.getState().closeTab(tab.id);
  }, [contextId, tab.id]);

  if (!context) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        Context not found
      </div>
    );
  }

  if (session.isLoading) return <></>;

  return (
    <ScrollArea className="h-full">
      <div className="flex items-start justify-center">
        <div className="flex flex-col gap-6 p-6 w-full max-w-[600px]">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">{t('context.name')}</label>
            <Input
              value={session.state.name}
              onChange={(e) => session.setState((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">{t('context.description')}</label>
            <TextArea
              value={session.state.description}
              onChange={(e) => session.setState((prev) => ({ ...prev, description: e.target.value }))}
              rows={4}
            />
          </div>

          {/* Delete */}
          <div className="pt-4 border-t border-subtle">
            <Button
              size="sm"
              variant="ghost"
              className="text-status-error hover:text-status-error"
              onClick={handleDelete}
            >
              {t('common.delete')}
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
