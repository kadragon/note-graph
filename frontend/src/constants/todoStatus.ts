import type { TodoStatus } from '@/types/api';

export const TODO_STATUS: Record<string, TodoStatus> = {
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  ON_HOLD: '보류',
  STOPPED: '중단',
} as const;
