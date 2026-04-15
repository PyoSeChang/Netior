import { describe, expect, it, vi } from 'vitest';
import { getViewportCellHeight, syncViewportScrollPosition } from '../lib/terminal/hyper-fork/term';

function mockRectHeight(element: HTMLElement, height: number): void {
  Object.defineProperty(element, 'getBoundingClientRect', {
    value: () => ({
      width: 0,
      height,
      top: 0,
      left: 0,
      right: 0,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
    configurable: true,
  });
}

describe('terminal viewport sync', () => {
  it('falls back to rendered row height when direct cell metrics are missing', () => {
    const root = document.createElement('div');
    const rows = document.createElement('div');
    rows.className = 'xterm-rows';
    const row = document.createElement('div');
    mockRectHeight(row, 19);
    rows.appendChild(row);
    root.appendChild(rows);

    expect(getViewportCellHeight({
      element: root,
      buffer: {
        active: {
          viewportY: 0,
          length: 0,
          getLine: () => undefined,
        },
      },
    })).toBe(19);
  });

  it('realigns the viewport scrollbar to the active buffer line', () => {
    const root = document.createElement('div');
    const viewport = document.createElement('div');
    viewport.className = 'xterm-viewport';
    viewport.scrollTop = 0;

    const rows = document.createElement('div');
    rows.className = 'xterm-rows';
    const row = document.createElement('div');
    mockRectHeight(row, 18);
    rows.appendChild(row);

    root.appendChild(viewport);
    root.appendChild(rows);

    const term = {
      element: root,
      buffer: {
        active: {
          viewportY: 7,
        },
      },
      scrollToLine: vi.fn(),
    } as any;

    syncViewportScrollPosition(term);

    expect(term.scrollToLine).toHaveBeenCalledWith(7);
    expect(viewport.scrollTop).toBe(126);
  });
});
