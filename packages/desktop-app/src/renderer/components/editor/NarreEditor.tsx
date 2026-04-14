import React, { useState, useCallback } from 'react';
import type { EditorTab } from '@netior/shared/types';
import { NarreSessionList } from './narre/NarreSessionList';
import { NarreChat } from './narre/NarreChat';
import { getNarreProjectUiState, updateNarreProjectUiState } from '../../lib/narre-ui-state';

interface NarreEditorProps {
  tab: EditorTab;
}

// Persist view/session state across tab switches (component unmounts/remounts)
const narreStateCache = new Map<string, { view: 'sessionList' | 'chat'; sessionId: string | null }>();

export function NarreEditor({ tab }: NarreEditorProps): JSX.Element {
  const projectId = tab.targetId;
  const persisted = getNarreProjectUiState(projectId);
  const cached = narreStateCache.get(projectId) ?? {
    view: persisted.view,
    sessionId: persisted.activeSessionId,
  };

  const [view, setView] = useState<'sessionList' | 'chat'>(cached?.view ?? 'sessionList');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(cached?.sessionId ?? null);

  const updateCache = (v: 'sessionList' | 'chat', sid: string | null) => {
    narreStateCache.set(projectId, { view: v, sessionId: sid });
    updateNarreProjectUiState(projectId, (prev) => ({
      ...prev,
      view: v,
      activeSessionId: sid,
    }));
  };

  const handleSelectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setView('chat');
    updateCache('chat', sessionId);
  }, [projectId]);

  const handleNewChat = useCallback(() => {
    setActiveSessionId(null);
    setView('chat');
    updateCache('chat', null);
  }, [projectId]);

  const handleBackToList = useCallback(() => {
    setActiveSessionId(null);
    setView('sessionList');
    updateCache('sessionList', null);
  }, [projectId]);

  const handleSessionCreated = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    updateCache('chat', sessionId);
  }, [projectId]);

  return (
    <div className="flex h-full flex-col items-center">
      <div className="flex h-full w-full max-w-[600px] flex-col">
        {view === 'sessionList' ? (
          <NarreSessionList
            projectId={projectId}
            onSelectSession={handleSelectSession}
            onNewChat={handleNewChat}
          />
        ) : (
          <NarreChat
            sessionId={activeSessionId}
            projectId={projectId}
            onBackToList={handleBackToList}
            onSessionCreated={handleSessionCreated}
          />
        )}
      </div>
    </div>
  );
}
