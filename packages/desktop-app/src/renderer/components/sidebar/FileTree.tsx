import React, { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderPlus } from 'lucide-react';
import type { FileTreeNode } from '@moc/shared/types';
import { Tooltip } from '../ui/Tooltip';

interface FileTreeProps {
  nodes: FileTreeNode[];
  onFileClick: (relativePath: string) => void;
  onAddDirectory?: () => void;
}

function FileTreeItem({
  node,
  depth,
  onFileClick,
}: {
  node: FileTreeNode;
  depth: number;
  onFileClick: (path: string) => void;
}): JSX.Element {
  const [expanded, setExpanded] = useState(depth < 1);

  if (node.type === 'directory') {
    return (
      <>
        <div
          className="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-xs text-secondary hover:bg-surface-hover hover:text-default"
          style={{ paddingLeft: depth * 12 + 4 }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Folder size={12} className="text-accent-muted" />
          <span className="truncate">{node.name}</span>
        </div>
        {expanded && node.children?.map((child) => (
          <FileTreeItem key={child.path} node={child} depth={depth + 1} onFileClick={onFileClick} />
        ))}
      </>
    );
  }

  return (
    <div
      className="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-xs text-muted hover:bg-surface-hover hover:text-default"
      style={{ paddingLeft: depth * 12 + 20 }}
      onClick={() => onFileClick(node.path)}
    >
      <File size={12} />
      <span className="truncate">{node.name}</span>
    </div>
  );
}

export function FileTree({ nodes, onFileClick, onAddDirectory }: FileTreeProps): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 px-1">
      {nodes.map((node) => (
        <FileTreeItem key={node.path} node={node} depth={0} onFileClick={onFileClick} />
      ))}
    </div>
  );
}
