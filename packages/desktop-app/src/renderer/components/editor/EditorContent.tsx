import React, { useEffect, useRef } from 'react';
import type { EditorTab } from '@netior/shared/types';
import { ConceptEditor } from './ConceptEditor';
import { FileEditor } from './FileEditor';
import { ArchetypeEditor } from './ArchetypeEditor';
import { TerminalEditor } from './TerminalEditor';
import { RelationTypeEditor } from './RelationTypeEditor';
import { CanvasTypeEditor } from './CanvasTypeEditor';
import { EdgeEditor } from './EdgeEditor';
import { CanvasEditor } from './CanvasEditor';
import { NarreEditor } from './NarreEditor';
import { FileMetadataEditor } from './FileMetadataEditor';
import { useEditorStore } from '../../stores/editor-store';

interface EditorContentProps {
  tab: EditorTab;
}

/**
 * Content router: resolves tab.type to the appropriate editor component.
 * This is the single entry point for all editor content rendering.
 * Shell components (FloatWindow, side pane, full mode) render this.
 */
export function EditorContent({ tab }: EditorContentProps): JSX.Element {
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const containerRef = useRef<HTMLDivElement>(null);
  const isActive = activeTabId === tab.id;

  // Focus the editor content when this tab becomes globally active.
  // Terminals handle their own focus via focusWhenReady() on mount,
  // but need explicit focus on pane switch (already mounted).
  useEffect(() => {
    if (!isActive || !containerRef.current) return;
    const el = containerRef.current;
    // Defer to let the editor render first
    const timer = requestAnimationFrame(() => {
      if (!el || el.contains(document.activeElement)) return;
      // Terminal: xterm textarea (present only when already mounted)
      const xtermTextarea = el.querySelector<HTMLTextAreaElement>('.xterm-helper-textarea');
      if (xtermTextarea) { xtermTextarea.focus(); return; }
      // CodeMirror (markdown / code editors)
      const cmContent = el.querySelector<HTMLElement>('.cm-content');
      if (cmContent) { cmContent.focus(); return; }
      // Fallback: first focusable element
      const focusable = el.querySelector<HTMLElement>('input, textarea, [contenteditable], [tabindex]');
      if (focusable) { focusable.focus(); }
    });
    return () => cancelAnimationFrame(timer);
  }, [isActive]);
  let content: JSX.Element;
  switch (tab.type) {
    case 'concept':
      content = <ConceptEditor tab={tab} />; break;
    case 'file':
      content = <FileEditor tab={tab} />; break;
    case 'archetype':
      content = <ArchetypeEditor tab={tab} />; break;
    case 'terminal':
      content = <TerminalEditor tab={tab} />; break;
    case 'relationType':
      content = <RelationTypeEditor tab={tab} />; break;
    case 'canvasType':
      content = <CanvasTypeEditor tab={tab} />; break;
    case 'edge':
      content = <EdgeEditor tab={tab} />; break;
    case 'canvas':
      content = <CanvasEditor tab={tab} />; break;
    case 'narre':
      content = <NarreEditor tab={tab} />; break;
    case 'fileMetadata':
      content = <FileMetadataEditor tab={tab} />; break;
    default:
      content = (
        <div className="flex h-full items-center justify-center text-xs text-muted">
          Unknown editor type
        </div>
      );
  }

  return <div ref={containerRef} className="h-full w-full">{content}</div>;
}
