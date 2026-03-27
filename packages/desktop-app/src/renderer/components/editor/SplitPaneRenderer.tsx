import React, { useCallback, useRef } from 'react';
import type { SplitNode, SplitLeaf } from '@moc/shared/types';

interface SplitPaneRendererProps {
  node: SplitNode;
  mode: 'side' | 'full';
  path?: number[];
  renderLeaf: (leaf: SplitLeaf) => React.ReactNode;
  onRatioChange: (mode: 'side' | 'full', path: number[], ratio: number) => void;
}

export function SplitPaneRenderer({
  node,
  mode,
  path = [],
  renderLeaf,
  onRatioChange,
}: SplitPaneRendererProps): JSX.Element {
  if (node.type === 'leaf') {
    return <div className="h-full w-full overflow-hidden">{renderLeaf(node)}</div>;
  }

  const isHorizontal = node.direction === 'horizontal';

  return (
    <div className={`flex h-full w-full ${isHorizontal ? 'flex-row' : 'flex-col'}`}>
      <div
        className="overflow-hidden"
        style={isHorizontal ? { width: `${node.ratio * 100}%` } : { height: `${node.ratio * 100}%` }}
      >
        <SplitPaneRenderer
          node={node.children[0]}
          mode={mode}
          path={[...path, 0]}
          renderLeaf={renderLeaf}
          onRatioChange={onRatioChange}
        />
      </div>

      <SplitHandle
        direction={node.direction}
        mode={mode}
        path={path}
        onRatioChange={onRatioChange}
      />

      <div
        className="overflow-hidden"
        style={isHorizontal ? { width: `${(1 - node.ratio) * 100}%` } : { height: `${(1 - node.ratio) * 100}%` }}
      >
        <SplitPaneRenderer
          node={node.children[1]}
          mode={mode}
          path={[...path, 1]}
          renderLeaf={renderLeaf}
          onRatioChange={onRatioChange}
        />
      </div>
    </div>
  );
}

interface SplitHandleProps {
  direction: 'horizontal' | 'vertical';
  mode: 'side' | 'full';
  path: number[];
  onRatioChange: (mode: 'side' | 'full', path: number[], ratio: number) => void;
}

function SplitHandle({ direction, mode, path, onRatioChange }: SplitHandleProps): JSX.Element {
  const draggingRef = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;

      const parent = (e.target as HTMLElement).parentElement;
      if (!parent) return;

      const handleMove = (ev: MouseEvent) => {
        if (!draggingRef.current || !parent) return;
        const rect = parent.getBoundingClientRect();
        const ratio = direction === 'horizontal'
          ? (ev.clientX - rect.left) / rect.width
          : (ev.clientY - rect.top) / rect.height;
        onRatioChange(mode, path, ratio);
      };

      const handleUp = () => {
        draggingRef.current = false;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [direction, mode, path, onRatioChange],
  );

  return (
    <div
      className={`shrink-0 bg-border-default hover:bg-accent transition-colors ${
        direction === 'horizontal' ? 'cursor-col-resize border-x border-border-strong' : 'cursor-row-resize border-y border-border-strong'
      }`}
      style={direction === 'horizontal' ? { width: 6 } : { height: 6 }}
      onMouseDown={handleMouseDown}
    />
  );
}
