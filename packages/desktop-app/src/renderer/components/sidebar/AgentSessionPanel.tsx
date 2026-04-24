import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, RefreshCw } from 'lucide-react';
import type {
  AgentAttentionReason,
  AgentStatus,
  SupervisorAgentSessionSnapshot,
  SupervisorEvent,
} from '@netior/shared/types';
import { useI18n } from '../../hooks/useI18n';
import { narreService } from '../../services/narre-service';
import { useEditorStore } from '../../stores/editor-store';
import { updateNarreProjectUiState } from '../../lib/narre-ui-state';
import { Badge } from '../ui/Badge';
import { IconButton } from '../ui/IconButton';
import { Spinner } from '../ui/Spinner';

const POLL_INTERVAL_MS = 5_000;

interface AgentSessionPanelProps {
  projectId: string;
}

export function AgentSessionPanel({ projectId }: AgentSessionPanelProps): JSX.Element {
  const { t, locale } = useI18n();
  const tk = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      t(key as import('@netior/shared/i18n').TranslationKey, params),
    [t],
  );
  const [sessions, setSessions] = useState<SupervisorAgentSessionSnapshot[]>([]);
  const [events, setEvents] = useState<SupervisorEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async (background = false): Promise<void> => {
    if (!background) {
      setLoading(true);
    }

    try {
      const [nextSessions, nextEvents] = await Promise.all([
        narreService.listSupervisorSessions(),
        narreService.listSupervisorEvents(),
      ]);
      setSessions(nextSessions);
      setEvents(nextEvents);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : tk('agentSession.loadFailed'));
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, [tk]);

  useEffect(() => {
    void loadSessions();
    const timer = window.setInterval(() => {
      void loadSessions(true);
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadSessions]);

  const projectSessions = useMemo(
    () => sessions
      .filter((session) => session.projectId === projectId)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)),
    [projectId, sessions],
  );
  const projectEvents = useMemo(
    () => events
      .filter((event) => event.snapshot.projectId === projectId)
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 8),
    [events, projectId],
  );

  const workingCount = projectSessions.filter((session) => session.status === 'working').length;
  const issueCount = projectSessions.filter((session) => session.status === 'blocked' || session.status === 'error').length;

  const handleSessionOpen = useCallback(async (session: SupervisorAgentSessionSnapshot): Promise<void> => {
    const editorStore = useEditorStore.getState();
    const resolvedProjectId = session.projectId ?? projectId;

    if (session.surface.kind === 'terminal') {
      const tabId = `terminal:${session.surface.id}`;
      const existingTab = editorStore.tabs.find((tab) => tab.id === tabId);
      if (session.status === 'offline' && !existingTab) {
        return;
      }

      await editorStore.openTab({
        type: 'terminal',
        targetId: session.surface.id,
        title: session.title?.trim() || session.agent.name,
        projectId: resolvedProjectId,
      });
      return;
    }

    if (!resolvedProjectId) {
      return;
    }

    updateNarreProjectUiState(resolvedProjectId, (prev) => ({
      ...prev,
      view: session.externalSessionId ? 'chat' : prev.view,
      activeSessionId: session.externalSessionId ?? prev.activeSessionId,
    }));

    await editorStore.openTab({
      type: 'narre',
      targetId: resolvedProjectId,
      title: t('narre.title'),
      projectId: resolvedProjectId,
    });
  }, [projectId, t]);

  return (
    <section className="flex min-h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <div className="flex min-w-0 items-center gap-2">
          <Bot size={14} className="shrink-0 text-accent" />
          <span className="truncate text-xs font-semibold text-default">{tk('agentSession.title')}</span>
        </div>
        <IconButton label={tk('agentSession.refresh')} onClick={() => void loadSessions()} disabled={loading}>
          <RefreshCw size={14} />
        </IconButton>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-2">
        <Badge variant={workingCount > 0 ? 'accent' : 'default'}>{tk('agentSession.workingCount', { count: workingCount })}</Badge>
        <Badge variant={issueCount > 0 ? 'warning' : 'default'}>{tk('agentSession.issueCount', { count: issueCount })}</Badge>
        <Badge variant="default">{tk('agentSession.totalCount', { count: projectSessions.length })}</Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner size="sm" />
        </div>
      ) : projectSessions.length === 0 ? (
        <div className="px-3 py-4 text-xs text-muted">{tk('agentSession.noActiveSessions')}</div>
      ) : (
        <div className="flex flex-col gap-2 px-2 pb-2">
          {projectSessions.map((session) => (
            <button
              key={session.id}
              type="button"
              className="rounded border border-subtle bg-surface-card px-3 py-2 text-left transition-colors hover:bg-surface-hover"
              onClick={() => {
                void handleSessionOpen(session);
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-default">
                    {session.title?.trim() || session.agent.name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge variant={getStatusVariant(session.status)}>
                      {translateStatus(session.status, tk)}
                    </Badge>
                    {session.reason && (
                      <Badge variant="warning">
                        {translateAttentionReason(session.reason, tk)}
                      </Badge>
                    )}
                    <Badge variant="default">
                      {describeAgent(session)}
                    </Badge>
                    {session.skillId && (
                      <Badge variant="accent">
                        /{session.skillId}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-muted">
                    {describeSurface(session)}
                  </div>
                </div>
                <div className="shrink-0 text-[11px] text-muted">
                  {formatUpdatedAt(session.updatedAt, locale)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="px-2 pt-1">
        <div className="mb-2 text-[11px] font-semibold uppercase text-muted">
          {tk('agentSession.recentActivity')}
        </div>
        {projectEvents.length === 0 ? (
          <div className="rounded border border-subtle bg-surface-card px-3 py-3 text-xs text-muted">
            {tk('agentSession.noRecentEvents')}
          </div>
        ) : (
          <div className="flex flex-col gap-2 pb-2">
            {projectEvents.map((event) => (
              <button
                key={`${event.seq}:${event.sessionId}`}
                type="button"
                className="rounded border border-subtle bg-surface-card px-3 py-2 text-left transition-colors hover:bg-surface-hover"
                onClick={() => {
                  void handleSessionOpen(event.snapshot);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-default">
                      {event.snapshot.title?.trim() || event.snapshot.agent.name}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <Badge variant={getStatusVariant(event.status)}>
                        {translateStatus(event.status, tk)}
                      </Badge>
                      <Badge variant="default">
                        {translateEventType(event.type, tk)}
                      </Badge>
                      {event.snapshot.reason && (
                        <Badge variant="warning">
                          {translateAttentionReason(event.snapshot.reason, tk)}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 truncate text-[11px] text-muted">
                      {describeSurface(event.snapshot)}
                    </div>
                  </div>
                  <div className="shrink-0 text-[11px] text-muted">
                    {formatUpdatedAt(event.createdAt, locale)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="px-2 py-1 text-[11px] text-status-warning">
          {error}
        </div>
      )}
    </section>
  );
}

function getStatusVariant(status: AgentStatus): 'default' | 'accent' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'working':
      return 'accent';
    case 'blocked':
      return 'warning';
    case 'error':
      return 'error';
    case 'idle':
      return 'success';
    case 'offline':
    default:
      return 'default';
  }
}

function describeAgent(session: SupervisorAgentSessionSnapshot): string {
  if (session.agent.kind === 'terminal') {
    return session.agent.terminalAgentType;
  }

  if (session.agent.narreAgentType === 'system') {
    return session.agent.systemAgentType;
  }

  return session.agent.userAgentType;
}

function describeSurface(session: SupervisorAgentSessionSnapshot): string {
  return session.surface.kind === 'terminal'
    ? session.surface.id
    : session.externalSessionId ?? session.surface.id;
}

function translateStatus(
  status: AgentStatus,
  translate: (key: string, params?: Record<string, string | number>) => string,
): string {
  switch (status) {
    case 'working':
      return translate('agentSession.status.working');
    case 'blocked':
      return translate('agentSession.status.blocked');
    case 'error':
      return translate('agentSession.status.error');
    case 'idle':
      return translate('agentSession.status.idle');
    case 'offline':
    default:
      return translate('agentSession.status.offline');
  }
}

function translateAttentionReason(
  reason: AgentAttentionReason,
  translate: (key: string, params?: Record<string, string | number>) => string,
): string {
  switch (reason) {
    case 'approval':
      return translate('agentSession.attention.approval');
    case 'user_input':
      return translate('agentSession.attention.input');
    case 'unknown':
    default:
      return translate('agentSession.attention.generic');
  }
}

function translateEventType(
  type: SupervisorEvent['type'],
  translate: (key: string, params?: Record<string, string | number>) => string,
): string {
  switch (type) {
    case 'session_started':
      return translate('agentSession.event.started');
    case 'session_updated':
      return translate('agentSession.event.updated');
    case 'session_completed':
      return translate('agentSession.event.completed');
    case 'session_failed':
      return translate('agentSession.event.failed');
    case 'session_reported':
    default:
      return translate('agentSession.event.reported');
  }
}

function formatUpdatedAt(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
