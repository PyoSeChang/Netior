import type {
  NarreBehaviorSettings,
  NarreTranscriptTurn,
  NetiorMcpToolProfile,
} from '@netior/shared/types';
import {
  DEFAULT_NARRE_BEHAVIOR_SETTINGS,
  type SystemPromptParams,
} from '../system-prompt.js';

export function buildBootstrapPrompt(
  params: SystemPromptParams,
  behavior: NarreBehaviorSettings = DEFAULT_NARRE_BEHAVIOR_SETTINGS,
  historyTurns: NarreTranscriptTurn[] = [],
): string {
  const { projectName, models, schemas } = params;
  const networkTree = params.networkTree ?? [];
  const edgeModels = models.filter((model) => model.target_kind === 'edge' || model.target_kind === 'both');
  const bootstrapHistory = summarizeBootstrapHistory(historyTurns);

  const hasExistingStructure = schemas.length > 0 || edgeModels.length > 0 || networkTree.length > 1;

  const existingState = hasExistingStructure
    ? `## Existing Project State
Models (${models.length}): ${models.map((model) => model.name).join(', ') || 'none'}
Schemas (${schemas.length}): ${schemas.map((a) => a.name).join(', ') || 'none'}
Edge Models (${edgeModels.length}): ${edgeModels.map((model) => model.name).join(', ') || 'none'}
Networks (${networkTree.length} top-level entries in digest): ${networkTree.map((n) => n.name).join(', ') || 'none'}

This project is not empty. Bootstrap should refine or extend the structure instead of blindly recreating everything.`
    : `This project has little or no graph structure yet. Bootstrap should create an initial usable workspace from the domain brief.`;

  const recoveryCheckpoint = buildRecoveryCheckpoint(bootstrapHistory);

  return `## Skill: /bootstrap
You are in bootstrap mode for the current project "${projectName}".
Use the base prompt's project identity, modeling digest, relation digest, and network digest as starting context.

Your job is to translate the user's domain description into an initial Netior workspace that they can actually use.

Reason ontology-first, not network-first.
Infer the domain ontology before deciding workspace structure.

Assume the user understands their domain, but does not understand Netior's internal modeling concepts such as:
- how to split networks
- which models or meanings should exist
- when to use typed schema references
- how nodes should be placed

Those structural decisions are Narre's responsibility, not the user's.

${existingState}

${recoveryCheckpoint}

## Bootstrap Order

Follow this order unless the user explicitly narrows the task:

### Stage 0: Domain Brief
- Start from the user's domain brief and problem statement.
- Identify what they are trying to organize, what currently gets mixed up, and what they need to navigate or retrieve.

### Stage 1: Ontology Interview
- For broad initial bootstrap work, perform at least two short \`ask\` interview rounds before any \`propose\`, \`confirm\`, or mutation tool call.
- First interview round: identify entity kinds, artifact kinds, and what currently gets mixed up.
- Second interview round: identify relationship patterns, workflow/lifecycle, and repeated navigation needs.
- If the brief is incomplete, ask domain-level follow-up questions before proposing structure.
- Focus your interview on:
  - entity kinds
  - relation kinds
  - artifact kinds
  - workflow or lifecycle
  - what currently gets mixed up
  - what the user most wants to navigate, retrieve, or separate
- Keep interviews short and high-signal. Prefer 1 to 3 targeted questions.

### Stage 2: Ontology Inference
- Infer the main ontology of the project before deciding networks.
- Infer:
  - which entity kinds are first-class
  - which relation kinds are stable and repeated
  - which artifact kinds need dedicated handling
  - which workflow stages or temporal flows matter
  - which boundaries should remain distinct
- Networks are a workspace projection of the inferred ontology, not the ontology itself.

### Stage 3: Workspace Projection
- Project the inferred ontology into an initial workspace structure.
- Infer which concerns should live in separate networks and which should stay together.
- Infer how the user will likely navigate between those spaces.
- Do not ask the user to design the network split unless domain ambiguity makes that impossible.

### Stage 4: Schema and Model Projection
- Infer core schemas from the ontology, not from Netior jargon.
- Apply models and meanings when they materially improve structure, navigation, or workflow.
- Add typed cross-schema reference fields where the user will need durable navigation between entity types.
- Add edge-target models when graph edges carry independent meaning beyond typed fields.

### Stage 5: Starter Graph
- Infer a small starter graph the user can begin with immediately.
- Create starter concepts and place starter nodes into the inferred networks.
- Prefer a useful, navigable starting structure over a shallow type list.

### Stage 6: Explain and Execute
- Present a concise bootstrap proposal before making high-impact changes.
- After confirmation, create the workspace in this order:
  1. networks
  2. schemas and models, including edge-target models
  3. fields and meaning bindings
  4. starter concepts and starter nodes
- After execution, summarize what was created and why.

## Stage Gates

- Before Stage 1 is complete, do not mutate project structure.
- During a fresh bootstrap, \`confirm\` is not a substitute for \`ask\`. Do not use \`confirm\` to skip the two-round ontology interview.
- Before presenting a bootstrap proposal, do not jump directly into large-scale creation.
- Before network and schema approval, do not bulk-create starter concepts or starter nodes.
- Use questions for ontology discovery first, then use proposal/confirmation before high-impact creation.

## Interview Rules

Do not ask the user to choose Netior-internal structures directly.

Bad questions:
- which networks do you want?
- which models should I use?
- should I use a typed schema reference here?
- how should I place the nodes?

Good questions:
- what kinds of entities or things matter most in this project?
- what kinds of outputs or artifacts does this project produce?
- which things get mixed together today and need clearer separation?
- what flows over time in this project?
- which relationships do you need to trace repeatedly?

## Proposal Shape

When presenting a bootstrap plan, prefer these sections:
- domain reading
- interview findings
- inferred ontology
- projected network structure
- projected models and meanings
- projected schemas
- projected typed reference fields
- projected edge models
- projected starter concepts and starter nodes
- rationale

## Tool Usage

- **ask**: Use for short ontology-level interviews grounded in domain language. For fresh bootstrap, use two interview rounds before proposal: one for entities/artifacts/mixed concerns, one for relationships/workflow/navigation.
- **propose**: Use to present an editable bootstrap plan before major creation work.
- **confirm**: Use before destructive or high-impact changes after interview/proposal checkpoints are already complete.
- Never use provider-side generic user-input tools such as \`request_user_input\` for bootstrap interviews. Use the Netior conversation tools \`ask\`, \`propose\`, and \`confirm\` only.
- Graph/object tools are for live state and actual creation after the bootstrap plan is accepted.
- File-system tools are secondary. Use them only when project files materially improve the inferred ontology, artifact model, or workflow model.
- ${behavior.discourageLocalWorkspaceActions
    ? 'Do not inspect unrelated local workspace files. Read files only when they materially improve the bootstrap model.'
    : 'Inspect files only when they materially improve the bootstrap model.'}

## Rules
- Respond in the same language the user uses.
- Be concise and structural.
- Do not force the user to become a Netior modeler.
- Do not stop at schema lists if the user clearly needs network structure and starter graph support.
- Even if the user gave a rich domain brief, use two short ontology interview rounds before proposal when the workspace is still being bootstrapped from scratch, unless the user explicitly asks you to skip questions and proceed immediately.
- If the user is vague, interview first and design second.
- In bootstrap mode, reason in this order: domain -> ontology -> workspace projection -> schema/model projection -> starter graph.`;
}

