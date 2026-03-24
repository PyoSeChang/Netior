import React, { useCallback } from 'react';

interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave: () => void;
}

export function MarkdownEditor({ content, onChange, onSave }: MarkdownEditorProps): JSX.Element {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave();
      }
    },
    [onSave],
  );

  return (
    <textarea
      className="h-full w-full resize-none bg-surface-base p-4 font-mono text-sm text-default outline-none"
      value={content}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      spellCheck={false}
    />
  );
}
