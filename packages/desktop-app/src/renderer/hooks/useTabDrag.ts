import React from 'react';

export const TAB_DRAG_TYPE = 'application/x-netior-tab';
let clearTimer: ReturnType<typeof setTimeout> | null = null;

function getPendingDragTabSync(): string | null {
  return window.electron.editor.getDragTabSync();
}

export function setTabDragData(e: React.DragEvent, tabId: string): void {
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
    console.log('[TabDrag] clear cancelled by new dragStart');
  }
  e.dataTransfer.setData(TAB_DRAG_TYPE, tabId);
  e.dataTransfer.effectAllowed = 'move';
  // Cache in main process for cross-window drops
  window.electron.editor.setDragTab(tabId);
  console.log(`[TabDrag] set tabId=${tabId}, types=${JSON.stringify(Array.from(e.dataTransfer.types))}`);
}

export function getTabDragData(e: React.DragEvent): string | null {
  const local = e.dataTransfer.getData(TAB_DRAG_TYPE) || null;
  if (local) {
    console.log(`[TabDrag] get local tabId=${local}`);
    return local;
  }
  const pending = getPendingDragTabSync();
  console.log(`[TabDrag] get fallback tabId=${pending}, types=${JSON.stringify(Array.from(e.dataTransfer.types))}`);
  return pending;
}

/** Try same-window getData first, fall back to main process IPC for cross-window. */
export async function getTabDragDataAsync(e: React.DragEvent): Promise<string | null> {
  const local = e.dataTransfer.getData(TAB_DRAG_TYPE);
  if (local) {
    console.log(`[TabDrag] getAsync local tabId=${local}`);
    return local;
  }
  const pending = await window.electron.editor.getDragTab();
  console.log(`[TabDrag] getAsync fallback tabId=${pending}, types=${JSON.stringify(Array.from(e.dataTransfer.types))}`);
  return pending;
}

export function clearTabDragData(): void {
  console.log('[TabDrag] clear scheduled');
  if (clearTimer) {
    clearTimeout(clearTimer);
  }
  clearTimer = setTimeout(() => {
    clearTimer = null;
    console.log('[TabDrag] clear flush');
    window.electron.editor.clearDragTab();
  }, 600);
}

export function isTabDrag(e: React.DragEvent): boolean {
  const hasLocalType = e.dataTransfer.types.includes(TAB_DRAG_TYPE);
  if (hasLocalType) return true;

  const pending = getPendingDragTabSync();
  const result = !!pending;
  if (result) {
    console.log(`[TabDrag] isTabDrag fallback tabId=${pending}, types=${JSON.stringify(Array.from(e.dataTransfer.types))}`);
  }
  return result;
}
