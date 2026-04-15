import type {
  NarreCard,
  NarreCommandBlock,
  NarreMention,
  NarreSessionDetail,
  NarreToolBlock,
  NarreStreamEvent,
  NarreTranscriptBlock,
  NarreTranscriptTurn,
} from '@netior/shared/types';
import { SLASH_COMMANDS } from '@netior/shared/constants';
import { narreService } from '../services/narre-service';
import { useArchetypeStore } from '../stores/archetype-store';
import { useConceptStore } from '../stores/concept-store';
import { useNetworkStore } from '../stores/network-store';
import { useRelationTypeStore } from '../stores/relation-type-store';
import {
  getNarreProjectPendingCommand,
  getNarreProjectDraft,
  moveNarreProjectPendingCommand,
  moveNarreProjectDraft,
  setNarreProjectPendingCommand,
  setNarreProjectDraft,
  type NarrePendingCommandState,
} from './narre-ui-state';

export interface NarreDisplayMessage {
  role: 'user' | 'assistant';
  timestamp: string;
  blocks: NarreTranscriptBlock[];
  source: 'live' | 'restored';
}

export interface NarreSessionState {
  projectId: string;
  sessionId: string | null;
  title: string;
  messages: NarreDisplayMessage[];
  loading: boolean;
  hasLoaded: boolean;
  isStreaming: boolean;
  streamingBlocks: NarreTranscriptBlock[];
  streamingTimestamp: string | null;
  hasReceivedFirstStreamEvent: boolean;
  isInterrupting: boolean;
  pendingDraftHtml: string;
  pendingCommand: NarrePendingCommandState | null;
  pendingDraftCommand: NarrePendingCommandState | null;
  pendingUserTimestamp: string | null;
  draftHtml: string;
}

const NEW_SESSION_KEY = '__new__';
const sessions = new Map<string, NarreSessionState>();
const loadPromises = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
let version = 0;
let initialized = false;
let displayBlockCounter = 0;

function refreshStores(projectId: string): void {
  useArchetypeStore.getState().loadByProject(projectId);
  useConceptStore.getState().loadByProject(projectId);
  useRelationTypeStore.getState().loadByProject(projectId);
  useNetworkStore.getState().loadNetworks(projectId);
}

function notify(): void {
  version++;
  for (const fn of listeners) fn();
}

function getSessionKey(projectId: string, sessionId: string | null): string {
  return `${projectId}:${sessionId ?? NEW_SESSION_KEY}`;
}

function createEmptySessionState(projectId: string, sessionId: string | null): NarreSessionState {
  return {
    projectId,
    sessionId,
    title: '',
    messages: [],
    loading: false,
    hasLoaded: sessionId === null,
    isStreaming: false,
    streamingBlocks: [],
    streamingTimestamp: null,
    hasReceivedFirstStreamEvent: false,
    isInterrupting: false,
    pendingDraftHtml: '',
    pendingCommand: getNarreProjectPendingCommand(projectId, sessionId),
    pendingDraftCommand: null,
    pendingUserTimestamp: null,
    draftHtml: getNarreProjectDraft(projectId, sessionId),
  };
}

function ensureSessionState(projectId: string, sessionId: string | null): NarreSessionState {
  const key = getSessionKey(projectId, sessionId);
  let state = sessions.get(key);
  if (!state) {
    state = createEmptySessionState(projectId, sessionId);
    sessions.set(key, state);
  }
  return state;
}

function humanizeSlashCommandName(commandName: string): string {
  switch (commandName) {
    case 'index':
      return 'PDF TOC Indexing';
    case 'onboarding':
      return 'Project Type System Setup';
    default:
      return commandName
        .split(/[-_]/g)
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
  }
}

function findSlashCommand(commandName: string) {
  return SLASH_COMMANDS.find((command) => command.name === commandName) ?? null;
}

