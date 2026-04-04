import { useState, useCallback, useRef } from 'react';

/**
 * In-memory view state cache per editor tab.
 * Survives component unmount/remount (tab switching) but not app restart.
 * For persistent state, use file metadata or editor prefs separately.
 */
const viewStateCache = new Map<string, unknown>();

/** Clear cached view state when a tab is closed. */
export function clearViewState(tabId: string): void {
  viewStateCache.delete(tabId);
}

/**
 * Hook to manage per-tab view state (cursor, scroll, page, etc.)
 * that survives tab switches but lives only in memory.
 *
 * @param tabId - Unique tab identifier
 * @param defaultState - Default state used when no cache exists
 * @returns [state, setState] tuple
 */
export function useViewState<T>(tabId: string, defaultState: T): [T, (updater: T | ((prev: T) => T)) => void] {
  const [state, setStateRaw] = useState<T>(() => {
    const cached = viewStateCache.get(tabId);
    return cached !== undefined ? (cached as T) : defaultState;
  });
  const stateRef = useRef(state);

  const setState = useCallback((updater: T | ((prev: T) => T)) => {
    setStateRaw((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;
      stateRef.current = next;
      viewStateCache.set(tabId, next);
      return next;
    });
  }, [tabId]);

  return [state, setState];
}
