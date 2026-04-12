import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { EditorTab } from '@netior/shared/types';
import type { TranslationKey } from '@netior/shared/i18n';
import { useEditorStore } from '../../stores/editor-store';
import { useProjectStore } from '../../stores/project-store';
import { adjustTerminalFontSize, resetTerminalFontSize } from '../../lib/terminal/hyper-fork/terminal-appearance';
import { getTerminalEngine, type TerminalEngineInstance } from '../../lib/terminal/engine';
import { TerminalSearchBar } from './TerminalSearchBar';
import { TerminalTodoPanel } from './TerminalTodoPanel';
import { extractFileLink, extractFileLinks, extractUrl, extractUrls } from '../../lib/terminal/terminal-link-parser';
import { subscribeTodoStore, isTodoEnabled } from '../../lib/terminal-todo-store';
import { logShortcut } from '../../shortcuts/shortcut-utils';
import { getDefaultTerminalCwd } from '../../lib/terminal/open-terminal-tab';
import { resolveFirstExistingFilePath, type ResolvedFilePath } from '../../lib/file-open-resolver';
import { openExternal } from '../../lib/open-external';
import { useI18n } from '../../hooks/useI18n';
import {
  getAgentSessionStateByTerminal,
  getAgentSessionStoreVersion,
  subscribeAgentSessionStore,
} from '../../lib/agent-session-store';
import {
  getFileOpenPaneOptions,
  openFileInPane,
  openFileTab,
  type FileOpenPaneOption,
  type FileOpenPlacement,
} from '../../lib/open-file-tab';

interface TerminalEditorProps {
  tab: EditorTab;
}

interface TerminalTextTarget {
  text: string;
  col: number;
  x: number;
  y: number;
  link?: TerminalTextLink;
  linkStart?: number;
  linkEnd?: number;
}

interface TerminalTextLink {
  url?: string;
  fileLink?: { path: string; line?: number; col?: number };
}

interface TerminalCursorPosition {
  x: number;
  y: number;
}

interface TerminalActionOverlayState {
  x: number;
  y: number;
  selectedText: string;
  url?: string;
  fileInput?: string;
  resolvedFile?: ResolvedFilePath | null;
  resolving?: boolean;
}

interface TerminalLinkUnderlineSegment {
  x: number;
  y: number;
  width: number;
}

