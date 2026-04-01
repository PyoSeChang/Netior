import React, { useState, useCallback } from 'react';
import type { EditorTab } from '@netior/shared/types';
import { NarreSessionList } from './narre/NarreSessionList';
import { NarreChat } from './narre/NarreChat';

interface NarreEditorProps {
  tab: EditorTab;
}

export function NarreEditor({ tab }: NarreEditorProps): JSX.Element {
  const [view, setView] = useState<'sessionList' | 'chat'>('sessionList');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const projectId = tab.targetId;

  const handleSelectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setView('chat');
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveSessionId(null);
    setView('chat');
  }, []);

  const handleBackToList = useCallback(() => {
    setActiveSessionId(null);
    setView('sessionList');
  }, []);

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
          />
        )}
      </div>
    </div>
  );
}
