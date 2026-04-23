import React, { useEffect, useRef } from 'react';
import type { EditorTab } from '@netior/shared/types';
import { ConceptEditor } from './ConceptEditor';
import { FileEditor } from './FileEditor';
import { ArchetypeEditor } from './ArchetypeEditor';
import { TerminalEditor } from './TerminalEditor';
import { RelationTypeEditor } from './RelationTypeEditor';
import { EdgeEditor } from './EdgeEditor';
import { NetworkEditor } from './NetworkEditor';
import { ProjectEditor } from './ProjectEditor';
import { NarreEditor } from './NarreEditor';
import { AgentEditor } from './AgentEditor';
import { FileMetadataEditor } from './FileMetadataEditor';
import { ContextEditor } from './ContextEditor';
import { useEditorStore, MAIN_HOST_ID } from '../../stores/editor-store';
import { focusHyperTerminalSurface } from '../../lib/terminal/hyper-fork/term-registry';

interface EditorContentProps {
  tab: EditorTab;
}

/**
 * Content router: resolves tab.type to the appropriate editor component.
 * This is the single entry point for all editor content rendering.
 * Shell components (FloatWindow, side pane, full mode, detached) render this.
 */
export function EditorContent({ tab }: EditorContentProps): JSX.Element {
  const isActive = useEditorStore((s) => {
    if (tab.hostId === MAIN_HOST_ID) return s.activeTabId === tab.id;
    const host = s.hosts[tab.hostId];
    return host?.activeTabId === tab.id;
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus the editor content when this tab becomes globally active.
  // Terminals handle their own focus via focusWhenReady() on mount,
  // but need explicit focus on pane switch (already mounted).
  useEffect(() => {
    if (!isActive || !containerRef.current) return;
    const el = containerRef.current;
    // Defer to let the editor render first
    const timer = requestAnimationFrame(() => {
      if (!el || el.contains(document.activeElement)) return;
      if (tab.type === 'terminal') {
        focusHyperTerminalSurface(tab.targetId);
        return;
      }
      // CodeMirror (markdown / code editors)
      const cmContent = el.querySelector<HTMLElement>('.cm-content');
      if (cmContent) { cmContent.focus(); return; }
      // Fallback: first focusable element
      const focusable = el.querySelector<HTMLElement>('input, textarea, [contenteditable], [tabindex]');
      if (focusable) { focusable.focus(); }
    });
    return () => cancelAnimationFrame(timer);
  }, [isActive, tab.targetId, tab.type]);
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
    case 'edge':
      content = <EdgeEditor tab={tab} />; break;
    case 'network':
      content = <NetworkEditor tab={tab} />; break;
    case 'project':
      content = <ProjectEditor tab={tab} />; break;
    case 'narre':
      content = <NarreEditor tab={tab} />; break;
    case 'agent':
      content = <AgentEditor tab={tab} />; break;
    case 'fileMetadata':
      content = <FileMetadataEditor tab={tab} />; break;
    case 'context':
      content = <ContextEditor tab={tab} />; break;
    default:
      content = (
        <div className="flex h-full items-center justify-center text-xs text-muted">
          Unknown editor type
        </div>
      );
  }

  return <div ref={containerRef} className="h-full min-h-0 w-full min-w-0 bg-[var(--surface-editor)]">{content}</div>;
}
