import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getNarreToolMetadata, normalizeNetiorToolName } from '@netior/shared/constants';
import type { NarreCard, NarreToolCall, NarreTranscriptBlock } from '@netior/shared/types';
import { useI18n } from '../../../hooks/useI18n';
import { Badge } from '../../ui/Badge';
import { NarreToolLog, type NarreToolLogItem } from './NarreToolLog';
import { NarreMarkdown } from './NarreMarkdown';
import { getLocalizedToolLabel } from './narre-tool-presenter-localized';
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
  locale: string,
  t: ReturnType<typeof useI18n>['t'],
): string {
  const toolMatch = message.match(PERMISSION_TOOL_RE);
  if (!toolMatch) {
    return message;
  }

  const toolLabel = getLocalizedToolLabel(
    toolMatch[1],
    locale,
    getNarreToolMetadata(toolMatch[1]).displayName,
  );
  return t('narre.card.permissionRequest' as never, { tool: toolLabel } as never);
}

function getCardSummary(card: NarreCard, locale: string, t: ReturnType<typeof useI18n>['t']): string {
  switch (card.type) {
    case 'draft':
      return card.title || 'Draft';
    case 'proposal':
      return card.title;
    case 'permission':
      return formatPermissionSummary(card.message, locale, t);
    case 'interview':
      return card.question;
    case 'summary':
      return card.title;
    default:
      return 'Card';
  }
}

function isInteractiveCard(card: NarreCard): boolean {
  return card.type === 'permission' || card.type === 'draft' || card.type === 'interview';
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
      return false;
  }
}

type AssistantRenderSegment =
  | { type: 'block'; block: Exclude<NarreTranscriptBlock, { type: 'tool' }> }
  | {
    type: 'tool_cluster';
    id: string;
    items: NarreToolLogItem[];
  };

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

function extractPermissionToolName(card: Extract<NarreCard, { type: 'permission' }>): string | null {
  const match = card.message.match(PERMISSION_TOOL_RE);
  return match?.[1] ? normalizeNetiorToolName(match[1]) : null;
}

function buildAssistantRenderSegments(
  blocks: NarreTranscriptBlock[],
  locale: string,
  t: ReturnType<typeof useI18n>['t'],
): AssistantRenderSegment[] {
  const segments: AssistantRenderSegment[] = [];
  const clusterStarts = new Map<number, AssistantRenderSegment>();
  const clusterMembers = new Set<number>();
  let clusterIndex = 0;
  let activeCluster:
    | {
      startIndex: number;
      items: NarreToolLogItem[];
      memberIndices: number[];
    }
    | null = null;

  const flushCluster = (): void => {
    if (!activeCluster) {
      return;
    }

    clusterStarts.set(activeCluster.startIndex, {
      type: 'tool_cluster',
      id: `tool-cluster-${clusterIndex += 1}`,
      items: activeCluster.items,
    });
    activeCluster.memberIndices.forEach((index) => clusterMembers.add(index));
    activeCluster = null;
  };

  blocks.forEach((block, index) => {
    if (block.type === 'tool') {
      if (!activeCluster) {
        activeCluster = {
          startIndex: index,
          items: [],
          memberIndices: [],
        };
      }

      activeCluster.items.push({ kind: 'tool', id: block.id, call: toToolCall(block) });
      activeCluster.memberIndices.push(index);
      return;
    }

    if (block.type === 'card' && block.card.type === 'permission') {
      if (!activeCluster) {
        activeCluster = {
          startIndex: index,
          items: [],
          memberIndices: [],
        };
      }

      const summary = getCardSummary(block.card, locale, t);
      const permissionToolName = extractPermissionToolName(block.card);
      const matchingToolItem = permissionToolName
        ? [...activeCluster.items]
          .reverse()
          .find((item): item is Extract<NarreToolLogItem, { kind: 'tool' }> =>
            item.kind === 'tool'
            && normalizeNetiorToolName(item.call.tool) === permissionToolName
            && !item.permission,
          )
        : null;

      if (matchingToolItem) {
        matchingToolItem.permission = {
          card: block.card,
          summary,
        };
      } else {
        activeCluster.items.push({
          kind: 'permission',
          id: block.id,
          card: block.card,
          summary,
        });
      }
      activeCluster.memberIndices.push(index);
      return;
    }

    if (block.type === 'card' || block.type === 'draft') {
      flushCluster();
    }
  });

  flushCluster();

  blocks.forEach((block, index) => {
    const cluster = clusterStarts.get(index);
    if (cluster) {
      segments.push(cluster);
    }

    if (clusterMembers.has(index)) {
      return;
    }

    segments.push({ type: 'block', block });
  });

  return segments;
}

