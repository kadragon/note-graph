export interface DailyReportAIAnalysis {
  scheduleSummary: string;
  todoPriorities: Array<{
    todoTitle: string;
    reason: string;
    suggestedOrder: number;
  }>;
  timeAllocation: Array<{
    timeBlock: string;
    activity: string;
    reason: string;
  }>;
  conflicts: Array<{
    description: string;
    suggestion: string;
  }>;
  progressVsPrevious: string;
  actionItems: string[];
}

export interface DailyReport {
  reportId: string;
  reportDate: string;
  calendarSnapshot: Array<{
    id: string;
    summary: string;
    description?: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
    htmlLink: string;
  }>;
  todosSnapshot: {
    today: Array<{ id: string; title: string; dueDate?: string | null; status: string }>;
    upcoming: Array<{ id: string; title: string; dueDate?: string | null; status: string }>;
    backlog: Array<{ id: string; title: string; dueDate?: string | null; status: string }>;
  };
  aiAnalysis: DailyReportAIAnalysis;
  previousReportId: string | null;
  createdAt: string;
  updatedAt: string;
}
