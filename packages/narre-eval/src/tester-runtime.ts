import type {
  NarreCard,
  NarreDraftResponse,
  NarreInterviewResponse,
  ProposalRow,
} from '@netior/shared/types';
import type {
  EvalScenario,
  ResponderContext,
  TesterInteraction,
  TesterInteractionSource,
  Turn,
  TurnTranscript,
} from './types.js';
import type { CardHandler } from './agents/base.js';
import { runCodexStructuredTask } from './codex-exec.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function choosePermissionAction(card: Extract<NarreCard, { type: 'permission' }>, testerId: EvalScenario['execution']['tester']): string | null {
  if (card.actions.length === 0) {
    return null;
  }

  const denyKeywords = new Set(['deny', 'reject', 'cancel', 'skip', 'stop', 'no']);
  const explicitDeny = card.actions.find((action) => denyKeywords.has(action.key.toLowerCase()));
  const nonDanger = card.actions.find((action) => action.variant !== 'danger');

  if (testerId === 'approval-sensitive') {
    return (explicitDeny ?? nonDanger ?? card.actions[0]).key;
  }

  return (nonDanger ?? card.actions[0]).key;
}

function buildDefaultTesterResponse(
  card: NarreCard,
  testerId: EvalScenario['execution']['tester'],
): unknown {
  switch (card.type) {
    case 'draft': {
      const response: NarreDraftResponse = {
        action: 'confirm',
        content: card.content,
      };
      return response;
    }
    case 'proposal': {
      const response: { action: 'confirm'; rows: ProposalRow[] } = {
        action: 'confirm',
        rows: card.rows,
      };
      return response;
    }
    case 'permission': {
      const action = choosePermissionAction(card, testerId);
      return action ? { action } : null;
    }
    case 'interview': {
      const selected = card.options.length > 0 ? [card.options[0].label] : [];
      const response: NarreInterviewResponse = {
        selected: card.multiSelect ? selected : selected.slice(0, 1),
        ...(card.allowText && selected.length === 0 ? { text: 'Auto response from narre-eval tester.' } : {}),
      };
      return response;
    }
    case 'summary':
      return null;
    default:
      return null;
  }
}

export function buildTesterCardHandler(
  scenario: EvalScenario,
  turnIndex: number,
  priorTurns: TurnTranscript[],
  interactionSink: (interaction: TesterInteraction) => void,
): CardHandler {
  const responderCtx: ResponderContext = {
    cardIndex: 0,
    previousCards: [],
    turnIndex,
    scenarioId: scenario.id,
    tester: scenario.execution.tester,
  };

  return async (card: NarreCard) => {
    const currentCardIndex = responderCtx.cardIndex;
    responderCtx.cardIndex += 1;

    const finalize = (
      source: TesterInteractionSource,
      response: unknown,
      metadata?: { decisionSummary?: string; evaluationNote?: string },
    ): unknown => {
      interactionSink({
        turnIndex,
        cardIndex: currentCardIndex,
        tester: scenario.execution.tester,
        source,
        status: response == null ? 'skipped' : 'responded',
        cardType: card.type,
        ...('toolCallId' in card ? { toolCallId: card.toolCallId } : {}),
        card,
        ...(response == null ? {} : { response }),
        ...(metadata?.decisionSummary ? { decisionSummary: metadata.decisionSummary } : {}),
        ...(metadata?.evaluationNote ? { evaluationNote: metadata.evaluationNote } : {}),
      });

      responderCtx.previousCards.push(card);
      return response;
    };

    if (scenario.execution.tester === 'codex-tester' && card.type !== 'summary') {
      const codexDecision = await buildCodexTesterResponse(
        scenario,
        turnIndex,
        priorTurns,
        [...responderCtx.previousCards],
        card,
      );
      return finalize('codex_tester', codexDecision.response, {
        decisionSummary: codexDecision.decision_summary,
        evaluationNote: codexDecision.evaluation_note,
      });
    }

    if (scenario.responder) {
      const responderResult = await scenario.responder(card, {
        cardIndex: currentCardIndex,
        previousCards: [...responderCtx.previousCards],
        turnIndex,
        scenarioId: scenario.id,
        tester: scenario.execution.tester,
      });

      if (responderResult !== undefined) {
        return finalize('scenario_responder', responderResult);
      }

      return finalize('tester_fallback', buildDefaultTesterResponse(card, scenario.execution.tester));
    }

    return finalize('tester_default', buildDefaultTesterResponse(card, scenario.execution.tester));
  };
}

export function flattenTesterInteractions(turns: Array<{ testerInteractions: TesterInteraction[] }>): TesterInteraction[] {
  return turns.flatMap((turn) => turn.testerInteractions);
}

