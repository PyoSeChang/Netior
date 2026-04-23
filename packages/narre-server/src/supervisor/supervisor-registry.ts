import type {
  AgentAttentionReason,
  AgentDefinition,
  AgentStatus,
  SupervisorAgentSessionSnapshot,
  SupervisorEvent,
  SupervisorEventType,
  SupervisorSessionReport,
} from '@netior/shared/types';
import {
  createGlobalUserAgentDefinition,
  createProjectUserAgentDefinition,
  DEFAULT_USER_AGENT_ID,
  getSupervisorAgentKey,
  listSupervisorAgentDefinitions,
} from './agent-registry.js';

const MAX_EVENTS = 500;

export interface SupervisorRegistryOptions {
  globalUserAgentId?: string | null;
  projectUserAgentId?: string | null;
}

export interface RegisterNarreSessionOptions {
  narreSessionId: string;
  projectId: string;
  title?: string | null;
  status?: AgentStatus;
  reason?: AgentAttentionReason | null;
  skillId?: string | null;
  metadata?: Record<string, string>;
}

export class SupervisorRegistry {
  private readonly sessions = new Map<string, SupervisorAgentSessionSnapshot>();
  private readonly events: SupervisorEvent[] = [];
  private nextEventSeq = 1;

  constructor(private readonly options: SupervisorRegistryOptions = {}) {}

  listAgents(projectId?: string | null): AgentDefinition[] {
    return listSupervisorAgentDefinitions({
      projectId,
      globalUserAgentId: this.options.globalUserAgentId,
      projectUserAgentId: this.options.projectUserAgentId,
    });
  }

  listSessions(): SupervisorAgentSessionSnapshot[] {
    return Array.from(this.sessions.values(), cloneSessionSnapshot)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  listEvents(afterSeq?: number | null): SupervisorEvent[] {
    const filtered = typeof afterSeq === 'number'
      ? this.events.filter((event) => event.seq > afterSeq)
      : this.events;

    return filtered.map((event) => ({
      ...event,
      snapshot: cloneSessionSnapshot(event.snapshot),
    }));
  }

  registerNarreSession(options: RegisterNarreSessionOptions): SupervisorAgentSessionSnapshot {
    const agentId = this.options.projectUserAgentId?.trim() || DEFAULT_USER_AGENT_ID;
    const agent = createProjectUserAgentDefinition(agentId, options.projectId);
    const sessionId = buildNarreSupervisorSessionId(options.narreSessionId);
    const eventType = this.sessions.has(sessionId) ? 'session_updated' : 'session_started';
    return this.upsertSession({
      id: sessionId,
      agent,
      surface: {
        kind: 'editor',
        id: `narre:${options.projectId}`,
      },
      externalSessionId: options.narreSessionId,
      projectId: options.projectId,
      title: options.title ?? null,
      status: options.status ?? 'working',
      reason: options.reason ?? null,
      skillId: options.skillId ?? null,
      metadata: {
        runtime: 'narre',
        ...(options.metadata ?? {}),
      },
    }, eventType);
  }

  updateSessionStatus(
    sessionId: string,
    status: AgentStatus,
    options: {
      reason?: AgentAttentionReason | null;
      title?: string | null;
      skillId?: string | null;
      metadata?: Record<string, string>;
      eventType?: SupervisorEventType;
    } = {},
  ): SupervisorAgentSessionSnapshot | null {
    const current = this.sessions.get(sessionId);
    if (!current) {
      return null;
    }

    const now = new Date().toISOString();
    const next: SupervisorAgentSessionSnapshot = {
      ...current,
      status,
      reason: options.reason ?? null,
      title: options.title ?? current.title ?? null,
      skillId: options.skillId ?? current.skillId ?? null,
      updatedAt: now,
      metadata: {
        ...(current.metadata ?? {}),
        ...(options.metadata ?? {}),
      },
    };
    this.sessions.set(sessionId, next);
    this.pushEvent(options.eventType ?? 'session_updated', next);
    return cloneSessionSnapshot(next);
  }

  reportSession(report: SupervisorSessionReport): SupervisorAgentSessionSnapshot {
    return this.upsertSession({
      id: report.sessionId,
      agent: report.agent,
      surface: report.surface,
      externalSessionId: report.externalSessionId ?? null,
      projectId: report.projectId,
      title: report.title ?? null,
      status: report.status ?? 'idle',
      reason: report.reason ?? null,
      skillId: report.skillId ?? null,
      metadata: report.metadata,
    }, 'session_reported');
  }

  private upsertSession(
    input: {
      id: string;
      agent: AgentDefinition;
      surface: SupervisorAgentSessionSnapshot['surface'];
      externalSessionId: string | null;
      projectId?: string;
      title?: string | null;
      status: AgentStatus;
      reason: AgentAttentionReason | null;
      skillId?: string | null;
      metadata?: Record<string, string>;
    },
    eventType: SupervisorEventType,
  ): SupervisorAgentSessionSnapshot {
    const current = this.sessions.get(input.id);
    const now = new Date().toISOString();
    const agentKey = getSupervisorAgentKey(input.agent);
    const snapshot: SupervisorAgentSessionSnapshot = {
      id: input.id,
      agentKey,
      agentId: input.agent.id,
      agent: input.agent,
      status: input.status,
      reason: input.reason,
      surface: input.surface,
      externalSessionId: input.externalSessionId,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      title: input.title ?? current?.title ?? null,
      skillId: input.skillId ?? current?.skillId ?? null,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      metadata: {
        ...(current?.metadata ?? {}),
        ...(input.metadata ?? {}),
      },
    };

    this.sessions.set(input.id, snapshot);
    this.pushEvent(eventType, snapshot);
    return cloneSessionSnapshot(snapshot);
  }

  private pushEvent(type: SupervisorEventType, snapshot: SupervisorAgentSessionSnapshot): void {
    const event: SupervisorEvent = {
      seq: this.nextEventSeq,
      type,
      sessionId: snapshot.id,
      agentKey: snapshot.agentKey,
      status: snapshot.status,
      createdAt: new Date().toISOString(),
      snapshot: cloneSessionSnapshot(snapshot),
    };

    this.nextEventSeq += 1;
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events.splice(0, this.events.length - MAX_EVENTS);
    }
  }
}

export function buildNarreSupervisorSessionId(narreSessionId: string): string {
  return `narre:${narreSessionId}`;
}

export function createDefaultGlobalUserAgent(): AgentDefinition {
  return createGlobalUserAgentDefinition(DEFAULT_USER_AGENT_ID);
}

function cloneSessionSnapshot(
  snapshot: SupervisorAgentSessionSnapshot,
): SupervisorAgentSessionSnapshot {
  return {
    ...snapshot,
    agent: { ...snapshot.agent },
    surface: { ...snapshot.surface },
    metadata: snapshot.metadata ? { ...snapshot.metadata } : undefined,
  };
}
