import { File, FileImage, FileSpreadsheet, FileText } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { getFileIconInfo } from '../work-note-file-utils';

describe('getFileIconInfo', () => {
  it('returns FileText with red for .pdf', () => {
    const result = getFileIconInfo('report.pdf');
    expect(result.icon).toBe(FileText);
    expect(result.colorClass).toBe('text-red-500');
  });

  it('returns FileText with blue for .hwp', () => {
    const result = getFileIconInfo('document.hwp');
    expect(result.icon).toBe(FileText);
    expect(result.colorClass).toBe('text-blue-500');
  });

  it('returns FileText with blue for .hwpx', () => {
    const result = getFileIconInfo('document.hwpx');
    expect(result.icon).toBe(FileText);
    expect(result.colorClass).toBe('text-blue-500');
  });

  it('returns FileSpreadsheet with green for .xls', () => {
    const result = getFileIconInfo('data.xls');
    expect(result.icon).toBe(FileSpreadsheet);
    expect(result.colorClass).toBe('text-green-600');
  });

  it('returns FileSpreadsheet with green for .xlsx', () => {
    const result = getFileIconInfo('data.xlsx');
    expect(result.icon).toBe(FileSpreadsheet);
    expect(result.colorClass).toBe('text-green-600');
  });

  it('returns FileImage with violet for image extensions', () => {
    for (const ext of ['png', 'jpg', 'jpeg', 'gif', 'webp']) {
      const result = getFileIconInfo(`photo.${ext}`);
      expect(result.icon).toBe(FileImage);
      expect(result.colorClass).toBe('text-violet-500');
    }
  });

  it('is case-insensitive', () => {
    const result = getFileIconInfo('REPORT.PDF');
    expect(result.icon).toBe(FileText);
    expect(result.colorClass).toBe('text-red-500');
  });

  it('returns File with muted foreground for unknown extensions', () => {
    const result = getFileIconInfo('readme.txt');
    expect(result.icon).toBe(File);
    expect(result.colorClass).toBe('text-muted-foreground');
  });

  it('returns File with muted foreground for files without extension', () => {
    const result = getFileIconInfo('Makefile');
    expect(result.icon).toBe(File);
    expect(result.colorClass).toBe('text-muted-foreground');
  });
});