export function resolveTurnTemplates(
  turn: Turn,
  templateVars: Record<string, string>,
): Turn {
  const applyTemplateVars = (value: string): string => value.replace(/\{\{(.*?)\}\}/g, (_match, key: string) => {
    const trimmed = key.trim();
    return templateVars[trimmed] ?? '';
  });
  const content = applyTemplateVars(turn.content);

  const mentions = turn.mentions?.map((mention) => {
    if (!isObject(mention)) {
      return mention;
    }

    return {
      ...mention,
      ...(typeof mention.id === 'string' ? { id: applyTemplateVars(mention.id) } : {}),
      ...(typeof mention.path === 'string' ? { path: applyTemplateVars(mention.path) } : {}),
      display: typeof mention.display === 'string' ? applyTemplateVars(mention.display) : mention.display,
    };
  });

  return {
    ...turn,
    content,
    mentions,
  };
}

interface CodexTesterDecision {
  response: unknown;
  decision_summary: string;
  evaluation_note: string;
}

async function buildCodexTesterResponse(
  scenario: EvalScenario,
  turnIndex: number,
  priorTurns: TurnTranscript[],
  currentTurnPriorCards: NarreCard[],
  card: NarreCard,
): Promise<CodexTesterDecision> {
  const prompt = buildCodexTesterPrompt(scenario, turnIndex, priorTurns, currentTurnPriorCards, card);
  const schema = buildCodexTesterSchema(card);
  const model = readStringSetting(scenario.execution.tester_settings, 'model')
    || process.env.NARRE_EVAL_TESTER_CODEX_MODEL
    || process.env.NARRE_CODEX_MODEL;

  return runCodexStructuredTask<CodexTesterDecision>({
    prompt,
    schema,
    model,
    workingDirectory: process.cwd(),
  });
}

function buildCodexTesterPrompt(
  scenario: EvalScenario,
  turnIndex: number,
  priorTurns: TurnTranscript[],
  currentTurnPriorCards: NarreCard[],
  card: NarreCard,
): string {
  const priorTurnsText = priorTurns.length > 0
    ? priorTurns.map((turn, index) => {
        const tools = turn.toolCalls.length > 0
          ? turn.toolCalls.map((toolCall, toolIndex) => (
            `  ${toolIndex + 1}. ${toolCall.tool} ${summarizeInput(toolCall.input)}`
          )).join('\n')
          : '  (none)';
        return [
          `Turn ${index + 1}`,
          `User: ${turn.user}`,
          `Assistant: ${turn.assistant}`,
          'Tools:',
          tools,
        ].join('\n');
      }).join('\n\n')
    : '(no prior turns)';

  const rubricText = scenario.qualitative.length > 0
    ? scenario.qualitative.map((rubric, index) => `${index + 1}. ${rubric.rubric}`).join('\n')
    : '(no explicit rubrics)';

  const currentTurnCardHistory = currentTurnPriorCards.length > 0
    ? currentTurnPriorCards.map((priorCard, index) => {
        const summary = summarizeCardForTester(priorCard);
        return `${index + 1}. ${priorCard.type}${summary ? ` - ${summary}` : ''}`;
      }).join('\n')
    : '(no current-turn cards yet)';

  return `You are the Codex tester for narre-eval.

## Role
You are not the Narre assistant. You are the hidden tester/evaluator who interacts with Narre during an eval run.
Externally, you are simulating a realistic user who understands their own domain but does not understand Netior internals.
Internally, you are evaluating whether Narre is handling the scenario correctly.
You understand:
- Netior is a typed graph workspace for modeling schemas, relation types, concepts, networks, files, and related objects.
- Narre should use tools to inspect or mutate project state while staying aligned with the user request.
- The user in this eval is domain-aware but not expected to know Netior internals such as network splitting, semantic models, schema_ref design, or node placement strategy.
- Narre is expected to lead those structural decisions from the domain brief instead of pushing internal modeling choices back to the user.
- In bootstrap work, Narre should reason ontology-first: infer entity kinds, relation kinds, artifact kinds, and workflow structure before projecting them into networks, models, ORM-style fields, and starter nodes.
- This scenario exists to evaluate whether Narre behaves correctly for the given product use case.

## Scenario
- id: ${scenario.id}
- description: ${scenario.description}
- tags: ${scenario.tags.join(', ') || '(none)'}
- scenario_kind: ${scenario.execution.scenario_kind}
- target_skill: ${scenario.versionInfo?.target_skill ?? '(none)'}
- tester: ${scenario.execution.tester}
- provider: ${scenario.execution.provider}
- analysis_targets: ${scenario.execution.analysis_targets.join(', ') || '(none)'}

## Quality Focus
${rubricText}

## Scenario Kind Contract
If scenario_kind is "fixed":
- prefer deterministic, low-interpretation responses
- do not manufacture extra ambiguity or extra interview
- if a card is straightforward and safe, respond minimally

If scenario_kind is "interpretive":
- preserve the domain-user persona
- expect Narre to interview, interpret, and propose before major structural mutation
- evaluate ontology reading, proposal quality, and structural ownership

## Bootstrap Contract
If this scenario is evaluating /bootstrap, treat this as the expected order:
1. domain brief
2. first ontology interview for entities, artifacts, and mixed concerns
3. second ontology interview for relationships, workflow/lifecycle, and navigation needs
4. ontology summary or proposal
5. approval
6. execution
7. starter graph

Good bootstrap behavior:
- asks two short domain/ontology interview rounds before large-scale creation
- proposes a structure before bulk mutation
- keeps the user in domain language instead of Netior-internal language
- creates a usable starter graph after the structure is accepted

Weak bootstrap behavior:
- jumping directly into bulk schema or network creation
- forcing the user to choose networks, models, schema_ref usage, or node placement
- creating a large empty schema without starter concepts or starter nodes
- using many structural mutations before two interview rounds and a proposal checkpoint

## Prior Progress
${priorTurnsText}

## Current Turn Card History
${currentTurnCardHistory}

## Current Card
${JSON.stringify(card, null, 2)}

## Task
Choose the tester response that best advances the scenario while preserving safety and correctness.
Use your understanding of Netior and the scenario intent.
Keep the external user persona intact:
- the user knows their story/domain
- the user does not know networks, models, schema_ref, node placement, or other Netior internals
- the user should not sound like a Netior power user
If the card reflects a reasonable mutation aligned with the request, usually confirm/approve it.
If the card is unsafe, off-target, or poorly aligned, use feedback/denial where appropriate.
When Narre asks the user to decide internal Netior structure that Narre should normally infer, treat that as weak behavior and reflect it in "evaluation_note".
When Narre skips ontology, artifact, workflow, or relationship discovery and jumps too early into network/schema creation, treat that as weak bootstrap behavior and reflect it in "evaluation_note".
If this is a bootstrap scenario and a permission card requests large-scale structural mutation before two interview rounds and a proposal card have appeared in the current run, prefer denial so Narre is pushed back toward interview/proposal first.
When you deny or redirect, push Narre back toward domain interview or plain-language proposal, not toward asking the user for Netior design choices.
Respond like a realistic non-heavy user: talk about story/domain intent, not Netior implementation vocabulary, unless the card already forces a concrete internal choice.
When the simulated user response includes free text, use the same language as the scenario user turn. For the fantasy bootstrap scenario, write user-facing free text in Korean.

Return JSON only. The "decision_summary" should briefly explain what you decided.
The "evaluation_note" should capture what this interaction suggests about Narre's behavior or workflow quality.`;
}

