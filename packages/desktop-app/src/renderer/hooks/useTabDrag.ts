import React from 'react';

export const TAB_DRAG_TYPE = 'application/x-netior-tab';

export function setTabDragData(e: React.DragEvent, tabId: string): void {
  e.dataTransfer.setData(TAB_DRAG_TYPE, tabId);
  e.dataTransfer.effectAllowed = 'move';
  // Cache in main process for cross-window drops
  window.electron.editor.setDragTab(tabId);
}

export function getTabDragData(e: React.DragEvent): string | null {
  return e.dataTransfer.getData(TAB_DRAG_TYPE) || null;
}

/** Try same-window getData first, fall back to main process IPC for cross-window. */
export async function getTabDragDataAsync(e: React.DragEvent): Promise<string | null> {
  const local = e.dataTransfer.getData(TAB_DRAG_TYPE);
  if (local) return local;
  return window.electron.editor.getDragTab();
}

export function clearTabDragData(): void {
  window.electron.editor.clearDragTab();
}

export function isTabDrag(e: React.DragEvent): boolean {
  return e.dataTransfer.types.includes(TAB_DRAG_TYPE);
}
