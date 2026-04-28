import { describe, expect, it } from 'vitest';
import { toAbsolutePath, toRelativePath } from '../utils/path-utils';

describe('path-utils', () => {
  it('converts project-relative paths to absolute paths', () => {
    expect(toAbsolutePath('C:/workspace/project', 'docs/file.pdf')).toBe(
      'C:/workspace/project/docs/file.pdf',
    );
  });

  it('keeps absolute paths unchanged apart from slash normalization', () => {
    expect(toAbsolutePath('C:/workspace/project', 'C:\\files\\think-data-structure.pdf')).toBe(
      'C:/files/think-data-structure.pdf',
    );
  });

  it('converts absolute paths inside the project directory back to relative paths', () => {
    expect(toRelativePath('C:/workspace/project', 'C:/workspace/project/docs/file.pdf')).toBe(
      'docs/file.pdf',
    );
  });
});