function buildDisplayBlockId(prefix = 'display'): string {
  displayBlockCounter += 1;
  return `${prefix}-${displayBlockCounter}`;
}

function cloneCard(card: NarreCard): NarreCard {
  switch (card.type) {
    case 'draft':
      return {
        ...card,
        ...(card.submittedResponse ? { submittedResponse: { ...card.submittedResponse } } : {}),
      };
    case 'proposal':
      return {
        ...card,
        columns: card.columns.map((column) => ({ ...column })),
        rows: card.rows.map((row) => ({ ...row, values: { ...row.values } })),
      };
    case 'permission':
      return {
        ...card,
        actions: card.actions.map((action) => ({ ...action })),
      };
    case 'interview':
      return {
        ...card,
        options: card.options.map((option) => ({ ...option })),
        ...(card.submittedResponse
          ? { submittedResponse: { ...card.submittedResponse, selected: [...card.submittedResponse.selected] } }
          : {}),
      };
    case 'summary':
      return {
        ...card,
        items: card.items.map((item) => ({ ...item })),
      };
    default:
      return card;
  }
}

function cloneTranscriptBlock(block: NarreTranscriptBlock): NarreTranscriptBlock {
  switch (block.type) {
    case 'rich_text':
      return {
        ...block,
        ...(block.mentions?.length ? { mentions: block.mentions.map((mention) => ({ ...mention })) } : {}),
      };
    case 'command':
      return {
        ...block,
        ...(block.args ? { args: { ...block.args } } : {}),
        ...(block.refs?.length ? { refs: block.refs.map((ref) => ({ ...ref })) } : {}),
      };
    case 'draft':
      return { ...block };
    case 'tool':
      return {
        ...block,
        input: { ...block.input },
        ...(block.metadata ? { metadata: { ...block.metadata } } : {}),
      };
    case 'card':
      return {
        ...block,
        card: cloneCard(block.card),
      };
    default:
      return block;
  }
}

function cloneTranscriptBlocks(blocks: NarreTranscriptBlock[]): NarreTranscriptBlock[] {
  return blocks.map(cloneTranscriptBlock);
}

function createRichTextBlock(text: string): Extract<NarreTranscriptBlock, { type: 'rich_text' }> {
  return {
    id: buildDisplayBlockId('text'),
    type: 'rich_text',
    text,
  };
}

function createLegacyToolBlock(tool: {
  toolKey: string;
  metadata?: NarreToolBlock['metadata'];
  input: Record<string, unknown>;
  output?: string;
  error?: string;
}): NarreToolBlock {
  return {
    id: buildDisplayBlockId('tool'),
    type: 'tool',
    toolKey: tool.toolKey,
    ...(tool.metadata ? { metadata: { ...tool.metadata } } : {}),
    input: { ...tool.input },
    ...(tool.output ? { output: tool.output } : {}),
    ...(tool.error ? { error: tool.error } : {}),
  };
}

function createErrorMessage(error: string): NarreDisplayMessage {
  return {
    role: 'assistant',
    timestamp: new Date().toISOString(),
    blocks: [createRichTextBlock(`[Error: ${error}]`)],
    source: 'live',
  };
}

function formatCommandBlockContent(block: NarreCommandBlock): string {
  const slashCommand = findSlashCommand(block.name);
  const baseLabel = slashCommand ? humanizeSlashCommandName(slashCommand.name) : humanizeSlashCommandName(block.name);

  if (block.name === 'index') {
    const fileRef = block.refs?.find((ref) => ref.type === 'file');
    const startPage = block.args?.startPage;
    const endPage = block.args?.endPage;
    const overviewPages = block.args?.overviewPages;
    const detailParts = [
      fileRef?.display,
      startPage && endPage ? `pp. ${startPage}-${endPage}` : null,
      overviewPages ? `overview ${overviewPages}` : null,
    ].filter((part): part is string => Boolean(part));
    return detailParts.length > 0 ? `${baseLabel}\n${detailParts.join(' - ')}` : baseLabel;

    return detailParts.length > 0 ? `${baseLabel}\n${detailParts.join(' · ')}` : baseLabel;
  }

  return baseLabel;
}

