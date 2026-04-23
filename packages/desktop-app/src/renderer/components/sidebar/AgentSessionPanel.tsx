import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, RefreshCw } from 'lucide-react';
import type { AgentStatus, SupervisorAgentSessionSnapshot } from '@netior/shared/types';
import { narreService } from '../../services/narre-service';
import { Badge } from '../ui/Badge';
import { IconButton } from '../ui/IconButton';
import { Spinner } from '../ui/Spinner';

const POLL_INTERVAL_MS = 5_000;

interface AgentSessionPanelProps {
  projectId: string;
}

export function AgentSessionPanel({ projectId }: AgentSessionPanelProps): JSX.Element {
  const [sessions, setSessions] = useState<SupervisorAgentSessionSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async (background = false): Promise<void> => {
    if (!background) {
      setLoading(true);
    }

    try {
      const nextSessions = await narreService.listSupervisorSessions();
      setSessions(nextSessions);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load agent sessions');
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, []);

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

  const workingCount = projectSessions.filter((session) => session.status === 'working').length;
  const issueCount = projectSessions.filter((session) => session.status === 'blocked' || session.status === 'error').length;

  return (
    <section className="flex min-h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <div className="flex min-w-0 items-center gap-2">
          <Bot size={14} className="shrink-0 text-accent" />
          <span className="truncate text-xs font-semibold text-default">Agent Sessions</span>
        </div>
        <IconButton label="Refresh sessions" onClick={() => void loadSessions()} disabled={loading}>
          <RefreshCw size={14} />
        </IconButton>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-2">
        <Badge variant={workingCount > 0 ? 'accent' : 'default'}>{workingCount} working</Badge>
        <Badge variant={issueCount > 0 ? 'warning' : 'default'}>{issueCount} issues</Badge>
        <Badge variant="default">{projectSessions.length} total</Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner size="sm" />
        </div>
      ) : projectSessions.length === 0 ? (
        <div className="px-3 py-4 text-xs text-muted">No active sessions</div>
      ) : (
        <div className="flex flex-col gap-2 px-2 pb-2">
          {projectSessions.map((session) => (
            <div
              key={session.id}
              className="rounded border border-subtle bg-surface-card px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-default">
                    {session.title?.trim() || session.agent.name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge variant={getStatusVariant(session.status)}>
                      {session.status}
                    </Badge>
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
                  {formatUpdatedAt(session.updatedAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