function NarreCardBlock({
  card,
  onCardRespond,
  defaultExpanded,
  forceCollapseKey,
  locale,
  t,
}: {
  card: NarreCard;
  onCardRespond?: (toolCallId: string, response: unknown) => Promise<void> | void;
  defaultExpanded: boolean;
  forceCollapseKey: string;
  locale: string;
  t: ReturnType<typeof useI18n>['t'];
}): JSX.Element {
  const cardResolved = isResolvedInteractiveCard(card);
  const [expanded, setExpanded] = useState(defaultExpanded && !cardResolved);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (cardResolved) {
      setExpanded(false);
      setResolved(true);
      return;
    }

    setExpanded(defaultExpanded);
    if (defaultExpanded) {
      setResolved(false);
    }
  }, [cardResolved, defaultExpanded, forceCollapseKey]);

  const handleRespond = useCallback(async (toolCallId: string, response: unknown) => {
    if (!onCardRespond) {
      return;
    }

    await onCardRespond(toolCallId, response);
    setResolved(true);
    setExpanded(false);
  }, [onCardRespond]);

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-subtle bg-surface-base">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-secondary transition-colors hover:bg-surface-hover"
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
        <span className="truncate">{getCardSummary(card, locale, t)}</span>
        {resolved && card.type !== 'permission' && <Badge variant="success" className="ml-auto">{t('narre.card.submitted')}</Badge>}
      </button>
      {expanded && (
        <div className="border-t border-subtle">
          {!onCardRespond && isInteractiveCard(card) ? (
            <div className="px-3 py-2 text-xs text-muted">
              {t('narre.card.replyInInput')}
            </div>
          ) : (
            <NarreCardRenderer
              card={card}
              onRespond={handleRespond}
            />
          )}
        </div>
      )}
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
  const { t, locale } = useI18n();
  const isUser = role === 'user';
  const segments = isUser
    ? blocks.map((block) => ({ type: 'block', block } as AssistantRenderSegment))
    : buildAssistantRenderSegments(blocks, locale, t);

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

        {segments.map((segment, index) => {
          if (segment.type === 'tool_cluster') {
            return (
              <div
                key={`${segment.id}:${defaultExpandedInteractiveBlocks ? 'open' : 'closed'}`}
                className={index > 0 ? 'mt-2' : ''}
              >
                <NarreToolLog
                  items={segment.items}
                  defaultExpanded={defaultExpandedInteractiveBlocks || isStreaming}
                  onPermissionRespond={onCardRespond}
                />
              </div>
            );
          }

          const { block } = segment;

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
            case 'card':
              return (
                <NarreCardBlock
                  key={`${block.id}:${defaultExpandedInteractiveBlocks ? 'open' : 'closed'}`}
                  card={block.card}
                  onCardRespond={onCardRespond}
                  defaultExpanded={defaultExpandedInteractiveBlocks || isStreaming}
                  forceCollapseKey={`${defaultExpandedInteractiveBlocks ? 'open' : 'closed'}:${isStreaming ? 'streaming' : 'restored'}`}
                  locale={locale}
                  t={t}
                />
              );
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
