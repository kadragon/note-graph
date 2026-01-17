// Trace: plan.md Task 2.1
// Tests for protocol-handler: notegraph:// URL generation

import { describe, expect, it } from 'vitest';
import { buildLocalFileUrl } from './protocol-handler';

describe('buildLocalFileUrl', () => {
  it('should build a notegraph:// URL with encoded path', () => {
    const result = buildLocalFileUrl('C:/GoogleDrive', 'WORK-001/document.pdf');

    expect(result).toBe('notegraph://open?path=C%3A%2FGoogleDrive%2FWORK-001%2Fdocument.pdf');
  });

  it('should handle paths with spaces', () => {
    const result = buildLocalFileUrl('C:/Google Drive', 'WORK-001/my document.pdf');

    expect(result).toBe(
      'notegraph://open?path=C%3A%2FGoogle%20Drive%2FWORK-001%2Fmy%20document.pdf'
    );
  });

  it('should handle paths with Korean characters', () => {
    const result = buildLocalFileUrl('C:/GoogleDrive', 'WORK-001/문서.pdf');

    expect(result).toBe(
      'notegraph://open?path=C%3A%2FGoogleDrive%2FWORK-001%2F%EB%AC%B8%EC%84%9C.pdf'
    );
  });
});
