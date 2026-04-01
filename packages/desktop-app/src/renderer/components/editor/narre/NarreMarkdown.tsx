import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface NarreMarkdownProps {
  content: string;
}

const components: Components = {
  table: ({ children }) => (
    <table className="w-full border-collapse my-2 text-xs">{children}</table>
  ),
  th: ({ children }) => (
    <th className="text-left p-1.5 border-b border-border-default text-text-secondary font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="p-1.5 border-b border-border-subtle text-text-default">{children}</td>
  ),
  // In react-markdown v10, code inside <pre> is rendered as pre > code.
  // Standalone code (inline) renders as just <code>.
  // We style pre as block code and code as inline code.
  pre: ({ children }) => (
    <pre className="p-2 my-2 rounded bg-surface-panel overflow-x-auto text-xs font-mono">
      {children}
    </pre>
  ),
  code: ({ children, ...props }) => (
    <code
      className="px-1 py-0.5 rounded bg-surface-panel text-xs font-mono"
      {...props}
    >
      {children}
    </code>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-accent hover:underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => <li className="text-text-default">{children}</li>,
  p: ({ children }) => <p className="my-1">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  h1: ({ children }) => (
    <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-bold mt-2 mb-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent pl-3 my-2 text-text-secondary">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border-subtle my-3" />,
};

export function NarreMarkdown({ content }: NarreMarkdownProps): JSX.Element {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </Markdown>
  );
}
