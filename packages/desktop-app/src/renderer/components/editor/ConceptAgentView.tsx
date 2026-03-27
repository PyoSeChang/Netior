import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useConceptStore } from '../../stores/concept-store';

interface ConceptAgentViewProps {
  conceptId: string;
  agentContent: string | null;
}

const DEBOUNCE_MS = 500;

export function ConceptAgentView({ conceptId, agentContent }: ConceptAgentViewProps): JSX.Element {
  const [localValue, setLocalValue] = useState(agentContent ?? '');
  const updateAgentContent = useConceptStore((s) => s.updateAgentContent);
  const isFocusedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external prop → local state (only when not actively editing)
  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(agentContent ?? '');
    }
  }, [agentContent]);

  const flush = useCallback(
    (value: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      updateAgentContent(conceptId, value);
    },
    [conceptId, updateAgentContent],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setLocalValue(val);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => flush(val), DEBOUNCE_MS);
    },
    [flush],
  );

  const handleBlur = useCallback(() => {
    isFocusedRef.current = false;
    flush(localValue);
  }, [flush, localValue]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <textarea
      className="h-full w-full resize-none bg-surface-base p-4 font-mono text-sm text-default outline-none placeholder:text-muted"
      value={localValue}
      onChange={handleChange}
      onFocus={() => { isFocusedRef.current = true; }}
      onBlur={handleBlur}
      placeholder="Agent content will appear here..."
      spellCheck={false}
    />
  );
}
