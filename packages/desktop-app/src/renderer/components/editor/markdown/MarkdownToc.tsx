import React, { useCallback, useState, useEffect, useRef } from 'react';

export interface TocHeading {
  lineNumber: number;
  level: number;
  text: string;
}

interface MarkdownTocProps {
  headings: TocHeading[];
  onNavigate: (lineNumber: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function extractHeadings(content: string): TocHeading[] {
  const headings: TocHeading[] = [];
  const lines = content.split('\n');
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^```|^~~~/.test(lines[i].trim())) { inCode = !inCode; continue; }
    if (inCode) continue;
    const match = lines[i].match(/^(#{1,6})\s+(.+)/);
    if (match) {
      headings.push({
        lineNumber: i + 1,
        level: match[1].length,
        text: match[2].replace(/\s+#+\s*$/, '').trim(),
      });
    }
  }
  return headings;
}

// TOC가 표시될 수 있는 최소 여백 (content 600px 왼쪽에 남는 공간)
const MIN_MARGIN_FOR_TOC = 180;

export function MarkdownToc({ headings, onNavigate, containerRef }: MarkdownTocProps): JSX.Element | null {
  const [marginWidth, setMarginWidth] = useState(0);
  const [hovered, setHovered] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 컨테이너 폭에서 content(600px)를 빼고 왼쪽 여백 계산
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const available = (entry.contentRect.width - 600) / 2;
        setMarginWidth(Math.max(0, available));
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [containerRef]);

  if (headings.length === 0) return null;

  const hasSpace = marginWidth >= MIN_MARGIN_FOR_TOC;

  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHovered(true), 150);
  };
  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHovered(false), 500);
  };

  // 여백 충분: 왼쪽 여백에 자연스럽게 배치
  if (hasSpace) {
    return (
      <nav
        className="absolute top-10 z-10 overflow-y-auto pr-4 pt-2"
        style={{ left: 8, width: marginWidth - 16, maxHeight: 'calc(100% - 3rem)' }}
      >
        <TocList headings={headings} onNavigate={onNavigate} />
      </nav>
    );
  }

  // 여백 부족: 호버 시 오버레이 (300ms 딜레이)
  return (
    <>
      <div
        className="absolute left-0 top-10 z-30 h-full w-8"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      <nav
        className={`absolute left-0 top-10 z-30 overflow-y-auto rounded-r-md border-r border-subtle bg-surface-panel pl-3 pr-3 pt-2 pb-4 shadow-lg transition-all duration-200 ${
          hovered ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
        }`}
        style={{ width: 220, maxHeight: 'calc(100% - 3rem)' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <TocList headings={headings} onNavigate={onNavigate} />
      </nav>
    </>
  );
}

function TocList({ headings, onNavigate }: { headings: TocHeading[]; onNavigate: (n: number) => void }) {
  return (
    <div className="space-y-0.5">
      {headings.map((h, i) => (
        <TocItem key={`${h.lineNumber}-${i}`} heading={h} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function TocItem({ heading, onNavigate }: { heading: TocHeading; onNavigate: (n: number) => void }) {
  const handleClick = useCallback(() => { onNavigate(heading.lineNumber); }, [heading.lineNumber, onNavigate]);
  const paddingLeft = (heading.level - 1) * 12;

  return (
    <div
      role="button"
      tabIndex={0}
      className="cursor-pointer truncate text-xs text-muted transition-colors hover:text-default"
      style={{ paddingLeft }}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
    >
      {heading.text}
    </div>
  );
}
