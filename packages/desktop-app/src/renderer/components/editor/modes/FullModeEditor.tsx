import React, { useCallback, useEffect, useState } from 'react';
import type { SplitLeaf, EditorTab } from '@netior/shared/types';
import { useEditorStore, collectLeaves, getActiveTabFromLayout } from '../../../stores/editor-store';
import { EditorViewModeSwitch } from '../EditorViewModeSwitch';
import { EditorContent } from '../EditorContent';
import { EditorTabStrip } from '../EditorTabStrip';
import { SplitPaneRenderer } from '../SplitPaneRenderer';
import { DropZoneOverlay } from '../DropZoneOverlay';
import { isTabDrag } from '../../../hooks/useTabDrag';

export function FullModeEditor(): JSX.Element | null {
  const {
    tabs, activeTabId, fullLayout,
    setActiveTab, requestCloseTab, setViewMode, toggleMinimize,
    updateSplitRatio, splitTab, moveTabToPane,
  } = useEditorStore();
  const layoutActiveTabId = useEditorStore((s) => {
    if (!s.fullLayout) return null;
    return getActiveTabFromLayout(s.fullLayout, s.activeTabId);
  });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const reset = () => setIsDragging(false);
    document.addEventListener('dragend', reset);
    return () => document.removeEventListener('dragend', reset);
  }, []);

  const renderFullLeaf = useCallback(
    (leaf: SplitLeaf) => {
      const leafTabs = leaf.tabIds
        .map((id) => tabs.find((t) => t.id === id))
        .filter((t): t is EditorTab => t != null);
      const activeTab = leafTabs.find((t) => t.id === leaf.activeTabId) ?? leafTabs[0];
      const isActivePane = layoutActiveTabId ? leaf.tabIds.includes(layoutActiveTabId) : false;
      const isMultiPane = fullLayout ? collectLeaves(fullLayout).length > 1 : false;

      return (
        <div
          className={`flex h-full flex-col overflow-hidden ${isMultiPane && isActivePane ? 'ring-1 ring-accent' : ''}`}
          onMouseDown={() => {
            if (!leaf.tabIds.includes(activeTabId!)) {
              setActiveTab(leaf.activeTabId);
            }
          }}
        >
          <EditorTabStrip
            tabs={leafTabs}
            activeTabId={leaf.activeTabId}
            isFocusedPane={isActivePane}
            onActivate={setActiveTab}
            onClose={requestCloseTab}
            onTabDrop={(droppedId) => moveTabToPane(droppedId, leaf.activeTabId, 'full')}
            rightSlot={
              <EditorViewModeSwitch
                currentMode="full"
                onModeChange={(mode) => setViewMode(leaf.activeTabId, mode)}
                onMinimize={() => toggleMinimize(leaf.activeTabId)}
              />
            }
          />
          <div className="relative flex-1 overflow-hidden bg-surface-panel">
            {activeTab && <EditorContent tab={activeTab} />}
            <DropZoneOverlay
              onDrop={(result) => {
                setIsDragging(false);
                if (result.zone === 'center') {
                  moveTabToPane(result.tabId, leaf.activeTabId, 'full');
                } else {
                  const targetId = leaf.tabIds.find((id) => id !== result.tabId) ?? leaf.activeTabId;
                  if (targetId !== result.tabId || leaf.tabIds.length > 1) {
                    splitTab(targetId, result.tabId, result.direction, result.position);
                  }
                }
              }}
              active={isDragging}
            />
          </div>
        </div>
      );
    },
    [tabs, isDragging, activeTabId, layoutActiveTabId, fullLayout, setActiveTab, requestCloseTab, setViewMode, toggleMinimize, moveTabToPane, splitTab],
  );

  if (!fullLayout) return null;

  return (
    <div
      className="flex h-full w-full bg-surface-panel"
      onDragEnter={(e) => { if (isTabDrag(e)) setIsDragging(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
      onDrop={() => setIsDragging(false)}
    >
      <SplitPaneRenderer
        node={fullLayout}
        mode="full"
        renderLeaf={renderFullLeaf}
        onRatioChange={updateSplitRatio}
      />
    </div>
  );
}
