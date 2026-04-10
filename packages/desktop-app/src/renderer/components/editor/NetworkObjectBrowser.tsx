import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, CircleDot, FolderOpen, Layers3, Shapes, Share2, Waypoints } from 'lucide-react';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';

export type NetworkBrowserObjectType = 'network' | 'project' | 'concept' | 'archetype' | 'relation_type' | 'context';

export interface NetworkBrowserItem {
  id: string;
  objectType: NetworkBrowserObjectType;
  title: string;
  subtitle: string;
  isActive?: boolean;
}

interface NetworkBrowserSection {
  key: NetworkBrowserObjectType;
  label: string;
  items: NetworkBrowserItem[];
}

interface NetworkObjectBrowserProps {
  title: string;
  searchPlaceholder: string;
  sections: NetworkBrowserSection[];
  selectedKey: string | null;
  onSelect: (item: NetworkBrowserItem) => void;
  onOpen: (item: NetworkBrowserItem) => void;
}

const ICONS: Record<NetworkBrowserObjectType, React.ElementType> = {
  network: Waypoints,
  project: FolderOpen,
  concept: CircleDot,
  archetype: Shapes,
  relation_type: Share2,
  context: Layers3,
};

export function NetworkObjectBrowser({
  title,
  searchPlaceholder,
  sections,
  selectedKey,
  onSelect,
  onOpen,
}: NetworkObjectBrowserProps): JSX.Element {
  const [search, setSearch] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set());
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());

  const filteredSections = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return sections
      .map((section) => ({
        ...section,
        items: normalized
          ? section.items.filter((item) =>
              item.title.toLowerCase().includes(normalized) || item.subtitle.toLowerCase().includes(normalized))
          : section.items,
      }))
      .filter((section) => section.items.length > 0);
  }, [search, sections]);

  const totalCount = useMemo(
    () => filteredSections.reduce((sum, section) => sum + section.items.length, 0),
    [filteredSections],
  );

  const visibleItems = useMemo(
    () => filteredSections.flatMap((section) => (
      collapsedSections.has(section.key)
        ? []
        : section.items.map((item) => ({
            key: `${item.objectType}:${item.id}`,
            item,
            sectionKey: section.key,
          }))
    )),
    [collapsedSections, filteredSections],
  );

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (!selectedKey) return;
    itemRefs.current.get(selectedKey)?.scrollIntoView({ block: 'nearest' });
  }, [selectedKey]);

  const focusSection = (sectionKey: string, open: boolean) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (open) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.tagName === 'INPUT' || target?.closest('input')) return;
    if (visibleItems.length === 0) return;

    const currentIndex = selectedKey ? visibleItems.findIndex((entry) => entry.key === selectedKey) : -1;
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = Math.min(safeIndex + 1, visibleItems.length - 1);
      onSelect(visibleItems[nextIndex].item);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = Math.max(currentIndex >= 0 ? currentIndex - 1 : 0, 0);
      onSelect(visibleItems[nextIndex].item);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      onSelect(visibleItems[0].item);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      onSelect(visibleItems[visibleItems.length - 1].item);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      onOpen(visibleItems[safeIndex].item);
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const activeEntry = visibleItems[safeIndex];
      if (!activeEntry) return;
      event.preventDefault();
      focusSection(activeEntry.sectionKey, event.key === 'ArrowRight');
    }
  };

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col bg-surface-panel">
      <div className="border-b border-subtle bg-surface-card px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-secondary">{title}</div>
            <div className="mt-1 text-lg font-semibold text-default">{totalCount} objects</div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="default">{filteredSections.length} sections</Badge>
            <Badge variant="accent">{totalCount} objects</Badge>
          </div>
        </div>
        <div className="mt-3 max-w-[360px]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            inputSize="sm"
          />
        </div>
      </div>

      <div
        className="editor-scrollbar min-h-0 flex-1 overflow-y-scroll overflow-x-hidden p-4 outline-none"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div className="flex flex-col gap-4">
          {filteredSections.map((section) => {
            const collapsed = collapsedSections.has(section.key);
            return (
              <section key={section.key} className="min-w-0 overflow-hidden rounded-xl border border-subtle bg-surface-card shadow-sm">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 border-b border-subtle px-4 py-3 text-left"
                  onClick={() => toggleSection(section.key)}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {collapsed ? (
                      <ChevronRight size={14} className="shrink-0 text-secondary" />
                    ) : (
                      <ChevronDown size={14} className="shrink-0 text-secondary" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-default">{section.label}</div>
                      <div className="text-xs text-muted">{section.items.length} objects</div>
                    </div>
                  </div>
                  <Badge variant="default">{section.key}</Badge>
                </button>

                {!collapsed && (
                  <div className="flex flex-col">
                    {section.items.map((item) => {
                      const Icon = ICONS[item.objectType];
                      const itemKey = `${item.objectType}:${item.id}`;
                      const selected = selectedKey === itemKey;
                      return (
                        <button
                          key={itemKey}
                          ref={(element) => {
                            if (element) itemRefs.current.set(itemKey, element);
                            else itemRefs.current.delete(itemKey);
                          }}
                          type="button"
                          className={`grid grid-cols-[auto,minmax(0,1fr),auto] items-center gap-3 border-t border-subtle px-4 py-3 text-left transition-colors first:border-t-0 ${
                            selected
                              ? 'bg-interactive-selected text-accent'
                              : item.isActive
                                ? 'bg-accent-muted/40 text-accent'
                                : 'text-default hover:bg-surface-hover'
                          }`}
                          onClick={() => onSelect(item)}
                          onDoubleClick={() => onOpen(item)}
                        >
                          <div className={`rounded-lg p-2 ${selected ? 'bg-accent-muted text-accent' : 'bg-surface-base text-secondary'}`}>
                            <Icon size={16} className="shrink-0" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="truncate text-sm font-medium">{item.title}</div>
                              {item.isActive && <Badge variant="accent">Active</Badge>}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-muted">{item.subtitle}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={selected ? 'accent' : 'default'}>{item.objectType}</Badge>
                            <ChevronRight size={14} className={selected ? 'text-accent' : 'text-muted'} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
