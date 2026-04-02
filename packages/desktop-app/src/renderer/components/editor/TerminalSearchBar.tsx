import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ITerminalInstance } from '@codingame/monaco-vscode-api/vscode/vs/workbench/contrib/terminal/browser/terminal';
import { useI18n } from '../../hooks/useI18n';
import { IconButton } from '../ui/IconButton';
import { ChevronUp, ChevronDown, X } from 'lucide-react';

interface XtermWithFind {
  findNext(term: string, opts: { incremental?: boolean }): Promise<boolean>;
  findPrevious(term: string, opts: { incremental?: boolean }): Promise<boolean>;
  clearSearchDecorations(): void;
  clearActiveSearchDecoration(): void;
  findResult?: { resultIndex: number; resultCount: number };
  onDidChangeFindResults?: (listener: (result: { resultIndex: number; resultCount: number }) => void) => { dispose(): void };
}

function getXterm(instance: ITerminalInstance | null): XtermWithFind | undefined {
  return (instance as unknown as { xterm?: XtermWithFind })?.xterm;
}

interface TerminalSearchBarProps {
  instanceRef: React.RefObject<ITerminalInstance | null>;
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
    const xterm = getXterm(instanceRef.current);
    if (xterm?.onDidChangeFindResults) {
      findResultListenerRef.current = xterm.onDidChangeFindResults((result) => {
        setMatchIndex(result.resultIndex);
        setMatchCount(result.resultCount);
        setNotFound(result.resultCount === 0);
      });
    }

    return () => {
      findResultListenerRef.current?.dispose();
      findResultListenerRef.current = null;
      getXterm(instanceRef.current)?.clearSearchDecorations();
    };
  }, [instanceRef]);

  const doFind = useCallback((direction: 'next' | 'previous') => {
    const xterm = getXterm(instanceRef.current);
    if (!xterm || !query) {
      setMatchIndex(-1);
      setMatchCount(0);
      setNotFound(false);
      return;
    }

    const fn = direction === 'next' ? xterm.findNext : xterm.findPrevious;
    void fn.call(xterm, query, { incremental: direction === 'next' }).then((found) => {
      if (!found) {
        setNotFound(true);
        setMatchIndex(-1);
        setMatchCount(0);
      } else {
        setNotFound(false);
        // Read latest result from xterm
        if (xterm.findResult) {
          setMatchIndex(xterm.findResult.resultIndex);
          setMatchCount(xterm.findResult.resultCount);
        }
      }
    });
  }, [query, instanceRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      getXterm(instanceRef.current)?.clearSearchDecorations();
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
      getXterm(instanceRef.current)?.clearSearchDecorations();
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
