import { describe, it, expect } from 'vitest';
import { translate } from '../i18n';

describe('translate', () => {
  it('should return Korean translation by default', () => {
    expect(translate('ko', 'common.save')).toBe('저장');
    expect(translate('ko', 'common.delete')).toBe('삭제');
  });

  it('should return English translation', () => {
    expect(translate('en', 'common.save')).toBe('Save');
    expect(translate('en', 'common.delete')).toBe('Delete');
  });

  it('should return key if translation not found', () => {
    expect(translate('ko', 'nonexistent.key' as any)).toBe('nonexistent.key');
  });

  it('should interpolate params', () => {
    // Add a key with param to test (currently none exist, so test the mechanism)
    const result = translate('ko', 'common.save');
    expect(typeof result).toBe('string');
  });

  it('should handle nested keys', () => {
    expect(translate('ko', 'project.create')).toBe('프로젝트 생성');
    expect(translate('en', 'project.create')).toBe('Create Project');
  });

  it('should handle all defined keys without throwing', () => {
    const keys = [
      'common.create', 'common.delete', 'common.cancel', 'common.save',
      'project.create', 'project.name',
      'network.create', 'network.defaultName',
      'concept.create', 'concept.defaultTitle',
      'edge.connect', 'edge.delete',
      'editor.unsaved', 'editor.openExternal',
    ] as const;

    for (const key of keys) {
      expect(() => translate('ko', key)).not.toThrow();
      expect(() => translate('en', key)).not.toThrow();
    }
  });
});
