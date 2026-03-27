import React, { useCallback } from 'react';
import type { EditorTab } from '@moc/shared/types';
import { useEditorStore } from '../../../stores/editor-store';
import { EditorViewModeSwitch } from '../EditorViewModeSwitch';
import { EditorContent } from '../EditorContent';
import { EditorTabStrip } from '../EditorTabStrip';
import { SplitPaneRenderer } from '../SplitPaneRenderer';
import { DropZoneOverlay } from '../DropZoneOverlay';
import type { DropResult } from '../DropZoneOverlay';

interface FullModeEditorProps {
  tab: EditorTab;
}

export function FullModeEditor({ tab }: FullModeEditorProps): JSX.Element {
  const { tabs, fullLayout, setActiveTab, closeTab, setViewMode, toggleMinimize, updateSplitRatio, splitTab } = useEditorStore();

  const fullTabs = tabs.filter((t) => t.viewMode === 'full' && !t.isMinimized);
  const hasFullSplit = fullLayout && fullLayout.type === 'branch';

  const renderFullLeaf = useCallback(
    (tabId: string) => {
      const t = tabs.find((tab) => tab.id === tabId);
      if (!t) return null;
      return <EditorContent tab={t} />;
    },
    [tabs],
  );

  const handleFullTabDrop = useCallback((tabId: string) => {
    setViewMode(tabId, 'full');
    setActiveTab(tabId);
  }, [setViewMode, setActiveTab]);

  const handleFullDrop = useCallback((result: DropResult) => {
    if (result.zone === 'center') {
      setViewMode(result.tabId, 'full');
      setActiveTab(result.tabId);
    } else {
      setViewMode(result.tabId, 'full');
      splitTab(tab.id, result.tabId, result.direction, result.position);
    }
  }, [tab.id, setViewMode, setActiveTab, splitTab]);

  return (
    <div className="flex h-full w-full flex-col bg-surface-panel">
      <EditorTabStrip
        tabs={fullTabs}
        activeTabId={tab.id}
        onActivate={setActiveTab}
        onClose={closeTab}
        onTabDrop={handleFullTabDrop}
        rightSlot={
          <EditorViewModeSwitch
            currentMode={tab.viewMode}
            onModeChange={(mode) => setViewMode(tab.id, mode)}
            onMinimize={() => toggleMinimize(tab.id)}
          />
        }
      />

      <div className="relative flex-1 overflow-hidden">
        {hasFullSplit && fullLayout ? (
          <SplitPaneRenderer
            node={fullLayout}
            mode="full"
            renderLeaf={renderFullLeaf}
            onRatioChange={updateSplitRatio}
          />
        ) : (
          <EditorContent tab={tab} />
        )}
        <DropZoneOverlay onDrop={handleFullDrop} />
      </div>
    </div>
  );
}
