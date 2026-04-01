import React from 'react';
import type { NarreMention, NarreToolCall } from '@moc/shared/types';
import { NarreToolLog } from './NarreToolLog';

interface NarreMessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  mentions?: NarreMention[];
  toolCalls?: NarreToolCall[];
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

export function NarreMessageBubble({
  role,
  content,
  toolCalls,
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
          <div className="whitespace-pre-wrap break-words">
            {renderContentWithMentions(content)}
          </div>
        )}
        {isStreaming && !content && (
          <div className="text-muted text-xs animate-pulse">...</div>
        )}
        {toolCalls && toolCalls.length > 0 && (
          <NarreToolLog calls={toolCalls} defaultExpanded={isStreaming} />
        )}
      </div>
    </div>
  );
}
