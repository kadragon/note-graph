// Todo types (Frontend View Model)
export type TodoStatus = '진행중' | '완료' | '보류' | '중단';
export type TodoView = 'today' | 'week' | 'month' | 'remaining' | 'completed' | 'backlog' | 'all';
export type RepeatRule = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
export type RecurrenceType = 'DUE_DATE' | 'COMPLETION_DATE';
export type CustomIntervalUnit = 'DAY' | 'WEEK' | 'MONTH';

export interface Todo {
  id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  dueDate?: string;
  waitUntil?: string;
  repeatRule?: RepeatRule;
  recurrenceType?: RecurrenceType;
  customInterval?: number;
  customUnit?: CustomIntervalUnit;
  skipWeekends?: boolean;
  workNoteId?: string;
  workTitle?: string;
  workCategory?: string;
  createdAt: string;
  updatedAt: string;
}