function transcriptTurnToDisplayMessage(turn: NarreTranscriptTurn): NarreDisplayMessage {
  return {
    role: turn.role,
    timestamp: turn.createdAt,
    blocks: cloneTranscriptBlocks(turn.blocks),
    source: 'restored',
  };
}

function buildDisplayMessages(sessionData: NarreSessionDetail): NarreDisplayMessage[] {
  if (sessionData.transcript?.turns?.length) {
    return sessionData.transcript.turns.map(transcriptTurnToDisplayMessage);
  }

  return (sessionData.messages ?? []).map((message) => {
    const blocks: NarreTranscriptBlock[] = [];

    if (message.content) {
      blocks.push({
        id: buildDisplayBlockId('legacy-text'),
        type: 'rich_text',
        text: message.content,
        ...(message.mentions?.length ? { mentions: message.mentions.map((mention) => ({ ...mention })) } : {}),
      });
    }

    for (const toolCall of message.tool_calls ?? []) {
      blocks.push(createLegacyToolBlock({
        toolKey: toolCall.tool,
        metadata: toolCall.metadata,
        input: toolCall.input,
        output: toolCall.result,
        error: toolCall.error,
      }));
    }

    return {
      role: message.role,
      timestamp: message.timestamp,
      blocks,
      source: 'restored',
    };
  });
}

function resolveSessionStateFromEvent(event: NarreStreamEvent): NarreSessionState | null {
  if (!event.projectId) {
    return null;
  }

  if (typeof event.sessionId === 'string' && event.sessionId.length > 0) {
    return ensureSessionState(event.projectId, event.sessionId);
  }

  for (const state of sessions.values()) {
    if (state.projectId === event.projectId && state.isStreaming) {
      return state;
    }
  }

  return null;
}

function appendStreamingText(state: NarreSessionState, text: string): void {
  if (!text) {
    return;
  }

  const lastBlock = state.streamingBlocks[state.streamingBlocks.length - 1];
  if (lastBlock?.type === 'rich_text') {
    lastBlock.text += text;
    return;
  }

  state.streamingBlocks = [...state.streamingBlocks, createRichTextBlock(text)];
}

function beginStreamingTool(
  state: NarreSessionState,
  toolKey: string,
  input: Record<string, unknown>,
  metadata: NarreToolBlock['metadata'],
): void {
  state.streamingBlocks = [
    ...state.streamingBlocks,
    {
      id: buildDisplayBlockId('tool'),
      type: 'tool',
      toolKey,
      ...(metadata ? { metadata: { ...metadata } } : {}),
      input: { ...input },
    },
  ];
}

function completeStreamingTool(
  state: NarreSessionState,
  toolKey: string,
  result: string | undefined,
  metadata: NarreToolBlock['metadata'],
): void {
  const openTool = [...state.streamingBlocks]
    .reverse()
    .find((block): block is NarreToolBlock =>
      block.type === 'tool' && block.toolKey === toolKey && !block.output && !block.error,
    );

  if (!openTool) {
    state.streamingBlocks = [
      ...state.streamingBlocks,
      createLegacyToolBlock({
        toolKey,
        metadata,
        input: {},
        ...(result?.startsWith('Error') ? { error: result } : { output: result }),
      }),
    ];
    return;
  }

  if (metadata) {
    openTool.metadata = { ...metadata };
  }

  if (result?.startsWith('Error')) {
    openTool.error = result;
    return;
  }

  if (result) {
    openTool.output = result;
  }
}

function appendStreamingCard(state: NarreSessionState, card: NarreCard): void {
  state.streamingBlocks = [
    ...state.streamingBlocks,
    {
      id: buildDisplayBlockId('card'),
      type: 'card',
      card: cloneCard(card),
    },
  ];
}

