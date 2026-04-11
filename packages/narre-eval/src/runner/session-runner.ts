import type { NarreCard } from '@netior/shared/types';
import type { EvalAgentAdapter, CardHandler } from '../agents/base.js';
import {
  getProjectById,
  listArchetypes,
  listRelationTypes,
} from '../netior-service-client.js';
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
  serviceUrl: string,
  templateVars: Record<string, string> = {},
): Promise<Transcript> {
  // projectMetadata is built from netior-service DTOs and kept narre-server-shaped
  // so scenario adapters can send the same payload that the Narre HTTP API expects.
  const projectMetadata = await buildProjectMetadata(projectId, serviceUrl);

  if (scenario.type === 'conversation') {
    return runConversation(adapter, scenario, projectId, projectMetadata, templateVars);
  }
  return runSingleTurn(adapter, scenario, projectId, projectMetadata, templateVars);
}

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
    sessionId = result.sessionId;
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

async function buildProjectMetadata(projectId: string, serviceUrl: string): Promise<Record<string, unknown>> {
  const [project, archetypes, relationTypes] = await Promise.all([
    getProjectById(serviceUrl, projectId),
    listArchetypes(serviceUrl, projectId),
    listRelationTypes(serviceUrl, projectId),
  ]);

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  return {
    projectName: project.name,
    projectRootDir: project.root_dir,
    archetypes: archetypes.map((item) => ({
      id: item.id,
      name: item.name,
      color: item.color,
      icon: item.icon,
    })),
    relationTypes: relationTypes.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      color: item.color,
      lineStyle: item.line_style,
      directed: item.directed,
    })),
  };
}

function buildCardHandler(
  responder: EvalScenario['responder'],
  ctx: ResponderContext,
): CardHandler {
  if (!responder) {
    return async () => null;
  }

  return async (card: NarreCard) => {
    const currentIndex = ctx.cardIndex;
    ctx.cardIndex += 1;
    ctx.previousCards.push(card);

    return responder(card, {
      cardIndex: currentIndex,
      previousCards: [...ctx.previousCards],
    });
  };
}

function resolveTurnTemplates(
  turn: EvalScenario['turns'][number],
  templateVars: Record<string, string>,
): EvalScenario['turns'][number] {
  const content = turn.content.replace(/\{\{(.*?)\}\}/g, (_match, key: string) => {
    const trimmed = key.trim();
    return templateVars[trimmed] ?? '';
  });

  const mentions = turn.mentions?.map((mention) => ({
    ...mention,
    display: mention.display?.replace(/\{\{(.*?)\}\}/g, (_match, key: string) => {
      const trimmed = key.trim();
      return templateVars[trimmed] ?? '';
    }),
  }));

  return {
    ...turn,
    content,
    mentions,
  };
}
