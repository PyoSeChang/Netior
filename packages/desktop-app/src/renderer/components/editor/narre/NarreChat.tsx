import React, { useEffect, useState, useRef, useCallback, useSyncExternalStore } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SLASH_COMMANDS } from '@netior/shared/constants';
import type {
  NarreCard,
  NarreMention,
  NarreTranscriptBlock,
} from '@netior/shared/types';
import { narreService } from '../../../services/narre-service';
import { useI18n } from '../../../hooks/useI18n';
import {
  appendNarreAssistantErrorMessage,
  appendNarreUserMessage,
  beginNarreAssistantStream,
  cancelPendingNarreAssistantTurn,
  ensureNarreSessionLoaded,
  getNarreSessionState,
  getNarreSessionStoreVersion,
  initNarreSessionStore,
  prepareNarreAssistantStream,
  primeNarreSession,
  promoteNarreDraftSession,
  setNarreSessionPendingCommand,
  setNarreSessionInterrupting,
  setNarreSessionDraft,
  updateNarreCardResponse,
  subscribeNarreSessionStore,
  type NarreDisplayMessage,
} from '../../../lib/narre-session-store';
import { IconButton } from '../../ui/IconButton';
import { ScrollArea } from '../../ui/ScrollArea';
import { Spinner } from '../../ui/Spinner';
import { NarreMessageBubble } from './NarreMessageBubble';
import type { NarreComposerSubmit } from './NarreMentionInput';
import { NarreInputSwitcher, type NarreInteractivePrompt } from './NarreInputSwitcher';
import { useProjectStore } from '../../../stores/project-store';
import type { NarrePendingCommandState } from '../../../lib/narre-ui-state';
import { toAbsolutePath } from '../../../utils/path-utils';
import { buildIndexMessage } from '../../../utils/pdf-toc-utils';

interface NarreChatProps {
  sessionId: string | null;
  projectId: string;
  onBackToList: () => void;
  onSessionCreated?: (sessionId: string) => void;
}

initNarreSessionStore();

function getSlashCommand(commandName: string): (typeof SLASH_COMMANDS)[number] | null {
  return SLASH_COMMANDS.find((command) => command.name === commandName) ?? null;
}

function isPdfMention(mention: NarreMention): boolean {
  const candidate = mention.path ?? mention.display;
  return candidate.toLowerCase().endsWith('.pdf');
}

function parseOverviewPagesText(rawText: string): number[] | undefined {
  const values = rawText
    .split(',')
    .map((value) => parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);

  return values.length > 0 ? values : undefined;
}

function buildComposerBlockId(prefix = 'composer'): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function buildUserDisplayBlocks(
  text: string,
  mentions: NarreMention[],
  pendingCommand: NarrePendingCommandState | null,
): NarreTranscriptBlock[] {
  if (!pendingCommand) {
    return [
      {
        id: buildComposerBlockId('user-text'),
        type: 'rich_text',
        text,
        ...(mentions.length > 0 ? { mentions } : {}),
      },
    ];
  }

  const commandBlock: Extract<NarreTranscriptBlock, { type: 'command' }> = {
    id: buildComposerBlockId('user-command'),
    type: 'command',
    name: pendingCommand.name,
    label: `/${pendingCommand.name}`,
    ...(mentions.length > 0 ? { refs: mentions } : {}),
  };

  if (pendingCommand.name === 'index' && pendingCommand.indexArgs) {
    commandBlock.args = {
      startPage: String(pendingCommand.indexArgs.startPage),
      endPage: String(pendingCommand.indexArgs.endPage),
      ...(pendingCommand.indexArgs.overviewPagesText
        ? { overviewPages: pendingCommand.indexArgs.overviewPagesText }
        : {}),
    };
  }

  const blocks: NarreTranscriptBlock[] = [commandBlock];
  if (text.trim()) {
    blocks.push({
      id: buildComposerBlockId('user-text'),
      type: 'rich_text',
      text,
    });
  }

  return blocks;
}