interface BootstrapHistorySummary {
  askCount: number;
  proposeCount: number;
  confirmCount: number;
  mutationCount: number;
}

export type BootstrapToolStage = 'interview' | 'proposal' | 'execution';

function summarizeBootstrapHistory(turns: NarreTranscriptTurn[]): BootstrapHistorySummary {
  const relevantTurns = sliceTurnsFromLatestBootstrapInvocation(turns);
  const toolKeys = relevantTurns.flatMap((turn) =>
    turn.role !== 'assistant'
      ? []
      : turn.blocks
        .filter((block): block is Extract<typeof turn.blocks[number], { type: 'tool' }> => block.type === 'tool')
        .map((block) => block.toolKey),
  );

  return {
    askCount: toolKeys.filter((tool) => tool === 'ask').length,
    proposeCount: toolKeys.filter((tool) => tool === 'propose').length,
    confirmCount: toolKeys.filter((tool) => tool === 'confirm').length,
    mutationCount: toolKeys.filter(isMutationLikeTool).length,
  };
}

export function determineBootstrapToolStage(turns: NarreTranscriptTurn[] = []): BootstrapToolStage {
  const summary = summarizeBootstrapHistory(turns);

  if (summary.askCount < 2) {
    return 'interview';
  }

  if (summary.proposeCount === 0) {
    return 'proposal';
  }

  return 'execution';
}

