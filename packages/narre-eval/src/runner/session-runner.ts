import {
  listArchetypes,
  listRelationTypes,
  listCanvasTypes,
} from '@netior/core';
import type { NarreCard } from '@netior/shared/types';
import type { EvalAgentAdapter, CardHandler } from '../agents/base.js';
import type {
  EvalScenario,
  Transcript,
  TurnTranscript,
  ResponderContext,
} from '../types.js';

export async function runScenario(
  adapter: EvalAgentAdapter,
  scenario: EvalScenario,
  projectId: string,
  templateVars: Record<string, string> = {},
): Promise<Transcript> {
  // NOTE: buildProjectMetadata uses @netior/core directly. This is
  // narre-server-specific — a future CLI/SDK adapter may need a different
  // metadata shape. Intentionally deferred; acceptable while all scenarios
  // target narre-server.
  const projectMetadata = buildProjectMetadata(projectId);

  if (scenario.type === 'conversation') {
    return runConversation(adapter, scenario, projectId, projectMetadata, templateVars);
  }
  return runSingleTurn(adapter, scenario, projectId, projectMetadata, templateVars);
}

// ── Single-Turn ──

async function runSingleTurn(
  adapter: EvalAgentAdapter,
  scenario: EvalScenario,
  projectId: string,
  projectMetadata: Record<string, unknown>,
  templateVars: Record<string, string>,
): Promise<Transcript> {
  const turns: TurnTranscript[] = [];
  let totalToolCalls = 0;
  let cardResponseCount = 0;
  const responderCtx: ResponderContext = { cardIndex: 0, previousCards: [] };
  const onCard: CardHandler | undefined = scenario.responder
    ? buildCardHandler(scenario.responder, responderCtx)
    : undefined;

  for (const turn of scenario.turns) {
    const resolvedTurn = resolveTurnTemplates(turn, templateVars);
    const result = await adapter.sendTurn({
      sessionId: null,
      projectId,
      message: resolvedTurn.content,
      mentions: resolvedTurn.mentions,
      projectMetadata,
      onCard,
    });

    turns.push({
      user: resolvedTurn.content,
      assistant: result.assistantText,
      toolCalls: result.toolCalls,
      events: result.events,
      errors: result.errors,
    });

    totalToolCalls += result.toolCalls.length;
    cardResponseCount += result.cardResponseCount;
  }

  return {
    scenarioId: scenario.id,
    sessionId: null,
    turns,
    totalToolCalls,
    cardResponseCount,
    sessionResumeCount: 0,
  };
}

// ── Conversation (session-aware) ──

async function runConversation(
  adapter: EvalAgentAdapter,
  scenario: EvalScenario,
  projectId: string,
  projectMetadata: Record<string, unknown>,
  templateVars: Record<string, string>,
): Promise<Transcript> {
  const turns: TurnTranscript[] = [];
  let totalToolCalls = 0;
  let cardResponseCount = 0;
  let sessionResumeCount = 0;
  let sessionId: string | null = null;

  // Build the onCard handler from the scenario responder (if any)
  const responderCtx: ResponderContext = { cardIndex: 0, previousCards: [] };
  const onCard: CardHandler | undefined = scenario.responder
    ? buildCardHandler(scenario.responder, responderCtx)
    : undefined;

  for (const turn of scenario.turns) {
    const resolvedTurn = resolveTurnTemplates(turn, templateVars);
    if (sessionId) {
      sessionResumeCount++;
    }

    const result = await adapter.sendTurn({
      sessionId,
      projectId,
      message: resolvedTurn.content,
      mentions: resolvedTurn.mentions,
      projectMetadata,
      onCard,
    });

    turns.push({
      user: resolvedTurn.content,
      assistant: result.assistantText,
      toolCalls: result.toolCalls,
      events: result.events,
      errors: result.errors,
    });

    totalToolCalls += result.toolCalls.length;
    cardResponseCount += result.cardResponseCount;

    if (!sessionId && result.sessionId) {
      sessionId = result.sessionId;
    }
  }

  return {
    scenarioId: scenario.id,
    sessionId,
    turns,
    totalToolCalls,
    cardResponseCount,
    sessionResumeCount,
  };
}

// ── Card handler factory ──

function buildCardHandler(
  responder: NonNullable<EvalScenario['responder']>,
  ctx: ResponderContext,
): CardHandler {
  return (card: NarreCard): unknown => {
    const response = responder(card, ctx);
    ctx.previousCards.push(card);
    ctx.cardIndex++;
    return response;
  };
}

// ── Helpers ──

function buildProjectMetadata(projectId: string): Record<string, unknown> {
  const archetypes = listArchetypes(projectId).map((a) => ({
    name: a.name,
    icon: a.icon,
    color: a.color,
    node_shape: a.node_shape,
  }));

  const relationTypes = listRelationTypes(projectId).map((r) => ({
    name: r.name,
    directed: r.directed,
    line_style: r.line_style,
    color: r.color,
  }));

  const canvasTypes = listCanvasTypes(projectId).map((c) => ({
    name: c.name,
    description: c.description,
  }));

  return { projectName: projectId, archetypes, relationTypes, canvasTypes };
}

function resolveTurnTemplates<T extends { content: string; mentions?: unknown[] }>(
  turn: T,
  templateVars: Record<string, string>,
): T {
  if (Object.keys(templateVars).length === 0) {
    return turn;
  }

  return {
    ...turn,
    content: applyTemplateVars(turn.content, templateVars),
    mentions: turn.mentions
      ? JSON.parse(applyTemplateVars(JSON.stringify(turn.mentions), templateVars)) as unknown[]
      : undefined,
  };
}

function applyTemplateVars(text: string, templateVars: Record<string, string>): string {
  let resolved = text;
  for (const [key, value] of Object.entries(templateVars)) {
    resolved = resolved.replaceAll(`{{${key}}}`, value);
  }
  return resolved;
}
