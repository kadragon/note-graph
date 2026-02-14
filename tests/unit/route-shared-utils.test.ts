import { missingParamJson, notFoundJson } from '@worker/routes/_shared/route-responses';
import { triggerReembed } from '@worker/routes/_shared/trigger-reembed';
import { WorkNoteService } from '@worker/services/work-note-service';
import type { AppContext } from '@worker/types/context';
import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';

describe('route shared utils', () => {
  it('notFoundJson returns standard 404 payload', () => {
    const mockResponse = { ok: true } as unknown as Response;
    const c = {
      json: vi.fn().mockReturnValue(mockResponse),
    } as unknown as Context;

    const response = notFoundJson(c, 'Work note', 'WORK-123');

    expect(c.json).toHaveBeenCalledWith(
      { code: 'NOT_FOUND', message: 'Work note not found: WORK-123' },
      404
    );
    expect(response).toBe(mockResponse);
  });

  it('missingParamJson returns standard 400 payload', () => {
    const mockResponse = { ok: true } as unknown as Response;
    const c = {
      json: vi.fn().mockReturnValue(mockResponse),
    } as unknown as Context;

    const response = missingParamJson(c, 'workId');

    expect(c.json).toHaveBeenCalledWith({ error: 'workId is required' }, 400);
    expect(response).toBe(mockResponse);
  });

  it('triggerReembed calls WorkNoteService.reembedOnly', async () => {
    const reembedSpy = vi
      .spyOn(WorkNoteService.prototype, 'reembedOnly')
      .mockResolvedValue(undefined);

    await triggerReembed({} as AppContext['Bindings'], 'WORK-1', 'TODO-1', 'update');

    expect(reembedSpy).toHaveBeenCalledWith('WORK-1');
  });

  it('triggerReembed logs errors and resolves', async () => {
    vi.spyOn(WorkNoteService.prototype, 'reembedOnly').mockRejectedValue(new Error('boom'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      triggerReembed({} as AppContext['Bindings'], 'WORK-2', 'TODO-2', 'deletion')
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith('[WorkNote] Failed to re-embed after todo deletion:', {
      workId: 'WORK-2',
      todoId: 'TODO-2',
      error: 'boom',
    });
  });
});
