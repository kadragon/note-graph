// Trace: SPEC-worknote-attachments-1, TASK-066
// Integration tests for work note file preview route

import { beforeEach, describe, expect, it } from 'vitest';

import { authFetch, MockR2, setTestR2Bucket, testEnv } from '../test-setup';

describe('Work Note File Preview Route', () => {
  beforeEach(async () => {
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM work_note_files'),
      testEnv.DB.prepare('DELETE FROM work_notes'),
    ]);

    // Seed minimal work note
    const now = new Date().toISOString();
    await testEnv.DB.prepare(
      `INSERT INTO work_notes (work_id, title, content_raw, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
    )
      .bind('WORK-123', '테스트 업무노트', '내용', now, now)
      .run();

    // Provide mock R2 binding for streaming routes
    setTestR2Bucket(new MockR2());
  });

  it('serves inline preview for PDF via /view endpoint', async () => {
    // Upload
    const form = new FormData();
    form.append('file', new Blob(['hello pdf'], { type: 'application/pdf' }), 'hello.pdf');

    const uploadRes = await authFetch('http://localhost/api/work-notes/WORK-123/files', {
      method: 'POST',
      body: form,
    });

    expect(uploadRes.status).toBe(201);
    const uploaded = (await uploadRes.json()) as { fileId: string };

    // View (inline)
    const viewRes = await authFetch(
      `http://localhost/api/work-notes/WORK-123/files/${uploaded.fileId}/view`
    );
    expect(viewRes.status).toBe(200);
    expect(viewRes.headers.get('Content-Type')).toBe('application/pdf');
    expect(viewRes.headers.get('Content-Disposition')).toContain('inline;');
    expect(await viewRes.text()).toContain('hello pdf');

    // Download (attachment)
    const downloadRes = await authFetch(
      `http://localhost/api/work-notes/WORK-123/files/${uploaded.fileId}/download`
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get('Content-Type')).toBe('application/pdf');
    expect(downloadRes.headers.get('Content-Disposition')).toContain('attachment;');
    expect(await downloadRes.text()).toContain('hello pdf');
  });
});
