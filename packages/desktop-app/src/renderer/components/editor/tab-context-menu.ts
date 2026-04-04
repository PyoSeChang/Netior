import type { EditorTab } from '@netior/shared/types';
import type { ContextMenuEntry } from '../ui/ContextMenu';
import { useEditorStore, MAIN_HOST_ID } from '../../stores/editor-store';
import { getEditorType, getAvailableEditors, EDITOR_LABELS, type EditorType } from './editor-utils';
import { translate, type TranslationKey } from '@netior/shared/i18n';
import { useSettingsStore } from '../../stores/settings-store';
import { isTodoEnabled, toggleTodoEnabled } from '../../lib/terminal-todo-store';
import { openTerminalTab } from '../../lib/terminal/open-terminal-tab';

// ── Common items (all tab types) ──

function buildCommonItems(tab: EditorTab, tabs: EditorTab[]): ContextMenuEntry[] {
  const store = useEditorStore.getState();
  const idx = tabs.findIndex((t) => t.id === tab.id);
  const hasRight = idx >= 0 && idx < tabs.length - 1;
  const hasOthers = tabs.length > 1;

  const locale = useSettingsStore.getState().locale;
  const t = (key: TranslationKey) => translate(locale, key);

  const items: ContextMenuEntry[] = [
    { label: '탭 닫기', shortcut: 'Ctrl+W', onClick: () => store.requestCloseTab(tab.id) },
    { label: '다른 탭 모두 닫기', disabled: !hasOthers, onClick: () => store.closeOtherTabs(tab.id) },
    { label: '오른쪽 탭 모두 닫기', disabled: !hasRight, onClick: () => store.closeTabsToRight(tab.id) },
    { label: '모든 탭 닫기', onClick: () => store.closeAllTabs() },
  ];

  // Minimize only available in main host
  if (tab.hostId === MAIN_HOST_ID) {
    items.push({ type: 'divider' });
    items.push({
      label: t('common.minimizeTab'),
      onClick: () => store.minimizeSingleTab(tab.id),
    });
  }

  return items;
}

// ── View mode items (main host only) ──

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

// ── Host move items ──

function buildHostMoveItems(tab: EditorTab): ContextMenuEntry[] {
  const store = useEditorStore.getState();
  const items: ContextMenuEntry[] = [];

  if (tab.hostId === MAIN_HOST_ID) {
    // Tab is in main → offer "Move to New Window"
    items.push({
      label: '새 창으로 이동',
      onClick: () => {
        console.log(`[TabContextMenu] detach tabId=${tab.id} from host=${tab.hostId}`);
        store.detachTab(tab.id);
      },
    });
  } else {
    // Tab is in detached → offer "Move to Main Window"
    items.push({
      label: '메인 창으로 이동',
      shortcut: 'Ctrl+Shift+M',
      onClick: () => {
        console.log(`[TabContextMenu] moveToMain tabId=${tab.id} from host=${tab.hostId}`);
        store.moveTabToHost(tab.id, MAIN_HOST_ID);
      },
    });
  }

  // List other detached hosts to move to
  const otherHosts = Object.values(store.hosts).filter((h) => h.id !== tab.hostId);
  if (otherHosts.length > 0) {
    items.push({ type: 'divider' });
    for (const host of otherHosts) {
      items.push({
        label: `${host.label} 창으로 이동`,
        onClick: () => {
          console.log(`[TabContextMenu] moveToHost tabId=${tab.id} from host=${tab.hostId} to host=${host.id}`);
          store.moveTabToHost(tab.id, host.id);
        },
      });
    }
  }

  return items;
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
      label: isTodoEnabled(tab.targetId) ? 'Todo 숨기기' : 'Todo 표시',
      onClick: () => toggleTodoEnabled(tab.targetId),
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

  // View mode items (main host only)
  if (tab.hostId === MAIN_HOST_ID) {
    items.push({ type: 'divider' });
    items.push(...buildViewModeItems(tab));
  }

  // Host move items
  items.push({ type: 'divider' });
  items.push(...buildHostMoveItems(tab));

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
export function buildStripContextMenu(tabs: EditorTab[], hostId?: string): ContextMenuEntry[] {
  const store = useEditorStore.getState();
  const resolvedHostId = hostId ?? MAIN_HOST_ID;

  const items: ContextMenuEntry[] = [
    { label: '모든 탭 닫기', disabled: tabs.length === 0, onClick: () => store.closeAllTabs() },
    { type: 'divider' },
    {
      label: '새 터미널',
      onClick: () => {
        openTerminalTab(resolvedHostId);
      },
    },
  ];

  // Detached host: offer "Reattach All Tabs"
  if (resolvedHostId !== MAIN_HOST_ID && tabs.length > 0) {
    items.push({ type: 'divider' });
    items.push({
      label: '모든 탭을 메인 창으로 이동',
      onClick: () => {
        for (const tab of [...tabs]) {
          store.moveTabToHost(tab.id, MAIN_HOST_ID);
        }
      },
    });
  }

  return items;
}
