import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface ImageViewerProps {
  absolutePath: string;
}

export function ImageViewer({ absolutePath }: ImageViewerProps): JSX.Element {
  const fileUrl = `file:///${absolutePath.replace(/\\/g, '/')}`;
  const fileName = absolutePath.split(/[/\\]/).pop() ?? '';

  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const resetView = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((s) => Math.max(0.1, Math.min(10, s + delta * s)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
  }, [translate]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      setTranslate({
        x: dragStart.current.tx + (e.clientX - dragStart.current.x),
        y: dragStart.current.ty + (e.clientY - dragStart.current.y),
      });
    };
    const handleUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging]);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Image canvas */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-hidden bg-surface-base ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      >
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          <img
            src={fileUrl}
            alt=""
            draggable={false}
            onLoad={handleImageLoad}
            className="max-h-full max-w-full select-none"
            style={{ imageRendering: scale > 2 ? 'pixelated' : 'auto' }}
          />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex shrink-0 items-center justify-between border-t border-subtle bg-surface-panel px-2 py-1">
        <span className="text-xs text-muted truncate">{fileName}</span>

        <div className="flex items-center gap-1">
          {dimensions.w > 0 && (
            <span className="text-xs text-muted mr-2">{dimensions.w} × {dimensions.h}</span>
          )}
          <button
            className="rounded p-1 text-muted hover:bg-surface-hover hover:text-default"
            onClick={() => setScale((s) => Math.max(0.1, s - 0.25))}
          >
            <ZoomOut size={12} />
          </button>
          <span className="text-xs text-secondary w-10 text-center">{Math.round(scale * 100)}%</span>
          <button
            className="rounded p-1 text-muted hover:bg-surface-hover hover:text-default"
            onClick={() => setScale((s) => Math.min(10, s + 0.25))}
          >
            <ZoomIn size={12} />
          </button>
          <button
            className="rounded p-1 text-muted hover:bg-surface-hover hover:text-default"
            onClick={resetView}
          >
            <Maximize size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
