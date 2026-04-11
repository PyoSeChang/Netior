import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { NarreMessage, NarreStreamEvent, NarreToolCall, NarreMention, NarreCard } from '@netior/shared/types';
import { narreService } from '../../../services/narre-service';
import { useI18n } from '../../../hooks/useI18n';
import { IconButton } from '../../ui/IconButton';
import { ScrollArea } from '../../ui/ScrollArea';
import { Spinner } from '../../ui/Spinner';
import { NarreMessageBubble } from './NarreMessageBubble';
import { NarreMentionInput } from './NarreMentionInput';
import { PdfTocInputForm, type PdfTocFormData } from './PdfTocInputForm';
import { useArchetypeStore } from '../../../stores/archetype-store';
import { useProjectStore } from '../../../stores/project-store';
import { toAbsolutePath } from '../../../utils/path-utils';
import { buildIndexMessage } from '../../../utils/pdf-toc-utils';
import { useConceptStore } from '../../../stores/concept-store';
import { useRelationTypeStore } from '../../../stores/relation-type-store';
import { useNetworkStore } from '../../../stores/network-store';

interface NarreChatProps {
  sessionId: string | null;
  projectId: string;
  onBackToList: () => void;
  onSessionCreated?: (sessionId: string) => void;
}

function refreshStores(projectId: string): void {
  useArchetypeStore.getState().loadByProject(projectId);
  useConceptStore.getState().loadByProject(projectId);
  useRelationTypeStore.getState().loadByProject(projectId);
  useNetworkStore.getState().loadNetworks(projectId);
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
  const [messages, setMessages] = useState<NarreMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingToolCalls, setStreamingToolCalls] = useState<NarreToolCall[]>([]);
  const [streamingCards, setStreamingCards] = useState<NarreCard[]>([]);
  const [sessionTitle, setSessionTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [indexWorkflow, setIndexWorkflow] = useState<{
    fileMention: NarreMention;
    pendingMentions: NarreMention[];
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const streamingContentRef = useRef('');
  const streamingToolCallsRef = useRef<NarreToolCall[]>([]);
  const streamingCardsRef = useRef<NarreCard[]>([]);

  // Load session data on mount
  useEffect(() => {
    if (!initialSessionId) return;
    let cancelled = false;
    setLoading(true);

    narreService.getSession(initialSessionId).then((data) => {
      if (cancelled) return;
      setSessionTitle(data.title || '');
      // Session data includes messages array
      const sessionData = data as unknown as { messages?: NarreMessage[]; title?: string };
      if (sessionData.messages) {
        setMessages(sessionData.messages);
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [initialSessionId]);

  // Subscribe to stream events
  useEffect(() => {
    const cleanup = narreService.onStreamEvent((event: unknown) => {
      const evt = event as NarreStreamEvent;
      switch (evt.type) {
        case 'text':
          if (evt.content) {
            streamingContentRef.current += evt.content;
            setStreamingContent(streamingContentRef.current);
          }
          break;
        case 'tool_start':
          if (evt.tool) {
            const newCall: NarreToolCall = {
              tool: evt.tool,
              input: evt.toolInput ?? {},
              status: 'running',
            };
            streamingToolCallsRef.current = [...streamingToolCallsRef.current, newCall];
            setStreamingToolCalls(streamingToolCallsRef.current);
          }
          break;
        case 'tool_end':
          if (evt.tool) {
            streamingToolCallsRef.current = streamingToolCallsRef.current.map((tc) =>
              tc.tool === evt.tool && tc.status === 'running'
                ? {
                    ...tc,
                    status: evt.toolResult?.startsWith('Error') ? 'error' as const : 'success' as const,
                    result: evt.toolResult,
                    error: evt.toolResult?.startsWith('Error') ? evt.toolResult : undefined,
                  }
                : tc,
            );
            setStreamingToolCalls(streamingToolCallsRef.current);
            // Refresh stores if this was a mutation tool
            const mutationPrefixes = ['create_', 'update_', 'delete_'];
            if (mutationPrefixes.some((prefix) => evt.tool!.startsWith(prefix))) {
              refreshStores(projectId);
            }
          }
          break;
        case 'card':
          if (evt.card) {
            streamingCardsRef.current = [...streamingCardsRef.current, evt.card];
            setStreamingCards(streamingCardsRef.current);
          }
          break;
        case 'error':
          streamingContentRef.current += evt.error ? `\n[Error: ${evt.error}]` : '';
          setStreamingContent(streamingContentRef.current);
          break;
        case 'done': {
          // Finalize: add assistant message, then clear streaming state atomically
          const finalContent = streamingContentRef.current;
          const finalCalls = streamingToolCallsRef.current;
          if (finalContent || finalCalls.length > 0) {
            const assistantMsg: NarreMessage = {
              role: 'assistant',
              content: finalContent,
              tool_calls: finalCalls.length > 0 ? finalCalls : undefined,
              timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
          }
          streamingContentRef.current = '';
          streamingToolCallsRef.current = [];
          streamingCardsRef.current = [];
          setStreamingContent('');
          setStreamingToolCalls([]);
          setStreamingCards([]);
          setIsStreaming(false);
          break;
        }
      }
    });

    return cleanup;
  }, [projectId]);

  // Auto-scroll logic
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent, streamingToolCalls, streamingCards]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    autoScrollRef.current = atBottom;
  }, []);

  const handleCardRespond = useCallback(async (toolCallId: string, response: unknown) => {
    if (!sessionId) return;
    try {
      await narreService.respondToCard(sessionId, toolCallId, response);
    } catch {
      // Error handling — card response failed
    }
  }, [sessionId]);

  const sendToAgent = useCallback(async (text: string, mentions: NarreMention[]) => {
    let activeSessionId = sessionId;

    // Create session if none exists
    if (!activeSessionId) {
      try {
        const session = await narreService.createSession(projectId);
        activeSessionId = session.id;
        setSessionId(session.id);
        setSessionTitle(text.slice(0, 60));
        onSessionCreated?.(session.id);
      } catch {
        return;
      }
    }

    // Add user message to local state
    const userMsg: NarreMessage = {
      role: 'user',
      content: text,
      mentions: mentions.length > 0 ? mentions : undefined,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    streamingContentRef.current = '';
    streamingToolCallsRef.current = [];
    streamingCardsRef.current = [];
    setStreamingContent('');
    setStreamingToolCalls([]);
    setStreamingCards([]);
    autoScrollRef.current = true;

    // Send to agent server via IPC
    try {
      await narreService.sendMessage({
        sessionId: activeSessionId,
        projectId,
        message: text,
        mentions: mentions.length > 0 ? mentions : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send Narre message';
      const errorMsg: NarreMessage = {
        role: 'assistant',
        content: `[Error: ${message}]`,
        timestamp: new Date().toISOString(),
      };
      streamingContentRef.current = '';
      streamingToolCallsRef.current = [];
      streamingCardsRef.current = [];
      setStreamingContent('');
      setStreamingToolCalls([]);
      setStreamingCards([]);
      setIsStreaming(false);
      setMessages((prev) => [...prev, errorMsg]);
    }
  }, [sessionId, projectId, onSessionCreated]);

  const handleSend = useCallback(async (text: string, mentions: NarreMention[]) => {
    if (!text.trim() || isStreaming) return;

    // Intercept /index command: show page range input form
    if (text.trim().startsWith('/index')) {
      const fileMention = mentions.find((m) => m.type === 'file');
      if (!fileMention || !fileMention.id) {
        // Show error as system-style message
        const errorMsg: NarreMessage = {
          role: 'assistant',
          content: t('pdfToc.noFile'),
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        return;
      }
      setIndexWorkflow({ fileMention, pendingMentions: mentions });
      return;
    }

    await sendToAgent(text, mentions);
  }, [isStreaming, sendToAgent, t]);

  const handleIndexSubmit = useCallback(async (data: PdfTocFormData) => {
    if (!indexWorkflow) return;
    const mentions = indexWorkflow.pendingMentions;

    const absoluteFilePath = toAbsolutePath(currentProject?.root_dir ?? '', data.filePath);

    const message = buildIndexMessage(indexWorkflow.fileMention.display, {
      startPage: data.startPage,
      endPage: data.endPage,
      overviewPages: data.overviewPages,
      fileId: data.fileId,
      filePath: absoluteFilePath,
      projectId,
    });

    setIndexWorkflow(null);
    await sendToAgent(message, mentions);
  }, [indexWorkflow, sendToAgent, currentProject, projectId]);

  const handleIndexCancel = useCallback(() => {
    setIndexWorkflow(null);
  }, []);

  const title = sessionTitle || t('narre.newChat');

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
            <span>{t('narre.streaming')}</span>
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
                content={msg.content}
                mentions={msg.mentions}
                toolCalls={msg.tool_calls}
              />
            ))}

            {/* /index workflow form */}
            {indexWorkflow && (
              <PdfTocInputForm
                fileMention={indexWorkflow.fileMention}
                onSubmit={handleIndexSubmit}
                onCancel={handleIndexCancel}
              />
            )}

            {/* Streaming partial message */}
            {isStreaming && (streamingContent || streamingToolCalls.length > 0 || streamingCards.length > 0) && (
              <NarreMessageBubble
                role="assistant"
                content={streamingContent}
                toolCalls={streamingToolCalls}
                cards={streamingCards}
                onCardRespond={handleCardRespond}
                isStreaming
              />
            )}
          </div>
        </ScrollArea>
      )}

      {/* Input area */}
      <div className="border-t border-subtle p-3">
        <div className="flex items-end gap-2">
          <NarreMentionInput
            projectId={projectId}
            onSend={handleSend}
            disabled={isStreaming}
            placeholder={t('narre.inputPlaceholder')}
          />
        </div>
      </div>
    </div>
  );
}