function updateCardResponseInBlocks(
  blocks: NarreTranscriptBlock[],
  toolCallId: string,
  response: unknown,
): boolean {
  let updated = false;

  for (const block of blocks) {
    if (block.type !== 'card' || block.card.toolCallId !== toolCallId) {
      continue;
    }

    switch (block.card.type) {
      case 'permission': {
        const actionKey = response && typeof response === 'object'
          ? (response as { action?: unknown }).action
          : undefined;
        if (typeof actionKey === 'string' && actionKey.length > 0) {
          block.card.resolvedActionKey = actionKey;
          updated = true;
        }
        break;
      }
      case 'draft':
        if (response && typeof response === 'object') {
          block.card.submittedResponse = {
            ...(response as { action: 'confirm' | 'feedback'; content: string; feedback?: string }),
          };
          updated = true;
        }
        break;
      case 'interview':
        if (response && typeof response === 'object') {
          const candidate = response as { selected?: unknown; text?: unknown };
          block.card.submittedResponse = {
            selected: Array.isArray(candidate.selected)
              ? candidate.selected.filter((value): value is string => typeof value === 'string')
              : [],
            ...(typeof candidate.text === 'string' && candidate.text.trim().length > 0 ? { text: candidate.text } : {}),
          };
          updated = true;
        }
        break;
      default:
        break;
    }
  }

  return updated;
}

function finalizeAssistantStream(state: NarreSessionState): void {
  if (state.streamingBlocks.length > 0) {
    state.messages.push({
      role: 'assistant',
      timestamp: state.streamingTimestamp ?? new Date().toISOString(),
      blocks: cloneTranscriptBlocks(state.streamingBlocks),
      source: 'live',
    });
  }

  state.hasReceivedFirstStreamEvent = false;
  state.isInterrupting = false;
  state.pendingDraftHtml = '';
  state.pendingDraftCommand = null;
  state.pendingUserTimestamp = null;
  state.streamingBlocks = [];
  state.streamingTimestamp = null;
  state.isStreaming = false;
}

function handleStreamEvent(event: NarreStreamEvent): void {
  const state = resolveSessionStateFromEvent(event);
  if (!state) {
    return;
  }

  state.loading = false;
  state.hasLoaded = true;

  switch (event.type) {
    case 'text':
      if (event.content) {
        state.isStreaming = true;
        state.hasReceivedFirstStreamEvent = true;
        state.streamingTimestamp ??= new Date().toISOString();
        appendStreamingText(state, event.content);
      }
      break;
    case 'tool_start':
      if (event.tool) {
        state.isStreaming = true;
        state.hasReceivedFirstStreamEvent = true;
        state.streamingTimestamp ??= new Date().toISOString();
        beginStreamingTool(state, event.tool, event.toolInput ?? {}, event.toolMetadata);
      }
      break;
    case 'tool_end':
      if (event.tool) {
        const toolKey = event.tool;
        state.isStreaming = true;
        state.hasReceivedFirstStreamEvent = true;
        state.streamingTimestamp ??= new Date().toISOString();
        completeStreamingTool(state, toolKey, event.toolResult, event.toolMetadata);

        if (['create_', 'update_', 'delete_'].some((prefix) => toolKey.startsWith(prefix))) {
          refreshStores(state.projectId);
        }
      }
      break;
    case 'card':
      if (event.card) {
        state.isStreaming = true;
        state.hasReceivedFirstStreamEvent = true;
        state.streamingTimestamp ??= new Date().toISOString();
        appendStreamingCard(state, event.card);
      }
      break;
    case 'error':
      if (event.error) {
        state.hasReceivedFirstStreamEvent = true;
        if (state.isStreaming) {
          state.streamingTimestamp ??= new Date().toISOString();
          appendStreamingText(state, `\n[Error: ${event.error}]`);
        } else {
          state.messages.push(createErrorMessage(event.error));
        }
      }
      break;
    case 'done':
      finalizeAssistantStream(state);
      break;
  }

  notify();
}

