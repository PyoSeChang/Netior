import type { EditorTab } from '@moc/shared/types';
import type { ContextMenuEntry } from '../ui/ContextMenu';
import { useEditorStore } from '../../stores/editor-store';
import { getEditorType, getAvailableEditors, EDITOR_LABELS, type EditorType } from './editor-utils';

// ── Common items (all tab types) ──

function buildCommonItems(tab: EditorTab, tabs: EditorTab[]): ContextMenuEntry[] {
  const store = useEditorStore.getState();
  const idx = tabs.findIndex((t) => t.id === tab.id);
  const hasRight = idx >= 0 && idx < tabs.length - 1;
  const hasOthers = tabs.length > 1;

  return [
    { label: '탭 닫기', shortcut: 'Ctrl+W', onClick: () => store.requestCloseTab(tab.id) },
    { label: '다른 탭 모두 닫기', disabled: !hasOthers, onClick: () => store.closeOtherTabs(tab.id) },
    { label: '오른쪽 탭 모두 닫기', disabled: !hasRight, onClick: () => store.closeTabsToRight(tab.id) },
    { label: '모든 탭 닫기', onClick: () => store.closeAllTabs() },
  ];
}

// ── View mode items (all tab types) ──

function buildViewModeItems(tab: EditorTab): ContextMenuEntry[] {
  const store = useEditorStore.getState();
  const current = tab.viewMode;

  const modes = [
    { label: 'Side 모드', mode: 'side' as const },
    { label: 'Full 모드', mode: 'full' as const },
    { label: 'Float 모드', mode: 'float' as const },
  ];

  return modes.map((m) => ({
    label: m.mode === current ? `${m.label} ✓` : m.label,
    disabled: m.mode === current,
    onClick: () => store.setViewMode(tab.id, m.mode),
  }));
}

// ── Concept-specific items ──

function buildConceptItems(tab: EditorTab): ContextMenuEntry[] {
  const items: ContextMenuEntry[] = [];

  if (tab.activeFilePath) {
    items.push({
      label: '파일 경로 복사',
      onClick: () => navigator.clipboard.writeText(tab.activeFilePath!),
    });
  }

  return items;
}

// ── File-specific items ──

function buildFileItems(tab: EditorTab): ContextMenuEntry[] {
  const store = useEditorStore.getState();
  const available = getAvailableEditors(tab.targetId);
  const current = (tab.editorType as EditorType) ?? getEditorType(tab.targetId);

  const items: ContextMenuEntry[] = [
    {
      label: '파일 경로 복사',
      onClick: () => navigator.clipboard.writeText(tab.targetId),
    },
  ];

  if (available.length > 1) {
    items.push({ type: 'divider' });
    for (const editor of available) {
      items.push({
        label: `${EDITOR_LABELS[editor]}${editor === current ? ' ✓' : ''}`,
        disabled: editor === current,
        onClick: () => store.setEditorType(tab.id, editor),
      });
    }
  }

  return items;
}

// ── Terminal-specific items ──

function buildTerminalItems(tab: EditorTab, callbacks?: TabContextMenuCallbacks): ContextMenuEntry[] {
  return [
    {
      label: '터미널 이름 변경',
      onClick: () => callbacks?.onRequestRename?.(tab.id),
    },
    {
      label: '터미널 Kill',
      danger: true,
      onClick: () => {
        window.electron.terminal.shutdown(tab.targetId).catch(() => {});
        useEditorStore.getState().closeTab(tab.id);
      },
    },
  ];
}

// ── Builders ──

export interface TabContextMenuCallbacks {
  onRequestRename?: (tabId: string) => void;
}

type TypeBuilder = (tab: EditorTab, callbacks?: TabContextMenuCallbacks) => ContextMenuEntry[];

const typeBuilders: Record<string, TypeBuilder> = {
  concept: buildConceptItems,
  file: buildFileItems,
  terminal: buildTerminalItems,
};

/** Build context menu items for a tab right-click */
export function buildTabContextMenu(tab: EditorTab, tabs: EditorTab[], callbacks?: TabContextMenuCallbacks): ContextMenuEntry[] {
  const items: ContextMenuEntry[] = [];

  items.push(...buildCommonItems(tab, tabs));
  items.push({ type: 'divider' });
  items.push(...buildViewModeItems(tab));

  const typeBuilder = typeBuilders[tab.type];
  if (typeBuilder) {
    const typeItems = typeBuilder(tab, callbacks);
    if (typeItems.length > 0) {
      items.push({ type: 'divider' });
      items.push(...typeItems);
    }
  }

  return items;
}

/** Build context menu items for strip empty area right-click */
export function buildStripContextMenu(tabs: EditorTab[]): ContextMenuEntry[] {
  const store = useEditorStore.getState();

  return [
    { label: '모든 탭 닫기', disabled: tabs.length === 0, onClick: () => store.closeAllTabs() },
    { type: 'divider' },
    {
      label: '새 터미널',
      onClick: () => {
        const sessionId = `term-${Date.now()}`;
        store.openTab({ type: 'terminal', targetId: sessionId, title: 'Terminal' });
      },
    },
  ];
}