function summarizeCardForTester(card: NarreCard): string {
  switch (card.type) {
    case 'interview':
      return card.question;
    case 'draft':
      return card.title ?? card.content.slice(0, 80);
    case 'proposal':
      return card.title;
    case 'permission':
      return card.message;
    case 'summary':
      return card.title;
    default:
      return '';
  }
}

function buildCodexTesterSchema(card: NarreCard): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['response', 'decision_summary', 'evaluation_note'],
    properties: {
      response: buildCardResponseSchema(card),
      decision_summary: { type: 'string' },
      evaluation_note: { type: 'string' },
    },
  };
}

function buildCardResponseSchema(card: NarreCard): Record<string, unknown> {
  switch (card.type) {
    case 'draft':
      return {
        type: 'object',
        additionalProperties: false,
        required: ['action', 'content', 'feedback'],
        properties: {
          action: { type: 'string', enum: ['confirm', 'feedback'] },
          content: { type: 'string' },
          feedback: { type: ['string', 'null'] },
        },
      };
    case 'proposal':
      return {
        type: 'object',
        additionalProperties: false,
        required: ['action', 'rows'],
        properties: {
          action: { type: 'string', enum: ['confirm'] },
          rows: {
            type: 'array',
            items: {
              type: 'object',
            },
          },
        },
      };
    case 'permission':
      return {
        type: 'object',
        additionalProperties: false,
        required: ['action'],
        properties: {
          action: {
            type: 'string',
            enum: card.actions.map((action) => action.key),
          },
        },
      };
    case 'interview':
      return {
        type: 'object',
        additionalProperties: false,
        required: ['selected', 'text'],
        properties: {
          selected: {
            type: 'array',
            items: {
              type: 'string',
              enum: card.options.map((option) => option.label),
            },
          },
          text: { type: ['string', 'null'] },
        },
      };
    case 'summary':
    default:
      return {
        type: 'null',
      };
  }
}

function summarizeInput(input: Record<string, unknown>): string {
  const parts = Object.entries(input)
    .slice(0, 4)
    .map(([key, value]) => `${key}=${stringifyValue(value)}`);
  return parts.join(' ');
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => stringifyValue(item)).join('|');
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return '(none)';
}

function readStringSetting(
  settings: Record<string, unknown> | undefined,
  key: string,
): string {
  if (!settings) {
    return '';
  }

  const value = settings[key];
  return typeof value === 'string' ? value.trim() : '';
}
