import React, { useCallback } from 'react';
import { ContentEditableEditor } from './ContentEditableEditor';
import { useConceptStore } from '../../stores/concept-store';

interface ConceptBodyEditorProps {
  conceptId: string;
  content: string | null;
}

export function ConceptBodyEditor({ conceptId, content }: ConceptBodyEditorProps): JSX.Element {
  const updateContent = useConceptStore((s) => s.updateContent);

  const handleChange = useCallback(
    (newContent: string) => {
      updateContent(conceptId, newContent || null);
    },
    [conceptId, updateContent],
  );

  return (
    <ContentEditableEditor
      value={content ?? ''}
      onChange={handleChange}
      placeholder="Write something..."
      className="min-h-[120px] text-sm text-default leading-relaxed"
    />
  );
}
