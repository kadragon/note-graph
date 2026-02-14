import { triggerReembed } from '@worker/routes/shared/reembed';
import { WorkNoteService } from '@worker/services/work-note-service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('triggerReembed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls WorkNoteService.reembedOnly with workId', async () => {
    const reembedOnlySpy = vi
      .spyOn(WorkNoteService.prototype, 'reembedOnly')
      .mockResolvedValue(undefined);

    await expect(
      triggerReembed({} as never, 'WORK-1', 'TODO-1', 'update')
    ).resolves.toBeUndefined();
    expect(reembedOnlySpy).toHaveBeenCalledWith('WORK-1');
  });

  it('swallows reembed errors and logs context', async () => {
    vi.spyOn(WorkNoteService.prototype, 'reembedOnly').mockRejectedValue(new Error('boom'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      triggerReembed({} as never, 'WORK-ERR', 'TODO-ERR', 'deletion')
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      '[WorkNote] Failed to re-embed after todo deletion:',
      expect.objectContaining({
        workId: 'WORK-ERR',
        todoId: 'TODO-ERR',
        error: 'boom',
      })
    );
  });
});
