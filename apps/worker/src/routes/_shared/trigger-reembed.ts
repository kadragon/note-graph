import { WorkNoteService } from '../../services/work-note-service';
import type { AppContext } from '../../types/context';

export function triggerReembed(
  env: AppContext['Bindings'],
  workId: string,
  todoId: string,
  operation: string
): Promise<void> {
  const service = new WorkNoteService(env);
  return service.reembedOnly(workId).catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[WorkNote] Failed to re-embed after todo ${operation}:`, {
      workId,
      todoId,
      error: errorMessage,
    });
  });
}
