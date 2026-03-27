import React from 'react';

export const TAB_DRAG_TYPE = 'application/x-moc-tab';

export function setTabDragData(e: React.DragEvent, tabId: string): void {
  e.dataTransfer.setData(TAB_DRAG_TYPE, tabId);
  e.dataTransfer.effectAllowed = 'move';
}

export function getTabDragData(e: React.DragEvent): string | null {
  return e.dataTransfer.getData(TAB_DRAG_TYPE) || null;
}

export function isTabDrag(e: React.DragEvent): boolean {
  return e.dataTransfer.types.includes(TAB_DRAG_TYPE);
}
