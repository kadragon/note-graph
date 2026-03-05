import type { SettingService } from '../../services/setting-service';
import { WorkNoteService } from '../../services/work-note-service';
import type { AppContext } from '../../types/context';
import type { DatabaseClient } from '../../types/database';

export function triggerReembed(
  db: DatabaseClient,
  env: AppContext['Bindings'],
  workId: string,
  todoId: string,
  operation: string,
  settingService?: SettingService
): Promise<void> {
  const service = new WorkNoteService(db, env, settingService);
  return service.reembedOnly(workId).catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[WorkNote] Failed to re-embed after todo ${operation}:`, {
      workId,
      todoId,
      error: errorMessage,
    });
  });
}
