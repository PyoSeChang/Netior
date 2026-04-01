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
import { useArchetypeStore } from '../../../stores/archetype-store';
import { useConceptStore } from '../../../stores/concept-store';
import { useRelationTypeStore } from '../../../stores/relation-type-store';
import { useCanvasTypeStore } from '../../../stores/canvas-type-store';
import { useCanvasStore } from '../../../stores/canvas-store';

interface NarreChatProps {
  sessionId: string | null;
  projectId: string;
  onBackToList: () => void;
}

function refreshStores(projectId: string): void {
  useArchetypeStore.getState().loadByProject(projectId);
  useConceptStore.getState().loadByProject(projectId);
  useRelationTypeStore.getState().loadByProject(projectId);
  useCanvasTypeStore.getState().loadByProject(projectId);
  useCanvasStore.getState().loadCanvases(projectId);
}

export function NarreChat({
  sessionId: initialSessionId,
  projectId,
  onBackToList,
}: NarreChatProps): JSX.Element {
  const { t } = useI18n();
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [messages, setMessages] = useState<NarreMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingToolCalls, setStreamingToolCalls] = useState<NarreToolCall[]>([]);
  const [streamingCards, setStreamingCards] = useState<NarreCard[]>([]);
  const [sessionTitle, setSessionTitle] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleSend = useCallback(async (text: string, mentions: NarreMention[]) => {
    if (!text.trim() || isStreaming) return;

    let activeSessionId = sessionId;

    // Create session if none exists
    if (!activeSessionId) {
      try {
        const session = await narreService.createSession(projectId);
        activeSessionId = session.id;
        setSessionId(session.id);
        setSessionTitle(text.slice(0, 60));
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
    } catch {
      setIsStreaming(false);
    }
  }, [sessionId, projectId, isStreaming]);

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
