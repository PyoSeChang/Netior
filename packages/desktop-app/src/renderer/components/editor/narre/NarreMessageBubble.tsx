import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getNarreToolMetadata } from '@netior/shared/constants';
import type { NarreCard, NarreToolCall, NarreTranscriptBlock } from '@netior/shared/types';
import { useI18n } from '../../../hooks/useI18n';
import { Badge } from '../../ui/Badge';
import { NarreToolLog } from './NarreToolLog';
import { NarreMarkdown } from './NarreMarkdown';
import { NarreCardRenderer } from './cards/NarreCardRenderer';

interface NarreMessageBubbleProps {
  role: 'user' | 'assistant';
  blocks: NarreTranscriptBlock[];
  onCardRespond?: (toolCallId: string, response: unknown) => Promise<void> | void;
  defaultExpandedInteractiveBlocks?: boolean;
  isStreaming?: boolean;
}

const MENTION_RE = /\[(\w+):(?:id=([^,\]]*)|path="([^"]*)")(?:,\s*(?:title|name)="([^"]*)")?\]/g;
const PERMISSION_TOOL_RE = /tool "([^"]+)"/i;

function renderContentWithMentions(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;

  while ((match = MENTION_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const type = match[1];
    const display = match[4] || match[2] || match[3] || type;

    parts.push(
      <span
        key={match.index}
        className="mx-0.5 inline-flex items-center gap-0.5 rounded px-1 py-0 text-xs font-medium bg-[var(--accent)]/15 text-[var(--accent)]"
      >
        @{display}
      </span>,
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function renderAssistantContent(content: string): JSX.Element {
  const processed = content.replace(
    MENTION_RE,
    (_match, _type, id, path, title) => {
      const display = title || id || path || '';
      return `**@${display}**`;
    },
  );
  return <NarreMarkdown content={processed} />;
}

function formatPermissionSummary(
  message: string,
  t: ReturnType<typeof useI18n>['t'],
): string {
  const toolMatch = message.match(PERMISSION_TOOL_RE);
  if (!toolMatch) {
    return message;
  }

  const toolLabel = getNarreToolMetadata(toolMatch[1]).displayName;
  return t('narre.card.permissionRequest' as never, { tool: toolLabel } as never);
}

function getCardSummary(card: NarreCard, t: ReturnType<typeof useI18n>['t']): string {
  switch (card.type) {
    case 'draft':
      return card.title || 'Draft';
    case 'proposal':
      return card.title;
    case 'permission':
      return formatPermissionSummary(card.message, t);
    case 'interview':
      return card.question;
    case 'summary':
      return card.title;
    default:
      return 'Card';
  }
}

function toToolCall(block: Extract<NarreTranscriptBlock, { type: 'tool' }>): NarreToolCall {
  return {
    tool: block.toolKey,
    input: block.input,
    status: block.error ? 'error' : block.output ? 'success' : 'running',
    ...(block.metadata ? { metadata: block.metadata } : {}),
    ...(block.output ? { result: block.output } : {}),
    ...(block.error ? { error: block.error } : {}),
  };
}

function NarreCardBlock({
  card,
  onCardRespond,
  defaultExpanded,
  forceCollapseKey,
  t,
}: {
  card: NarreCard;
  onCardRespond?: (toolCallId: string, response: unknown) => Promise<void> | void;
  defaultExpanded: boolean;
  forceCollapseKey: string;
  t: ReturnType<typeof useI18n>['t'];
}): JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    setExpanded(defaultExpanded);
    if (defaultExpanded) {
      setResolved(false);
    }
  }, [defaultExpanded, forceCollapseKey]);

  const handleRespond = useCallback(async (toolCallId: string, response: unknown) => {
    if (!onCardRespond) {
      return;
    }

    await onCardRespond(toolCallId, response);
    setResolved(true);
    setExpanded(false);
  }, [onCardRespond]);

  if (expanded && onCardRespond) {
    return (
      <div className="mt-2">
        <div className="mb-1 flex justify-end">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted transition-colors hover:bg-surface-hover hover:text-secondary"
            onClick={() => setExpanded(false)}
          >
            <ChevronDown size={12} />
            <span>{t('narre.card.collapse' as never)}</span>
          </button>
        </div>
        <NarreCardRenderer card={card} onRespond={handleRespond} />
      </div>
    );
  }

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-subtle bg-surface-base">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-secondary transition-colors hover:bg-surface-hover disabled:cursor-default disabled:opacity-70"
        disabled={resolved}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
        <span className="truncate">{getCardSummary(card, t)}</span>
        {resolved && <Badge variant="success" className="ml-auto">{t('narre.card.submitted')}</Badge>}
      </button>
    </div>
  );
}

