import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACTIVITY_BAR_LAYOUT_CONFIG,
  getProjectNetworkBookmarkIds,
  getVisibleOrderedItems,
  moveOrderedItem,
  normalizeActivityBarLayoutConfig,
  setProjectNetworkBookmarkIds,
} from '../lib/activity-bar-layout';

describe('normalizeActivityBarLayoutConfig', () => {
  it('fills missing built-in items and removes duplicate bookmark ids', () => {
    const normalized = normalizeActivityBarLayoutConfig({
      topItemOrder: ['files', 'networks', 'objects', 'sessions', 'files', 'unknown'],
      bottomItemOrder: ['sessions', 'settings'],
      networkBookmarksByProject: {
        projectA: ['network-2', '', 'network-2', 'network-1'],
        '   ': ['ignored'],
        projectB: 'invalid',
      },
    });

    expect(normalized.topItemOrder).toEqual([
      'projects',
      'networks',
      'files',
      'sessions',
    ]);
    expect(normalized.bottomItemOrder).toEqual(['ontology', 'narre', 'terminal', 'agents', 'settings']);
    expect(normalized.networkBookmarksByProject).toEqual({
      projectA: ['network-2', 'network-1'],
    });
  });

  it('falls back to defaults for invalid input', () => {
    expect(normalizeActivityBarLayoutConfig(null)).toEqual(DEFAULT_ACTIVITY_BAR_LAYOUT_CONFIG);
  });
});

describe('getVisibleOrderedItems', () => {
  it('keeps the stored order for currently available items only', () => {
    expect(
      getVisibleOrderedItems(['files', 'sessions', 'networks'], ['networks', 'files']),
    ).toEqual(['files', 'networks']);
  });
});

describe('moveOrderedItem', () => {
  it('moves an item one slot in the requested direction', () => {
    expect(moveOrderedItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moveOrderedItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
  });

  it('returns a copy when the move would leave bounds', () => {
    expect(moveOrderedItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });
});

describe('project bookmark helpers', () => {
  it('sets and clears project bookmark ids', () => {
    const withBookmarks = setProjectNetworkBookmarkIds(
      DEFAULT_ACTIVITY_BAR_LAYOUT_CONFIG,
      'project-1',
      ['network-1', 'network-2', 'network-1'],
    );

    expect(getProjectNetworkBookmarkIds(withBookmarks, 'project-1')).toEqual(['network-1', 'network-2']);

    const cleared = setProjectNetworkBookmarkIds(withBookmarks, 'project-1', []);
    expect(getProjectNetworkBookmarkIds(cleared, 'project-1')).toEqual([]);
  });
});
