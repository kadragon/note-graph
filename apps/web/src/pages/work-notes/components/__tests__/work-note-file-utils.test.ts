import { File, FileImage, FileSpreadsheet, FileText } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { getFileIconInfo } from '../work-note-file-utils';

describe('getFileIconInfo', () => {
  it('returns FileText with red for .pdf', () => {
    const result = getFileIconInfo('report.pdf');
    expect(result.icon).toBe(FileText);
    expect(result.colorClass).toBe('text-red-500');
  });

  it.each([
    ['document.hwp'],
    ['document.hwpx'],
  ])('returns FileText with blue for %s', (filename) => {
    const result = getFileIconInfo(filename);
    expect(result.icon).toBe(FileText);
    expect(result.colorClass).toBe('text-blue-500');
  });

  it.each([
    ['data.xls'],
    ['data.xlsx'],
  ])('returns FileSpreadsheet with green for %s', (filename) => {
    const result = getFileIconInfo(filename);
    expect(result.icon).toBe(FileSpreadsheet);
    expect(result.colorClass).toBe('text-green-600');
  });

  it.each([
    ['photo.png'],
    ['photo.jpg'],
    ['photo.jpeg'],
    ['photo.gif'],
    ['photo.webp'],
  ])('returns FileImage with violet for %s', (filename) => {
    const result = getFileIconInfo(filename);
    expect(result.icon).toBe(FileImage);
    expect(result.colorClass).toBe('text-violet-500');
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