function isResolvedInteractiveCard(card: NarreCard): boolean {
  switch (card.type) {
    case 'permission':
      return typeof card.resolvedActionKey === 'string' && card.resolvedActionKey.length > 0;
    case 'draft':
      return Boolean(card.submittedResponse);
    case 'interview':
      return Boolean(card.submittedResponse);
    default:
      return true;
  }
}

function toInteractivePrompt(card: NarreCard): NarreInteractivePrompt | null {
  switch (card.type) {
    case 'permission':
      return isResolvedInteractiveCard(card) ? null : { kind: 'permission', card };
    case 'draft':
      return isResolvedInteractiveCard(card) ? null : { kind: 'draft', card };
    case 'interview':
      return isResolvedInteractiveCard(card) ? null : { kind: 'interview', card };
    default:
      return null;
  }
}

function findActiveInteractivePrompt(blocks: NarreTranscriptBlock[]): NarreInteractivePrompt | null {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block.type !== 'card') {
      continue;
    }

    const prompt = toInteractivePrompt(block.card);
    if (prompt) {
      return prompt;
    }
  }

  return null;
}

export function NarreChat({
  sessionId: initialSessionId,
  projectId,
  onBackToList,
  onSessionCreated,
}: NarreChatProps): JSX.Element {
  const { t } = useI18n();
  const currentProject = useProjectStore((s) => s.currentProject);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  useEffect(() => {
    setSessionId(initialSessionId);
  }, [initialSessionId]);

  useSyncExternalStore(subscribeNarreSessionStore, getNarreSessionStoreVersion);
  const sessionState = getNarreSessionState(projectId, sessionId);
  const {
    messages,
    isStreaming,
    streamingBlocks,
    hasReceivedFirstStreamEvent,
    isInterrupting,
    pendingDraftHtml,
    pendingDraftCommand,
    pendingUserTimestamp,
    title: sessionTitle,
    loading,
    pendingCommand,
    draftHtml,
  } = sessionState;
  const activePrompt = (() => {
    const streamingPrompt = findActiveInteractivePrompt(streamingBlocks);
    if (streamingPrompt) {
      return streamingPrompt;
    }

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role !== 'assistant') {
        continue;
      }

      const prompt = findActiveInteractivePrompt(message.blocks);
      if (prompt) {
        return prompt;
      }
    }

    return null;
  })();

  useEffect(() => {
    void ensureNarreSessionLoaded(projectId, sessionId).catch(() => {});
  }, [projectId, sessionId]);

  // Auto-scroll logic
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingBlocks]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    autoScrollRef.current = atBottom;
  }, []);

  const handleCardRespond = useCallback(async (toolCallId: string, response: unknown) => {
    if (!sessionId) {
      throw new Error('Missing Narre session');
    }

    await narreService.respondToCard(sessionId, toolCallId, response);
    updateNarreCardResponse(projectId, sessionId, toolCallId, response);
  }, [projectId, sessionId]);

  const buildCommandPreview = useCallback((
    commandState: NarrePendingCommandState,
    mentions: NarreMention[],
  ): string => {
    const slashCommand = getSlashCommand(commandState.name);
    const label = slashCommand ? t(slashCommand.description as any) : `/${commandState.name}`;

    if (commandState.name !== 'index') {
      return label;
    }

    const fileMention = mentions.find((mention) => mention.type === 'file');
    const detailParts = [
      fileMention?.display,
      commandState.indexArgs ? `${commandState.indexArgs.startPage}-${commandState.indexArgs.endPage}` : null,
      commandState.indexArgs?.overviewPagesText
        ? t('pdfToc.overviewPages')
        : null,
    ].filter((part): part is string => Boolean(part));
    return detailParts.length > 0 ? `${label}\n${detailParts.join(' - ')}` : label;
    const preview = detailParts.join(' · ');
    return detailParts.length > 0 ? `${label}\n${preview}` : label;

    return detailParts.length > 0 ? `${label}\n${detailParts.join(' · ')}` : label;
  }, [t]);

  const sendToAgent = useCallback(async ({
    message,
    mentions,
    composerHtml,
    previewContent,
    userBlocks,
    pendingCommand: commandState,
  }: {
    message: string;
    mentions: NarreMention[];
    composerHtml: string;
    previewContent?: string;
    userBlocks: NarreTranscriptBlock[];
    pendingCommand: NarrePendingCommandState | null;
  }) => {
    let activeSessionId = sessionId;
    const nextTitle = (previewContent ?? message).slice(0, 60);

    if (!activeSessionId) {
      try {
        const session = await narreService.createSession(projectId);
        activeSessionId = session.id;
        promoteNarreDraftSession(projectId, session.id, nextTitle);
        setSessionId(session.id);
        onSessionCreated?.(session.id);
      } catch {
        return false;
      }
    } else {
      primeNarreSession(projectId, activeSessionId, nextTitle);
    }

    const userMsg: NarreDisplayMessage = {
      role: 'user',
      timestamp: new Date().toISOString(),
      blocks: userBlocks,
      source: 'live',
    };
    appendNarreUserMessage(projectId, activeSessionId, userMsg);
    prepareNarreAssistantStream(projectId, activeSessionId, {
      draftHtml: composerHtml,
      pendingCommand: commandState,
      userTimestamp: userMsg.timestamp,
    });
    beginNarreAssistantStream(projectId, activeSessionId);
    setNarreSessionDraft(projectId, sessionId, '');
    setNarreSessionDraft(projectId, activeSessionId, '');
    setNarreSessionPendingCommand(projectId, sessionId, null);
    setNarreSessionPendingCommand(projectId, activeSessionId, null);
    autoScrollRef.current = true;

    try {
      await narreService.sendMessage({
        sessionId: activeSessionId,
        projectId,
        message,
        mentions: mentions.length > 0 ? mentions : undefined,
      });
      return true;
    } catch (error) {
      cancelPendingNarreAssistantTurn(projectId, activeSessionId, {
        draftHtml: composerHtml,
        pendingCommand: commandState,
        userTimestamp: userMsg.timestamp,
      });
      appendNarreAssistantErrorMessage(
        projectId,
        activeSessionId,
        error instanceof Error ? error.message : 'Failed to send Narre message',
      );
      return false;
    }
  }, [sessionId, projectId, onSessionCreated]);

  const handleSend = useCallback(async ({
    text,
    mentions,
    draftHtml: composerHtml,
    pendingCommand: commandState,
  }: NarreComposerSubmit) => {
    if (isStreaming) {
      return false;
    }

    if (!commandState) {
      if (!text.trim()) {
        return false;
      }

      return sendToAgent({
        message: text,
        mentions,
        composerHtml,
        userBlocks: buildUserDisplayBlocks(text, mentions, null),
        pendingCommand: null,
      });
    }

    if (commandState.name === 'index') {
      const fileMention = mentions.find((mention) => mention.type === 'file');
      if (!fileMention || !fileMention.id || !commandState.indexArgs) {
        return false;
      }

      if (!isPdfMention(fileMention)) {
        return false;
      }

      const absoluteFilePath = toAbsolutePath(
        currentProject?.root_dir ?? '',
        fileMention.path ?? fileMention.display,
      );

      const message = buildIndexMessage(fileMention.display, {
        startPage: commandState.indexArgs.startPage,
        endPage: commandState.indexArgs.endPage,
        overviewPages: parseOverviewPagesText(commandState.indexArgs.overviewPagesText),
        fileId: fileMention.id,
        filePath: absoluteFilePath,
        projectId,
      });

      return sendToAgent({
        message,
        mentions,
        composerHtml,
        previewContent: buildCommandPreview(commandState, mentions),
        userBlocks: buildUserDisplayBlocks(text, mentions, commandState),
        pendingCommand: commandState,
      });
    }

    const normalizedText = text.trim();
    const preview = buildCommandPreview(commandState, mentions);

    return sendToAgent({
      message: normalizedText ? `/${commandState.name}\n${normalizedText}` : `/${commandState.name}`,
      mentions,
      composerHtml,
      previewContent: normalizedText ? `${preview}\n${normalizedText}` : preview,
      userBlocks: buildUserDisplayBlocks(normalizedText, mentions, commandState),
      pendingCommand: commandState,
    });
  }, [buildCommandPreview, currentProject, isStreaming, projectId, sendToAgent]);

  const title = sessionTitle || t('narre.newChat');
  const sendLocked = isStreaming;

  const handleInterrupt = useCallback(async () => {
    if (!sessionId || !isStreaming || isInterrupting) {
      return;
    }

    const shouldRestorePendingTurn = !hasReceivedFirstStreamEvent;

    setNarreSessionInterrupting(projectId, sessionId, true);

    try {
      const interrupted = await narreService.interruptMessage(sessionId);
      if (!interrupted) {
        setNarreSessionInterrupting(projectId, sessionId, false);
        return;
      }

      if (shouldRestorePendingTurn) {
        cancelPendingNarreAssistantTurn(projectId, sessionId, {
          draftHtml: pendingDraftHtml,
          pendingCommand: pendingDraftCommand,
          userTimestamp: pendingUserTimestamp,
        });
      }
    } catch (error) {
      setNarreSessionInterrupting(projectId, sessionId, false);
      appendNarreAssistantErrorMessage(
        projectId,
        sessionId,
        error instanceof Error ? error.message : t('narre.interruptFailed'),
      );
    }
  }, [
    hasReceivedFirstStreamEvent,
    isInterrupting,
    isStreaming,
    pendingDraftCommand,
    pendingDraftHtml,
    pendingUserTimestamp,
    projectId,
    sessionId,
    t,
  ]);

  useEffect(() => {
    if (!isStreaming) {
      return;
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.repeat || event.defaultPrevented) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void handleInterrupt();
    };

    window.addEventListener('keydown', handleWindowKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown, true);
    };
  }, [handleInterrupt, isStreaming]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-subtle px-3 py-2">
        <IconButton label={t('narre.backToList')} onClick={onBackToList}>
          <ArrowLeft size={16} />
        </IconButton>
        <h2 className="truncate text-sm font-medium text-default">
          {title}
        </h2>
        {isStreaming && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-muted">
            <Spinner size="sm" />
            <span>{isInterrupting ? t('narre.interrupting') : t('narre.streaming')}</span>
          </div>
        )}
      </div>

      {/* Message area */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <ScrollArea className="flex-1" style={{ overflowY: 'auto' }}>
          <div
            ref={scrollRef}
            className="flex flex-col gap-3 p-4 h-full overflow-y-auto"
            onScroll={handleScroll}
          >
            {messages.length === 0 && !isStreaming && (
              <div className="flex h-full items-center justify-center">
                <p className="text-xs text-muted">{t('narre.startChat')}</p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <NarreMessageBubble
                key={idx}
                role={msg.role}
                blocks={msg.blocks}
                onCardRespond={handleCardRespond}
                defaultExpandedInteractiveBlocks={!activePrompt && msg.source === 'live' && msg.role === 'assistant' && idx === messages.length - 1}
              />
            ))}
            {/* Streaming partial message */}
            {isStreaming && streamingBlocks.length > 0 && (
              <NarreMessageBubble
                role="assistant"
                blocks={streamingBlocks}
                onCardRespond={handleCardRespond}
                defaultExpandedInteractiveBlocks={!activePrompt}
                isStreaming
              />
            )}
          </div>
        </ScrollArea>
      )}

      {/* Input area */}
      <div className="border-t border-subtle p-3">
        <NarreInputSwitcher
          projectId={projectId}
          onSend={handleSend}
          disabled={isStreaming && !isInterrupting}
          sendDisabled={sendLocked}
          placeholder={t('narre.inputPlaceholder')}
          draftHtml={draftHtml}
          pendingCommand={pendingCommand}
          activePrompt={activePrompt}
          onPromptRespond={handleCardRespond}
          onDraftChange={(nextDraftHtml) => {
            setNarreSessionDraft(projectId, sessionId, nextDraftHtml);
          }}
          onPendingCommandChange={(nextCommand) => {
            setNarreSessionPendingCommand(projectId, sessionId, nextCommand);
          }}
        />
      </div>
    </div>
  );
}
