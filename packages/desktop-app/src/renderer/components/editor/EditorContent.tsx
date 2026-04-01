import React from 'react';
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

interface EditorContentProps {
  tab: EditorTab;
}

/**
 * Content router: resolves tab.type to the appropriate editor component.
 * This is the single entry point for all editor content rendering.
 * Shell components (FloatWindow, side pane, full mode) render this.
 */
export function EditorContent({ tab }: EditorContentProps): JSX.Element {
  switch (tab.type) {
    case 'concept':
      return <ConceptEditor tab={tab} />;
    case 'file':
      return <FileEditor tab={tab} />;
    case 'archetype':
      return <ArchetypeEditor tab={tab} />;
    case 'terminal':
      return <TerminalEditor tab={tab} />;
    case 'relationType':
      return <RelationTypeEditor tab={tab} />;
    case 'canvasType':
      return <CanvasTypeEditor tab={tab} />;
    case 'edge':
      return <EdgeEditor tab={tab} />;
    case 'canvas':
      return <CanvasEditor tab={tab} />;
    case 'narre':
      return <NarreEditor tab={tab} />;
    default:
      return (
        <div className="flex h-full items-center justify-center text-xs text-muted">
          Unknown editor type
        </div>
      );
  }
}