export function NarreMessageBubble({
  role,
  blocks,
  onCardRespond,
  defaultExpandedInteractiveBlocks = false,
  isStreaming = false,
}: NarreMessageBubbleProps): JSX.Element {
  const { t } = useI18n();
  const isUser = role === 'user';
  const contentBlocks = blocks.filter((block) => block.type !== 'tool');
  const toolCalls = blocks
    .filter((block): block is Extract<NarreTranscriptBlock, { type: 'tool' }> => block.type === 'tool')
    .map(toToolCall);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={[
          'max-w-[85%] rounded-xl px-3 py-2 text-sm',
          isUser
            ? 'bg-[var(--accent)]/10 text-default'
            : 'bg-surface-card text-default',
        ].join(' ')}
      >
        {blocks.length === 0 && isStreaming && (
          <div className="text-xs text-muted animate-pulse">...</div>
        )}

        {contentBlocks.map((block, index) => {
          switch (block.type) {
            case 'rich_text':
              return (
                <div
                  key={block.id}
                  className={[
                    index > 0 ? 'mt-2' : '',
                    isUser ? 'whitespace-pre-wrap break-words' : 'break-words',
                  ].join(' ')}
                >
                  {isUser ? renderContentWithMentions(block.text) : renderAssistantContent(block.text)}
                </div>
              );
            case 'command': {
              const detailBadges = [
                ...(block.refs ?? []).map((ref) => (
                  <Badge key={`${block.id}:${ref.type}:${ref.id ?? ref.path ?? ref.display}`} variant="accent">
                    @{ref.display}
                  </Badge>
                )),
                ...(block.args?.startPage && block.args?.endPage
                  ? [<Badge key={`${block.id}:range`}>{`${block.args.startPage}-${block.args.endPage}`}</Badge>]
                  : []),
                ...(block.args?.overviewPages
                  ? [<Badge key={`${block.id}:overview`}>{`${t('pdfToc.overviewPages')}: ${block.args.overviewPages}`}</Badge>]
                  : []),
              ];

              return (
                <div key={block.id} className={index > 0 ? 'mt-2' : ''}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-accent-muted px-2 py-0.5 text-xs font-semibold text-accent">
                      {block.label || `/${block.name}`}
                    </span>
                  </div>
                  {detailBadges.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {detailBadges}
                    </div>
                  )}
                </div>
              );
            }
            case 'draft':
              return (
                <div key={block.id} className={index > 0 ? 'mt-2' : ''}>
                  <NarreMarkdown content={block.content} />
                </div>
              );
            case 'tool':
              return (
                <div
                  key={`${block.id}:${defaultExpandedInteractiveBlocks ? 'open' : 'closed'}`}
                  className={index > 0 ? 'mt-2' : ''}
                >
                  <NarreToolLog calls={[toToolCall(block)]} defaultExpanded={defaultExpandedInteractiveBlocks || isStreaming} />
                </div>
              );
            case 'card':
              return (
                <NarreCardBlock
                  key={`${block.id}:${defaultExpandedInteractiveBlocks ? 'open' : 'closed'}`}
                  card={block.card}
                  onCardRespond={onCardRespond}
                  defaultExpanded={defaultExpandedInteractiveBlocks || isStreaming}
                  forceCollapseKey={`${defaultExpandedInteractiveBlocks ? 'open' : 'closed'}:${isStreaming ? 'streaming' : 'restored'}`}
                  t={t}
                />
              );
            default:
              return null;
          }
        })}

        {toolCalls.length > 0 && (
          <div className={contentBlocks.length > 0 ? 'mt-2' : ''}>
            <NarreToolLog calls={toolCalls} defaultExpanded={defaultExpandedInteractiveBlocks || isStreaming} />
          </div>
        )}
      </div>
    </div>
  );
}
