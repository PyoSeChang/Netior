import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../hooks/useI18n';
import { IconButton } from '../ui/IconButton';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import type { TerminalEngineInstance } from '../../lib/terminal/engine';

function getSearchController(instance: TerminalEngineInstance | null) {
  return instance?.getSearchController();
}

interface TerminalSearchBarProps {
  instanceRef: React.RefObject<TerminalEngineInstance | null>;
  onClose: () => void;
}

export function TerminalSearchBar({ instanceRef, onClose }: TerminalSearchBarProps): JSX.Element {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(-1);
  const [matchCount, setMatchCount] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const findResultListenerRef = useRef<{ dispose(): void } | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();

    // Subscribe to find result changes
    const searchController = getSearchController(instanceRef.current);
    if (searchController?.onDidChangeFindResults) {
      findResultListenerRef.current = searchController.onDidChangeFindResults((result) => {
        setMatchIndex(result.resultIndex);
        setMatchCount(result.resultCount);
        setNotFound(result.resultCount === 0);
      });
    }

    return () => {
      findResultListenerRef.current?.dispose();
      findResultListenerRef.current = null;
      getSearchController(instanceRef.current)?.clearSearchDecorations();
    };
  }, [instanceRef]);

  const doFind = useCallback((direction: 'next' | 'previous') => {
    const searchController = getSearchController(instanceRef.current);
    if (!searchController || !query) {
      setMatchIndex(-1);
      setMatchCount(0);
      setNotFound(false);
      return;
    }

    const fn = direction === 'next' ? searchController.findNext : searchController.findPrevious;
    void fn.call(searchController, query, { incremental: direction === 'next' }).then((found) => {
      if (!found) {
        setNotFound(true);
        setMatchIndex(-1);
        setMatchCount(0);
      } else {
        setNotFound(false);
        if (searchController.findResult) {
          setMatchIndex(searchController.findResult.resultIndex);
          setMatchCount(searchController.findResult.resultCount);
        }
      }
    });
  }, [query, instanceRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      getSearchController(instanceRef.current)?.clearSearchDecorations();
      onClose();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      doFind(e.shiftKey ? 'previous' : 'next');
    }
  }, [doFind, onClose, instanceRef]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (!value) {
      getSearchController(instanceRef.current)?.clearSearchDecorations();
      setMatchIndex(-1);
      setMatchCount(0);
      setNotFound(false);
    }
  }, [instanceRef]);

  const renderMatchInfo = (): React.ReactNode => {
    if (!query) return null;
    if (notFound || matchCount === 0) {
      return <span className="text-xs text-status-error whitespace-nowrap">{t('terminal.noResults')}</span>;
    }
    if (matchCount > 0) {
      return <span className="text-xs text-muted whitespace-nowrap">{matchIndex + 1}/{matchCount}</span>;
    }
    return null;
  };

  return (
    <div
      className="absolute top-2 right-4 z-10 flex items-center gap-1 rounded-lg border border-default bg-surface-panel px-2 py-1 shadow-md"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={t('terminal.searchPlaceholder')}
        className="w-48 bg-transparent px-1 py-0.5 text-xs text-default outline-none placeholder:text-muted"
      />
      {renderMatchInfo()}
      <IconButton label={t('terminal.previousMatch')} className="!w-6 !h-6" onClick={() => doFind('previous')}>
        <ChevronUp size={14} />
      </IconButton>
      <IconButton label={t('terminal.nextMatch')} className="!w-6 !h-6" onClick={() => doFind('next')}>
        <ChevronDown size={14} />
      </IconButton>
      <IconButton label={t('terminal.closeSearch')} className="!w-6 !h-6" onClick={onClose}>
        <X size={14} />
      </IconButton>
    </div>
  );
}
