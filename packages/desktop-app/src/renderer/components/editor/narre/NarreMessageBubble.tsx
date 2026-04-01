import React from 'react';
import type { NarreCard, NarreMention, NarreToolCall } from '@netior/shared/types';
import { NarreToolLog } from './NarreToolLog';
import { NarreMarkdown } from './NarreMarkdown';
import { NarreCardRenderer } from './cards/NarreCardRenderer';

interface NarreMessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  mentions?: NarreMention[];
  toolCalls?: NarreToolCall[];
  cards?: NarreCard[];
  onCardRespond?: (toolCallId: string, response: unknown) => void;
  isStreaming?: boolean;
}

// Parses [type:id=xxx, title="display"] into chips
const MENTION_RE = /\[(\w+):(?:id=([^,\]]*)|path="([^"]*)")(?:,\s*(?:title|name)="([^"]*)")?\]/g;

function renderContentWithMentions(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = MENTION_RE.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const type = match[1];
    const display = match[4] || match[2] || match[3] || type;

    parts.push(
      <span
        key={match.index}
        className="inline-flex items-center gap-0.5 rounded px-1 py-0 mx-0.5 text-xs font-medium bg-[var(--accent)]/15 text-[var(--accent)]"
      >
        @{display}
      </span>,
    );

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/**
 * Pre-process mention bracket syntax to a safe placeholder for markdown,
 * then render mention chips alongside markdown output.
 *
 * For user messages we keep plain text rendering with mention chips.
 * For assistant messages we use NarreMarkdown.
 */
function renderAssistantContent(content: string): JSX.Element {
  // Assistant messages typically don't include mention brackets,
  // but if they do, convert them to bold display for markdown rendering.
  const processed = content.replace(
    MENTION_RE,
    (_match, _type, id, path, title) => {
      const display = title || id || path || '';
      return `**@${display}**`;
    },
  );
  return <NarreMarkdown content={processed} />;
}

export function NarreMessageBubble({
  role,
  content,
  toolCalls,
  cards,
  onCardRespond,
  isStreaming = false,
}: NarreMessageBubbleProps): JSX.Element {
  const isUser = role === 'user';

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
        {content && (
          <div className={isUser ? 'whitespace-pre-wrap break-words' : 'break-words'}>
            {isUser
              ? renderContentWithMentions(content)
              : renderAssistantContent(content)}
          </div>
        )}
        {isStreaming && !content && (
          <div className="text-muted text-xs animate-pulse">...</div>
        )}
        {cards && cards.length > 0 && onCardRespond && (
          cards.map((card, idx) => (
            <NarreCardRenderer
              key={'toolCallId' in card ? card.toolCallId : idx}
              card={card}
              onRespond={onCardRespond}
            />
          ))
        )}
        {toolCalls && toolCalls.length > 0 && (
          <NarreToolLog calls={toolCalls} defaultExpanded={isStreaming} />
        )}
      </div>
    </div>
  );
}