interface TerminalActionOverlayPosition {
  key: string;
  left: number;
  top: number;
  maxHeight: number;
  ready: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getActionOverlayKey(overlay: TerminalActionOverlayState): string {
  return [
    overlay.x,
    overlay.y,
    overlay.selectedText,
    overlay.url ?? '',
    overlay.fileInput ?? '',
    overlay.resolvedFile?.path ?? '',
    overlay.resolving ? 'resolving' : 'resolved',
  ].join('\n');
}

function setActionOverlayPosition(
  update: React.Dispatch<React.SetStateAction<TerminalActionOverlayPosition | null>>,
  next: TerminalActionOverlayPosition,
): void {
  update((current) => {
    if (
      current?.key === next.key
      && current.left === next.left
      && current.top === next.top
      && current.maxHeight === next.maxHeight
      && current.ready === next.ready
    ) {
      return current;
    }
    return next;
  });
}

function useTerminalActionOverlayPosition(
  overlayState: TerminalActionOverlayState | null,
  overlayRef: React.RefObject<HTMLDivElement>,
): TerminalActionOverlayPosition | null {
  const [position, setPosition] = useState<TerminalActionOverlayPosition | null>(null);
  const overlayKey = overlayState ? getActionOverlayKey(overlayState) : null;

  const updatePosition = useCallback((ready: boolean) => {
    const overlay = overlayRef.current;
    if (!overlayState || !overlay || !overlayKey) {
      setPosition(null);
      return;
    }

    const gutter = 8;
    const offset = 10;
    const rect = overlay.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const overlayWidth = Math.max(1, rect.width);
    const overlayHeight = Math.max(1, rect.height);
    const spaceBelow = viewportHeight - gutter - overlayState.y - offset;
    const spaceAbove = overlayState.y - gutter - offset;
    const maxAvailableHeight = Math.max(1, Math.max(spaceBelow, spaceAbove));
    const maxHeight = Math.max(1, Math.min(480, viewportHeight - gutter * 2, maxAvailableHeight));
    const measuredHeight = Math.min(overlayHeight, maxHeight);

    const left = clamp(
      overlayState.x + offset,
      gutter,
      Math.max(gutter, viewportWidth - overlayWidth - gutter),
    );

    const shouldOpenAbove = overlayHeight > spaceBelow && spaceAbove > spaceBelow;
    const preferredTop = shouldOpenAbove
      ? overlayState.y - offset - measuredHeight
      : overlayState.y + offset;
    const top = clamp(
      preferredTop,
      gutter,
      Math.max(gutter, viewportHeight - measuredHeight - gutter),
    );

    setActionOverlayPosition(setPosition, {
      key: overlayKey,
      left,
      top,
      maxHeight,
      ready,
    });
  }, [overlayKey, overlayRef, overlayState]);

  useLayoutEffect(() => {
    if (!overlayState || !overlayKey) {
      setPosition(null);
      return undefined;
    }

    updatePosition(false);
    const frame = window.requestAnimationFrame(() => updatePosition(true));
    return () => window.cancelAnimationFrame(frame);
  }, [overlayKey, overlayState, updatePosition]);

  useEffect(() => {
    if (!overlayState || !overlayKey) return undefined;

    const handleViewportChange = (): void => updatePosition(true);
    const resizeObserver = new ResizeObserver(handleViewportChange);
    if (overlayRef.current) {
      resizeObserver.observe(overlayRef.current);
    }

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [overlayKey, overlayRef, overlayState, updatePosition]);

  return position?.key === overlayKey ? position : null;
}

function getTerminalTextLinkKey(link: TerminalTextLink | undefined): string | null {
  return link?.url ?? link?.fileLink?.path ?? null;
}

function isNearPosition(a: TerminalCursorPosition | null, b: TerminalCursorPosition | null, threshold = 4): boolean {
  if (!a || !b) return false;
  return Math.abs(a.x - b.x) <= threshold && Math.abs(a.y - b.y) <= threshold;
}

function getXtermCellSize(xt: ReturnType<TerminalEngineInstance['getRawXterm']>): { width: number; height: number } | null {
  const width = xt?.dimensions?.css?.cell?.width ?? xt?._core?._renderService?.dimensions?.actualCellWidth;
  const height = xt?.dimensions?.css?.cell?.height ?? xt?._core?._renderService?.dimensions?.actualCellHeight;
  if (!width || !height) return null;
  return { width, height };
}

export function TerminalEditor({ tab }: TerminalEditorProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const actionOverlayRefEl = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<TerminalEngineInstance | null>(null);
  const sessionId = tab.targetId;
  useSyncExternalStore(subscribeAgentSessionStore, getAgentSessionStoreVersion);
  const agentState = getAgentSessionStateByTerminal(sessionId);
  const currentProjectId = useProjectStore((s) => s.currentProject?.id ?? null);
  const cwdRef = useRef(tab.terminalCwd ?? getDefaultTerminalCwd());
  const updateTitle = useEditorStore((s) => s.updateTitle);
  const { t } = useI18n();
  const [searchVisible, setSearchVisible] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const ignoreTerminalTitleChanges = Boolean(tab.terminalLaunchConfig?.agent || agentState);
  const [actionOverlay, setActionOverlay] = useState<TerminalActionOverlayState | null>(null);
  const [linkUnderlineSegments, setLinkUnderlineSegments] = useState<TerminalLinkUnderlineSegment[]>([]);
  const actionOverlayRef = useRef<TerminalActionOverlayState | null>(null);
  const overlayHoverRef = useRef(false);
  const modifierDownRef = useRef(false);
  const hoveredLinkTargetRef = useRef<TerminalTextTarget | null>(null);
  const lastMousePositionRef = useRef<TerminalCursorPosition | null>(null);
  const pendingModifierOverlayRef = useRef<TerminalCursorPosition | null>(null);
  const getMouseBufferCellRef = useRef<(() => { x: number; y: number } | null) | null>(null);
  const readHoveredLinkTargetRef = useRef<(() => TerminalTextTarget | null) | null>(null);
  const ctrlMouseDownRef = useRef<TerminalTextTarget | null>(null);
  const suppressNextTerminalClickRef = useRef(false);
  const todoEnabled = useSyncExternalStore(
    subscribeTodoStore,
    () => isTodoEnabled(sessionId),
  );

  const handleSearchClose = useCallback(() => {
    setSearchVisible(false);
    void instanceRef.current?.focusWhenReady();
  }, []);

  useEffect(() => {
    actionOverlayRef.current = actionOverlay;
  }, [actionOverlay]);

  const clearLinkUi = useCallback(() => {
    pendingModifierOverlayRef.current = null;
    setLinkUnderlineSegments([]);
  }, []);

  const closeActionOverlay = useCallback(() => {
    overlayHoverRef.current = false;
    actionOverlayRef.current = null;
    clearLinkUi();
    setActionOverlay(null);
  }, [clearLinkUi]);

  const isPointInsideActionOverlay = useCallback((x: number, y: number): boolean => {
    const overlay = actionOverlayRefEl.current;
    if (!overlay) return false;
    const rect = overlay.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }, []);

  const finishModifierHold = useCallback((pointer?: TerminalCursorPosition | null) => {
    modifierDownRef.current = false;
    clearLinkUi();
    const isInsideOverlay = pointer ? isPointInsideActionOverlay(pointer.x, pointer.y) : overlayHoverRef.current;
    if (!isInsideOverlay) {
      closeActionOverlay();
    }
  }, [clearLinkUi, closeActionOverlay, isPointInsideActionOverlay]);

  const resolveAndSetOverlay = useCallback((overlay: TerminalActionOverlayState) => {
    setActionOverlay(overlay);
    if (!overlay.fileInput) return;

    const fileInput = overlay.fileInput;
    void resolveFirstExistingFilePath(fileInput, cwdRef.current).then((resolvedFile) => {
      setActionOverlay((current) => {
        if (!current || current.fileInput !== fileInput) return current;
        return { ...current, resolving: false, resolvedFile };
      });
    });
  }, []);

  const showOverlayForText = useCallback((text: string, x: number, y: number, col?: number) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const url = col != null
      ? extractUrl(text, col)?.url
      : extractUrls(trimmed)[0]?.url;
    if (url) {
      setActionOverlay({ x, y, selectedText: url, url });
      return;
    }

    const fileLink = col != null
      ? extractFileLink(text, col)
      : extractFileLinks(trimmed)[0];
    if (fileLink) {
      resolveAndSetOverlay({
        x,
        y,
        selectedText: fileLink.path,
        fileInput: fileLink.path,
        resolving: true,
      });
      return;
    }

    closeActionOverlay();
  }, [closeActionOverlay, resolveAndSetOverlay]);

  const showOverlayForTarget = useCallback((target: TerminalTextTarget, x: number, y: number) => {
    const link = target.link ?? {
      url: extractUrl(target.text, target.col)?.url,
      fileLink: extractFileLink(target.text, target.col) ?? undefined,
    };
    if (link.url) {
      setActionOverlay({ x, y, selectedText: link.url, url: link.url });
      return;
    }
    if (link.fileLink) {
      resolveAndSetOverlay({
        x,
        y,
        selectedText: link.fileLink.path,
        fileInput: link.fileLink.path,
        resolving: true,
      });
      return;
    }
    closeActionOverlay();
  }, [closeActionOverlay, resolveAndSetOverlay]);

  const openOverlayFile = useCallback((placement: FileOpenPlacement) => {
    const file = actionOverlay?.resolvedFile;
    if (!file) return;
    void openFileTab({
      filePath: file.path,
      sourceTabId: tab.id,
      placement,
    });
    closeActionOverlay();
  }, [actionOverlay?.resolvedFile, closeActionOverlay, tab.id]);

  const openOverlayFileInPane = useCallback((pane: FileOpenPaneOption) => {
    const file = actionOverlay?.resolvedFile;
    if (!file) return;
    void openFileInPane(file.path, pane.activeTabId, pane.mode);
    closeActionOverlay();
  }, [actionOverlay?.resolvedFile, closeActionOverlay]);

  const getTextTargetLink = useCallback((target: TerminalTextTarget, exactOnly = true): TerminalTextLink => {
    if (target.link) return target.link;

    const url = extractUrl(target.text, target.col)?.url;
    const fileLink = extractFileLink(target.text, target.col);
    if (url || fileLink) return { url, fileLink: fileLink ?? undefined };
    if (exactOnly) return {};

    // Terminal click coordinates can be off by a few columns because xterm
    // wraps and pads buffer lines. Fall back to the first link on this
    // logical row so Ctrl+click does not leak to the terminal's built-in URL opener.
    const fallbackUrl = extractUrls(target.text)[0]?.url;
    if (fallbackUrl) return { url: fallbackUrl };
    const fallbackFile = extractFileLinks(target.text)[0];
    return fallbackFile ? { fileLink: fallbackFile } : {};
  }, []);

  const showPendingModifierOverlay = useCallback((): boolean => {
    const pendingOverlay = pendingModifierOverlayRef.current;
    if (!modifierDownRef.current || !pendingOverlay) return false;
    if (!isNearPosition(pendingOverlay, lastMousePositionRef.current)) return false;

    const target = hoveredLinkTargetRef.current;
    const link = target ? getTextTargetLink(target) : {};
    if (!target || (!link.url && !link.fileLink)) return false;

    pendingModifierOverlayRef.current = null;
    showOverlayForTarget(target, pendingOverlay.x, pendingOverlay.y);
    return true;
  }, [getTextTargetLink, showOverlayForTarget]);

  const updateHoveredLinkFromProviderRanges = useCallback((): TerminalTextTarget | null => {
    const directTarget = readHoveredLinkTargetRef.current?.();
    if (directTarget || readHoveredLinkTargetRef.current) {
      return directTarget ?? null;
    }
    hoveredLinkTargetRef.current = null;
    return null;
  }, []);

  useEffect(() => {
    cwdRef.current = tab.terminalCwd ?? getDefaultTerminalCwd();
  }, [sessionId, tab.terminalCwd, currentProjectId]);

  useEffect(() => {
    let disposed = false;
    const container = containerRef.current;
    if (!container || !sessionId) return;

    let cwd = cwdRef.current;
    let titleListener: { dispose(): void } | null = null;
    const terminalEngine = getTerminalEngine();

    const attach = async (): Promise<void> => {
      setAttachError(null);

      if (!cwd) {
        const sessionResult = await window.electron.terminal.getSession(sessionId);
        if (disposed) return;
        if (sessionResult.success && sessionResult.data?.cwd) {
          cwd = sessionResult.data.cwd;
          cwdRef.current = cwd;
          console.log(`[TerminalEditor] recovered cwd from session sessionId=${sessionId}, cwd=${cwd}`);
        } else {
          cwd = getDefaultTerminalCwd();
          cwdRef.current = cwd;
          console.log(`[TerminalEditor] fallback cwd sessionId=${sessionId}, cwd=${cwd ?? 'missing'}`);
        }
      }

      if (!cwd) {
        console.error(`[TerminalEditor] missing cwd sessionId=${sessionId}, tabId=${tab.id}`);
        setAttachError('Terminal launch context is missing.');
        return;
      }

      let instance: TerminalEngineInstance;
      try {
        instance = await terminalEngine.getOrCreateTerminal(sessionId, cwd, tab.title, tab.terminalLaunchConfig);
      } catch (error) {
        if (!disposed) {
          const message = error instanceof Error ? error.message : 'Failed to start terminal.';
          console.error(`[TerminalEditor] attach failed sessionId=${sessionId}: ${message}`);
          setAttachError(message);
        }
        return;
      }

      instanceRef.current = instance;
      if (disposed) {
        instance.detachFromElement();
        return;
      }

      instance.attachToElement(container);
      instance.setVisible(true);

      if (!ignoreTerminalTitleChanges) {
        titleListener = instance.onTitleChanged(() => {
          console.log('[TerminalEditor] terminalTitleChanged', {
            tabId: tab.id,
            sessionId,
            title: instance.title,
          });
          updateTitle(tab.id, instance.title);
        });
        console.log('[TerminalEditor] initialTerminalTitle', {
          tabId: tab.id,
          sessionId,
          title: instance.title,
        });
        updateTitle(tab.id, instance.title);
      }

      void instance.focusWhenReady();

      const xt = instance.getRawXterm();
      if (xt) {
        const getLogicalLine = (bufferLineNumber: number): { text: string; startLineNumber: number } => {
          const startBufferIndex = bufferLineNumber - 1;
          let logicalStartIndex = startBufferIndex;
          while (logicalStartIndex > 0 && xt.buffer.active.getLine(logicalStartIndex)?.isWrapped) {
            logicalStartIndex--;
          }

          let text = '';
          for (let index = logicalStartIndex; index < xt.buffer.active.length; index++) {
            const line = xt.buffer.active.getLine(index);
            if (!line) break;
            if (index > logicalStartIndex && !line.isWrapped) break;
            text += line.translateToString(true);
          }

          return { text, startLineNumber: logicalStartIndex + 1 };
        };

        const getMouseBufferCell = (): { x: number; y: number } | null => {
          const mouse = lastMousePositionRef.current;
          const screen = xt.element?.querySelector<HTMLElement>('.xterm-screen');
          const cellSize = getXtermCellSize(xt);
          if (!mouse || !screen || !cellSize) return null;

          const rect = screen.getBoundingClientRect();
          const viewportX = Math.floor((mouse.x - rect.left) / cellSize.width) + 1;
          const viewportY = Math.floor((mouse.y - rect.top) / cellSize.height);
          if (viewportX < 1 || viewportY < 0) return null;
          return {
            x: viewportX,
            y: xt.buffer.active.viewportY + viewportY + 1,
          };
        };
        getMouseBufferCellRef.current = getMouseBufferCell;

        const setUnderlineForLogicalRange = (
          start: number,
          endExclusive: number,
          startLineNumber: number,
        ): void => {
          if (!modifierDownRef.current) return;
          const screen = xt.element?.querySelector<HTMLElement>('.xterm-screen');
          const cellSize = getXtermCellSize(xt);
          const cols = xt.cols ?? 120;
          if (!screen || !cellSize) return;

          const screenRect = screen.getBoundingClientRect();
          const endInclusive = Math.max(start, endExclusive - 1);
          const startRow = Math.floor(start / cols);
          const endRow = Math.floor(endInclusive / cols);
          const viewportStartY = xt.buffer.active.viewportY + 1;
          const segments: TerminalLinkUnderlineSegment[] = [];

          for (let row = startRow; row <= endRow; row++) {
            const bufferLineNumber = startLineNumber + row;
            const viewportRow = bufferLineNumber - viewportStartY;
            if (viewportRow < 0) continue;
            const startCol = row === startRow ? start % cols : 0;
            const endColInclusive = row === endRow ? endInclusive % cols : cols - 1;
            if (endColInclusive < startCol) continue;

            segments.push({
              x: screenRect.left + startCol * cellSize.width,
              y: screenRect.top + (viewportRow + 1) * cellSize.height - 2,
              width: (endColInclusive - startCol + 1) * cellSize.width,
            });
          }

          setLinkUnderlineSegments(segments);
        };

        const readHoveredLinkTarget = (): TerminalTextTarget | null => {
          const mouseCell = getMouseBufferCell();
          const mouse = lastMousePositionRef.current;
          const cols = xt.cols ?? 120;
          if (!mouseCell || !mouse) {
            hoveredLinkTargetRef.current = null;
            return null;
          }

          const { text, startLineNumber } = getLogicalLine(mouseCell.y);
          const col = ((mouseCell.y - startLineNumber) * cols) + mouseCell.x - 1;
          const urlCandidate = extractUrls(text).find((link) => col >= link.start && col <= link.end);
          const fileCandidate = extractFileLinks(text).find((link) => col >= link.start && col <= link.end);
          const linkStart = urlCandidate?.start ?? fileCandidate?.start;
          const linkEnd = urlCandidate?.end ?? fileCandidate?.end;
          const link: TerminalTextLink = {
            url: urlCandidate?.url,
            fileLink: fileCandidate
              ? { path: fileCandidate.path, line: fileCandidate.line, col: fileCandidate.col }
              : undefined,
          };

          if (!link.url && !link.fileLink || linkStart == null || linkEnd == null) {
            hoveredLinkTargetRef.current = null;
            setLinkUnderlineSegments([]);
            return null;
          }

          const target: TerminalTextTarget = {
            text,
            col,
            x: mouse.x,
            y: mouse.y,
            link,
            linkStart,
            linkEnd,
          };
          hoveredLinkTargetRef.current = target;
          setUnderlineForLogicalRange(linkStart, linkEnd, startLineNumber);
          return target;
        };
        readHoveredLinkTargetRef.current = readHoveredLinkTarget;

      }
    };

    void attach();

    const showOverlayForHoveredLink = (e: KeyboardEvent): boolean => {
      if ((e.key === 'Control' || e.key === 'Meta') && !e.repeat) {
        modifierDownRef.current = true;
        pendingModifierOverlayRef.current = lastMousePositionRef.current;
        const target = updateHoveredLinkFromProviderRanges();
        if (!target) {
          closeActionOverlay();
        } else {
          const link = getTextTargetLink(target);
          if (link.url || link.fileLink) {
            const pos = lastMousePositionRef.current;
            pendingModifierOverlayRef.current = null;
            showOverlayForTarget(target, pos?.x ?? target.x, pos?.y ?? target.y);
          } else {
            closeActionOverlay();
          }
        }
        return true;
      }
      return false;
    };

    const handleWindowModifierKeyDown = (e: KeyboardEvent): void => {
      showOverlayForHoveredLink(e);
    };

    const handleKeyDown = (e: KeyboardEvent): void => {
      const instance = instanceRef.current;
      if (!instance) return;

      // Shift+PgUp/PgDown: page scroll
      if (e.shiftKey && !e.ctrlKey && !e.altKey) {
        if (e.key === 'PageUp') {
          e.preventDefault();
          e.stopPropagation();
          logShortcut('shortcut.terminal.pageScrollUp');
          instance.scrollUpPage();
          return;
        }
        if (e.key === 'PageDown') {
          e.preventDefault();
          e.stopPropagation();
          logShortcut('shortcut.terminal.pageScrollDown');
          instance.scrollDownPage();
          return;
        }
      }

      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;

      // Ctrl+C: copy selection (or SIGINT if no selection)
      if (e.key === 'c' && instance.hasSelection()) {
        e.preventDefault();
        e.stopPropagation();
        logShortcut('shortcut.terminal.copySelection');
        instance.copySelection();
        return;
      }

      // Ctrl+V: paste from clipboard
      if (e.key === 'v') {
        e.preventDefault();
        e.stopPropagation();
        logShortcut('shortcut.terminal.paste');
        void navigator.clipboard.readText().then((text) => {
          if (text) void instance.sendText(text, false, true);
        });
        return;
      }

      // Ctrl+F: open search
      if (e.key === 'f') {
        e.preventDefault();
        e.stopPropagation();
        logShortcut('shortcut.terminal.openSearch');
        setSearchVisible(true);
        return;
      }

      // Ctrl+=/+: increase font size
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        e.stopPropagation();
        logShortcut('shortcut.terminal.fontSizeUp');
        adjustTerminalFontSize(1);
        return;
      }

      // Ctrl+-: decrease font size
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        e.stopPropagation();
        logShortcut('shortcut.terminal.fontSizeDown');
        adjustTerminalFontSize(-1);
        return;
      }

      // Ctrl+0: reset font size
      if (e.key === '0') {
        e.preventDefault();
        e.stopPropagation();
        logShortcut('shortcut.terminal.fontSizeReset');
        resetTerminalFontSize();
        return;
      }
    };

    const stopTerminalLinkEvent = (e: MouseEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    const openTerminalLinkTarget = (target: TerminalTextTarget, link: TerminalTextLink): void => {
      closeActionOverlay();

      if (link.url) {
        void openExternal(link.url);
        return;
      }

      if (link.fileLink) {
        const fileInput = link.fileLink.path;
        void resolveFirstExistingFilePath(fileInput, cwdRef.current).then((resolvedFile) => {
          if (!resolvedFile) {
            resolveAndSetOverlay({
              x: target.x,
              y: target.y,
              selectedText: fileInput,
              fileInput,
              resolving: true,
            });
            return;
          }
          void openFileTab({
            filePath: resolvedFile.path,
            sourceTabId: tab.id,
            placement: 'smart',
          });
        });
      }
    };

    const handleCtrlMouseDown = (e: MouseEvent): void => {
      ctrlMouseDownRef.current = null;
      if (!e.ctrlKey && !e.metaKey) return;
      const target = updateHoveredLinkFromProviderRanges();
      if (!target) return;
      const link = getTextTargetLink(target);
      if (!link.url && !link.fileLink) return;
      ctrlMouseDownRef.current = target;
      stopTerminalLinkEvent(e);
    };

    const handleCtrlClick = (e: MouseEvent): void => {
      if (suppressNextTerminalClickRef.current) {
        suppressNextTerminalClickRef.current = false;
        stopTerminalLinkEvent(e);
        return;
      }

      if (!e.ctrlKey && !e.metaKey) return;
      const target = updateHoveredLinkFromProviderRanges();
      if (!target) return;
      const link = getTextTargetLink(target);
      if (!link.url && !link.fileLink) return;
      stopTerminalLinkEvent(e);
    };

    const handleMouseMove = (e: MouseEvent): void => {
      lastMousePositionRef.current = { x: e.clientX, y: e.clientY };
      if (modifierDownRef.current && !e.ctrlKey && !e.metaKey) {
        finishModifierHold(lastMousePositionRef.current);
      }
      if (!isNearPosition(pendingModifierOverlayRef.current, lastMousePositionRef.current)) {
        pendingModifierOverlayRef.current = null;
      }
      const target = updateHoveredLinkFromProviderRanges();
      if (e.ctrlKey || e.metaKey) {
        modifierDownRef.current = true;
        if (target) {
          const targetKey = getTerminalTextLinkKey(target.link);
          if (targetKey && actionOverlayRef.current?.selectedText !== targetKey) {
            pendingModifierOverlayRef.current = null;
            showOverlayForTarget(target, e.clientX, e.clientY);
          }
        } else if (!actionOverlayRef.current) {
          pendingModifierOverlayRef.current = lastMousePositionRef.current;
        } else if (!overlayHoverRef.current) {
          closeActionOverlay();
        }
        showPendingModifierOverlay();
        return;
      }
      showPendingModifierOverlay();
      clearLinkUi();
    };

    const handleMouseUp = (e: MouseEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return;

      const target = updateHoveredLinkFromProviderRanges();
      if (target) {
        const link = getTextTargetLink(target);
        if (link.url || link.fileLink) {
          stopTerminalLinkEvent(e);
          suppressNextTerminalClickRef.current = true;

          const downTarget = ctrlMouseDownRef.current;
          const isClick =
            !!downTarget
            && Math.abs(downTarget.x - target.x) < 5
            && Math.abs(downTarget.y - target.y) < 5;
          ctrlMouseDownRef.current = null;

          if (isClick) {
            openTerminalLinkTarget(target, link);
          }
          return;
        }
      }

      ctrlMouseDownRef.current = null;
      const selectedText = instanceRef.current?.getSelection().trim() ?? '';
      if (!selectedText) return;
      const rect = container.getBoundingClientRect();
      showOverlayForText(selectedText, rect.left + 24, rect.top + 24);
    };

    const handleKeyUp = (e: KeyboardEvent): void => {
      if (e.key === 'Control' || e.key === 'Meta') {
        finishModifierHold(lastMousePositionRef.current);
      }
    };

    const handleWindowBlur = (): void => {
      finishModifierHold(null);
    };

    container.addEventListener('keydown', handleKeyDown, true);
    container.addEventListener('mousedown', handleCtrlMouseDown, true);
    container.addEventListener('click', handleCtrlClick, true);
    container.addEventListener('mousemove', handleMouseMove, true);
    container.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('keydown', handleWindowModifierKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      disposed = true;
      container.removeEventListener('keydown', handleKeyDown, true);
      container.removeEventListener('mousedown', handleCtrlMouseDown, true);
      container.removeEventListener('click', handleCtrlClick, true);
      container.removeEventListener('mousemove', handleMouseMove, true);
      container.removeEventListener('mouseup', handleMouseUp, true);
      document.removeEventListener('keydown', handleWindowModifierKeyDown, true);
      document.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleWindowBlur);
      titleListener?.dispose();
      getMouseBufferCellRef.current = null;
      readHoveredLinkTargetRef.current = null;
      pendingModifierOverlayRef.current = null;
      instanceRef.current?.detachFromElement();
      instanceRef.current?.setVisible(false);
      instanceRef.current = null;
    };
  }, [
    sessionId,
    tab.id,
    tab.title,
    updateTitle,
    currentProjectId,
    ignoreTerminalTitleChanges,
    showOverlayForText,
    showOverlayForTarget,
    resolveAndSetOverlay,
    getTextTargetLink,
    updateHoveredLinkFromProviderRanges,
    showPendingModifierOverlay,
    clearLinkUi,
    closeActionOverlay,
    finishModifierHold,
  ]);

  const paneOptions = actionOverlay?.resolvedFile ? getFileOpenPaneOptions(tab.id) : [];
  const actionOverlayPosition = useTerminalActionOverlayPosition(actionOverlay, actionOverlayRefEl);
  const actionOverlayReady = actionOverlayPosition?.ready ?? false;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-[var(--surface-editor)] p-2">
      <div ref={containerRef} className="terminal-editor flex-1 min-h-0 overflow-hidden bg-[var(--surface-editor)]" />
      {attachError && (
        <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-md border border-default bg-surface-panel/95 px-4 text-sm text-status-error">
          {attachError}
        </div>
      )}
      {searchVisible && (
        <TerminalSearchBar instanceRef={instanceRef} onClose={handleSearchClose} />
      )}
      {todoEnabled && <TerminalTodoPanel sessionId={sessionId} autoShowSeconds={10} />}
      {linkUnderlineSegments.map((segment, index) => (
        <div
          key={`${Math.round(segment.x)}:${Math.round(segment.y)}:${index}`}
          className="pointer-events-none fixed z-[10040] h-px bg-accent"
          style={{
            left: segment.x,
            top: segment.y,
            width: segment.width,
          }}
        />
      ))}
      {actionOverlay && (
        <div
          ref={actionOverlayRefEl}
          className="fixed z-[10050] w-[min(560px,calc(100vw-24px))] overflow-y-auto rounded-md border border-default bg-surface-modal py-1 text-xs text-default shadow-lg"
          style={{
            left: actionOverlayPosition?.left ?? actionOverlay.x + 10,
            top: actionOverlayPosition?.top ?? actionOverlay.y + 10,
            maxHeight: actionOverlayPosition?.maxHeight,
            visibility: actionOverlayReady ? 'visible' : 'hidden',
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onMouseEnter={() => {
            overlayHoverRef.current = true;
          }}
          onMouseLeave={() => {
            overlayHoverRef.current = false;
            closeActionOverlay();
          }}
        >
          <div className="border-b border-subtle px-3 py-2 font-mono text-[11px] text-muted" title={actionOverlay.selectedText}>
            <div className="max-h-24 overflow-auto break-all leading-relaxed">
              {actionOverlay.selectedText}
            </div>
          </div>
          <div className="py-1">
            {actionOverlay.fileInput && actionOverlay.resolvedFile && (
              <>
                <TerminalOverlayItem shortcut="Click" onClick={() => openOverlayFile('smart')}>
                  {t('terminal.openFileAction' as TranslationKey)}
                </TerminalOverlayItem>
                <TerminalOverlayItem shortcut="Ctrl+Alt+Right" onClick={() => openOverlayFile('right')}>
                  {t('terminal.openSplitRightAction' as TranslationKey)}
                </TerminalOverlayItem>
                <TerminalOverlayItem shortcut="Ctrl+Alt+Down" onClick={() => openOverlayFile('below')}>
                  {t('terminal.openSplitBelowAction' as TranslationKey)}
                </TerminalOverlayItem>
                {paneOptions.length > 0 && <TerminalOverlaySeparator />}
                {paneOptions.map((pane) => (
                  <TerminalOverlayItem key={pane.id} onClick={() => openOverlayFileInPane(pane)}>
                    {t('terminal.openInPaneAction' as TranslationKey, { pane: pane.label })}
                  </TerminalOverlayItem>
                ))}
                <TerminalOverlaySeparator />
              </>
            )}
            {actionOverlay.url && (
              <>
                <TerminalOverlayItem shortcut="Click" onClick={() => {
                  void openExternal(actionOverlay.url!);
                  closeActionOverlay();
                }}>
                  {t('terminal.openUrlAction' as TranslationKey)}
                </TerminalOverlayItem>
                <TerminalOverlaySeparator />
              </>
            )}
            <TerminalOverlayItem onClick={() => {
              void navigator.clipboard.writeText(actionOverlay.selectedText);
              closeActionOverlay();
            }}>
              {t('terminal.copySelectionAction' as TranslationKey)}
            </TerminalOverlayItem>
            {actionOverlay.resolvedFile && (
              <TerminalOverlayItem onClick={() => {
                void navigator.clipboard.writeText(actionOverlay.resolvedFile!.path);
                closeActionOverlay();
              }}>
                {t('terminal.copyResolvedPathAction' as TranslationKey)}
              </TerminalOverlayItem>
            )}
          </div>
          {actionOverlay.fileInput && actionOverlay.resolving && (
            <div className="border-t border-subtle px-3 py-2 text-[11px] text-muted">{t('terminal.resolvingFile' as TranslationKey)}</div>
          )}
          {actionOverlay.fileInput && !actionOverlay.resolving && !actionOverlay.resolvedFile && (
            <div className="border-t border-subtle px-3 py-2 text-[11px] text-status-error">{t('terminal.fileNotFoundNothingOpened' as TranslationKey)}</div>
          )}
        </div>
      )}
    </div>
  );
}

function TerminalOverlaySeparator(): JSX.Element {
  return <div className="my-1 border-t border-subtle" />;
}

function TerminalOverlayItem({
  children,
  shortcut,
  muted,
  onClick,
}: {
  children: React.ReactNode;
  shortcut?: string;
  muted?: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-surface-hover ${
        muted ? 'text-muted' : 'text-default'
      }`}
      onClick={onClick}
    >
      <span className="min-w-0 truncate">{children}</span>
      {shortcut && <span className="shrink-0 font-mono text-[10px] text-muted">{shortcut}</span>}
    </button>
  );
}