export function initNarreSessionStore(): void {
  if (initialized) {
    return;
  }

  initialized = true;
  narreService.onStreamEvent(handleStreamEvent);
}

export function subscribeNarreSessionStore(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getNarreSessionStoreVersion(): number {
  return version;
}

export function getNarreSessionState(projectId: string, sessionId: string | null): NarreSessionState {
  initNarreSessionStore();
  return ensureSessionState(projectId, sessionId);
}

export async function ensureNarreSessionLoaded(projectId: string, sessionId: string | null): Promise<void> {
  initNarreSessionStore();

  const state = ensureSessionState(projectId, sessionId);
  if (sessionId === null) {
    if (!state.hasLoaded || state.loading) {
      state.hasLoaded = true;
      state.loading = false;
      notify();
    }
    return;
  }

  const key = getSessionKey(projectId, sessionId);
  const pending = loadPromises.get(key);
  if (pending) {
    return pending;
  }

  if (state.hasLoaded) {
    return;
  }

  state.loading = true;
  notify();

  const promise = narreService.getSession(sessionId)
    .then((data) => {
      const next = ensureSessionState(projectId, sessionId);
      next.title = data.title || '';
      next.messages = buildDisplayMessages(data);
      next.loading = false;
      next.hasLoaded = true;
    })
    .catch(() => {
      const next = ensureSessionState(projectId, sessionId);
      next.loading = false;
    })
    .finally(() => {
      loadPromises.delete(key);
      notify();
    });

  loadPromises.set(key, promise);
  return promise;
}

export function primeNarreSession(projectId: string, sessionId: string | null, title?: string): void {
  const state = ensureSessionState(projectId, sessionId);
  if (title && !state.title) {
    state.title = title;
  }
  state.hasLoaded = true;
  state.loading = false;
  notify();
}

export function promoteNarreDraftSession(
  projectId: string,
  sessionId: string,
  title?: string,
): void {
  const sourceKey = getSessionKey(projectId, null);
  const source = sessions.get(sourceKey);
  const target = ensureSessionState(projectId, sessionId);

  if (source) {
    if (source.messages.length > 0 && target.messages.length === 0) {
      target.messages = source.messages.map((message) => ({
        ...message,
        blocks: cloneTranscriptBlocks(message.blocks),
      }));
    }
    if (!target.draftHtml && source.draftHtml) {
      target.draftHtml = source.draftHtml;
    }
    if (!target.pendingCommand && source.pendingCommand) {
      target.pendingCommand = source.pendingCommand;
    }
    sessions.delete(sourceKey);
  }

  moveNarreProjectDraft(projectId, null, sessionId);
  moveNarreProjectPendingCommand(projectId, null, sessionId);

  if (title && !target.title) {
    target.title = title;
  }
  target.hasLoaded = true;
  target.loading = false;
  notify();
}

export function appendNarreUserMessage(
  projectId: string,
  sessionId: string | null,
  message: NarreDisplayMessage,
): void {
  const state = ensureSessionState(projectId, sessionId);
  state.messages = [
    ...state.messages,
    {
      ...message,
      blocks: cloneTranscriptBlocks(message.blocks),
      source: 'live',
    },
  ];
  state.hasLoaded = true;
  state.loading = false;
  notify();
}

export function beginNarreAssistantStream(projectId: string, sessionId: string | null): void {
  const state = ensureSessionState(projectId, sessionId);
  state.isStreaming = true;
  state.streamingBlocks = [];
  state.streamingTimestamp = new Date().toISOString();
  state.hasReceivedFirstStreamEvent = false;
  state.isInterrupting = false;
  state.hasLoaded = true;
  state.loading = false;
  notify();
}

export function prepareNarreAssistantStream(
  projectId: string,
  sessionId: string | null,
  options: {
    draftHtml: string;
    pendingCommand: NarrePendingCommandState | null;
    userTimestamp: string;
  },
): void {
  const state = ensureSessionState(projectId, sessionId);
  state.pendingDraftHtml = options.draftHtml;
  state.pendingDraftCommand = options.pendingCommand;
  state.pendingUserTimestamp = options.userTimestamp;
  notify();
}

export function appendNarreAssistantErrorMessage(
  projectId: string,
  sessionId: string | null,
  error: string,
): void {
  const state = ensureSessionState(projectId, sessionId);
  state.messages = [...state.messages, createErrorMessage(error)];
  state.isStreaming = false;
  state.streamingBlocks = [];
  state.streamingTimestamp = null;
  state.hasReceivedFirstStreamEvent = false;
  state.isInterrupting = false;
  state.pendingDraftHtml = '';
  state.pendingDraftCommand = null;
  state.pendingUserTimestamp = null;
  state.loading = false;
  state.hasLoaded = true;
  notify();
}

export function setNarreSessionDraft(
  projectId: string,
  sessionId: string | null,
  draftHtml: string,
): void {
  const state = ensureSessionState(projectId, sessionId);
  if (state.draftHtml === draftHtml) {
    return;
  }
  state.draftHtml = draftHtml;
  setNarreProjectDraft(projectId, sessionId, draftHtml);
  notify();
}

export function setNarreSessionPendingCommand(
  projectId: string,
  sessionId: string | null,
  pendingCommand: NarrePendingCommandState | null,
): void {
  const state = ensureSessionState(projectId, sessionId);
  state.pendingCommand = pendingCommand;
  setNarreProjectPendingCommand(projectId, sessionId, pendingCommand);
  notify();
}

export function setNarreSessionInterrupting(
  projectId: string,
  sessionId: string | null,
  isInterrupting: boolean,
): void {
  const state = ensureSessionState(projectId, sessionId);
  if (state.isInterrupting === isInterrupting) {
    return;
  }
  state.isInterrupting = isInterrupting;
  notify();
}

export function updateNarreCardResponse(
  projectId: string,
  sessionId: string | null,
  toolCallId: string,
  response: unknown,
): void {
  const state = ensureSessionState(projectId, sessionId);
  let updated = updateCardResponseInBlocks(state.streamingBlocks, toolCallId, response);

  if (!updated) {
    for (let index = state.messages.length - 1; index >= 0; index -= 1) {
      const message = state.messages[index];
      if (message.role !== 'assistant') {
        continue;
      }

      if (updateCardResponseInBlocks(message.blocks, toolCallId, response)) {
        updated = true;
        break;
      }
    }
  }

  if (updated) {
    notify();
  }
}

export function cancelPendingNarreAssistantTurn(
  projectId: string,
  sessionId: string | null,
  options: {
    draftHtml: string;
    pendingCommand: NarrePendingCommandState | null;
    userTimestamp: string | null;
  },
): void {
  const state = ensureSessionState(projectId, sessionId);
  if (options.userTimestamp) {
    const nextMessages = [...state.messages];
    const lastMessage = nextMessages[nextMessages.length - 1];
    if (lastMessage?.role === 'user' && lastMessage.timestamp === options.userTimestamp) {
      nextMessages.pop();
      state.messages = nextMessages;
    }
  }

  state.draftHtml = options.draftHtml;
  setNarreProjectDraft(projectId, sessionId, options.draftHtml);
  state.pendingCommand = options.pendingCommand;
  setNarreProjectPendingCommand(projectId, sessionId, options.pendingCommand);
  state.isStreaming = false;
  state.streamingBlocks = [];
  state.streamingTimestamp = null;
  state.hasReceivedFirstStreamEvent = false;
  state.isInterrupting = false;
  state.pendingDraftHtml = '';
  state.pendingDraftCommand = null;
  state.pendingUserTimestamp = null;
  state.loading = false;
  state.hasLoaded = true;
  notify();
}