export function determineBootstrapToolProfiles(
  turns: NarreTranscriptTurn[] = [],
): readonly NetiorMcpToolProfile[] {
  const stage = determineBootstrapToolStage(turns);

  if (stage === 'execution') {
    return ['core', 'bootstrap-execution'];
  }

  return ['discovery', 'bootstrap-interview'];
}

function sliceTurnsFromLatestBootstrapInvocation(turns: NarreTranscriptTurn[]): NarreTranscriptTurn[] {
  let startIndex = -1;

  for (let index = 0; index < turns.length; index += 1) {
    const turn = turns[index];
    if (turn.role !== 'user') {
      continue;
    }

    const hasBootstrapInvocation = turn.blocks.some(
      (block) => (block.type === 'skill' || block.type === 'command') && block.name === 'bootstrap',
    );

    if (hasBootstrapInvocation) {
      startIndex = index;
    }
  }

  return startIndex >= 0 ? turns.slice(startIndex) : turns;
}

function isMutationLikeTool(tool: string): boolean {
  return /^(create|update|delete|remove|add|upsert|reorder|move)_/.test(tool);
}

function buildRecoveryCheckpoint(summary: BootstrapHistorySummary): string {
  if (summary.askCount === 0) {
    return `## Bootstrap Recovery Checkpoint
- This bootstrap flow has not completed an ontology interview yet.
- Your immediate next step must be an \`ask\` tool call with 1 to 3 short domain-level questions.
- Cover entity kinds, artifact kinds, and what currently gets mixed up.
- Do not use \`propose\`, \`confirm\`, or any mutation tool before that \`ask\` round is completed.`;
  }

  if (summary.askCount === 1) {
    return `## Bootstrap Recovery Checkpoint
- This bootstrap flow has completed only the first ontology interview round.
- Your immediate next step must be a second \`ask\` tool call with 1 to 3 short domain-level questions.
- Cover relationship patterns, workflow/lifecycle, and repeated navigation needs.
- Do not use \`propose\`, \`confirm\`, or any mutation tool before the second \`ask\` round is completed.`;
  }

  if (summary.proposeCount === 0) {
    return `## Bootstrap Recovery Checkpoint
- At least one ontology interview round has happened.
- Your next structural checkpoint should be a \`propose\` tool call that summarizes the inferred ontology and projected workspace before any bulk creation.
- Do not use mutation tools until the proposal checkpoint is complete.`;
  }

  if (summary.mutationCount === 0) {
    return `## Bootstrap Recovery Checkpoint
- Interview and proposal checkpoints exist.
- If the user has accepted the plan, proceed carefully into execution. If acceptance is still unclear, refine the proposal or ask for confirmation before mutation.`;
  }

  return `## Bootstrap Recovery Checkpoint
- Bootstrap has already entered execution.
- Continue to keep ontology, network projection, schema/model projection, and starter graph aligned with the accepted plan.`;
}
