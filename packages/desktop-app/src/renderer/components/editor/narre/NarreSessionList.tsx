import React, { useEffect, useState } from 'react';
import { MessageSquare, Plus, Sparkles } from 'lucide-react';
import type { NarreSession } from '@netior/shared/types';
import { narreService } from '../../../services/narre-service';
import { useI18n } from '../../../hooks/useI18n';
import { Button } from '../../ui/Button';
import { ScrollArea } from '../../ui/ScrollArea';
import { Spinner } from '../../ui/Spinner';

interface NarreSessionListProps {
  projectId: string;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export function NarreSessionList({
  projectId,
  onSelectSession,
  onNewChat,
}: NarreSessionListProps): JSX.Element {
  const { t } = useI18n();
  const [sessions, setSessions] = useState<NarreSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    narreService.listSessions(projectId).then((data) => {
      if (!cancelled) {
        setSessions(data);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
        <h2 className="text-sm font-medium text-default">
          {t('narre.recentChats')}
        </h2>
        <Button size="sm" onClick={onNewChat}>
          <Plus size={14} className="mr-1" />
          {t('narre.newChat')}
        </Button>
      </div>

      {/* Session list or empty state */}
      {sessions.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover">
            <Sparkles size={24} className="text-muted" />
          </div>
          <p className="text-sm text-secondary">
            {t('narre.noSessions')}
          </p>
          <p className="text-xs text-muted">
            {t('narre.startChat')}
          </p>
          <Button size="sm" onClick={onNewChat}>
            <Plus size={14} className="mr-1" />
            {t('narre.newChat')}
          </Button>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1 p-2">
            {sessions.map((session) => (
              <button
                key={session.id}
                className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors bg-surface-card hover:bg-surface-hover"
                onClick={() => onSelectSession(session.id)}
              >
                <div className="mt-0.5 shrink-0">
                  <MessageSquare size={16} className="text-muted" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-default">
                    {session.title || t('narre.newChat')}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatRelativeTime(session.last_message_at)}
                    {' · '}
                    {t('narre.messageCount', { count: session.message_count })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
