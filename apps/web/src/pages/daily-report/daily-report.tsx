/**
 * Daily report page - AI-generated daily analysis
 */

import { Button } from '@web/components/ui/button';
import {
  useDailyReport,
  useDailyReports,
  useGenerateDailyReport,
} from '@web/hooks/use-daily-report';
import type { DailyReport as DailyReportType } from '@web/types/api';
import {
  AlertTriangle,
  ArrowLeftRight,
  Calendar,
  CheckSquare,
  Clock,
  ListOrdered,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
} from 'lucide-react';
import { useState } from 'react';
import { ReportSection } from './components/report-section';

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function DailyReport() {
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const { data: report, isLoading, error } = useDailyReport(selectedDate);
  const { data: recentReports } = useDailyReports();
  const generateMutation = useGenerateDailyReport();

  const handleGenerate = () => {
    generateMutation.mutate(selectedDate);
  };

  return (
    <div className="page-container space-y-6">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">일일 리포트</h1>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {report ? '리포트 재생성' : '리포트 생성'}
            </Button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && !report && (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <Sparkles className="mx-auto mb-4 h-12 w-12" />
          <p className="text-lg font-medium mb-2">{selectedDate}의 리포트가 없습니다</p>
          <p className="text-sm mb-4">
            &quot;리포트 생성&quot; 버튼을 클릭하여 AI 분석 리포트를 생성하세요.
          </p>
        </div>
      )}

      {report && <ReportContent report={report} />}

      {recentReports && recentReports.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">최근 리포트</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
            {recentReports.map((r) => (
              <button
                type="button"
                key={r.reportId}
                onClick={() => setSelectedDate(r.reportDate)}
                className={`rounded-md border p-3 text-left text-sm transition-colors hover:bg-accent ${
                  r.reportDate === selectedDate ? 'border-primary bg-accent' : 'border-border'
                }`}
              >
                <div className="font-medium">{r.reportDate}</div>
                <div className="mt-1 text-xs text-muted-foreground truncate">
                  {r.aiAnalysis.actionItems?.[0] || '분석 완료'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportContent({ report }: { report: DailyReportType }) {
  const { aiAnalysis } = report;
  const todayTodos = Array.isArray(report.todosSnapshot?.today) ? report.todosSnapshot.today : [];
  const backlogTodos = Array.isArray(report.todosSnapshot?.backlog)
    ? report.todosSnapshot.backlog
    : [];
  const upcomingTodos = Array.isArray(report.todosSnapshot?.upcoming)
    ? report.todosSnapshot.upcoming
    : [];
  const hasSourceTodos =
    todayTodos.length > 0 || backlogTodos.length > 0 || upcomingTodos.length > 0;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <ReportSection title="오늘 탭 기준 할일" icon={CheckSquare}>
          {hasSourceTodos ? (
            <div className="space-y-4">
              <TodoSnapshotList
                title="오늘 탭 전체"
                items={todayTodos}
                emptyMessage="오늘 탭 기준 할일 없음"
              />
              {backlogTodos.length > 0 && (
                <TodoSnapshotList title="밀린 항목" items={backlogTodos} />
              )}
              {upcomingTodos.length > 0 && (
                <TodoSnapshotList title="다가오는 할일" items={upcomingTodos} />
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">참고한 할일 정보가 없습니다.</p>
          )}
        </ReportSection>
      </div>

      {/* Schedule Summary */}
      <ReportSection title="오늘의 요약" icon={Calendar}>
        <p className="text-sm leading-relaxed">{aiAnalysis.scheduleSummary}</p>
      </ReportSection>

      {/* Progress vs Previous */}
      <ReportSection title="전일 대비 진행상황" icon={ArrowLeftRight}>
        <p className="text-sm leading-relaxed">{aiAnalysis.progressVsPrevious}</p>
      </ReportSection>

      {/* Todo Priorities */}
      <ReportSection title="할일 우선순위 제안" icon={ListOrdered}>
        {aiAnalysis.todoPriorities.length > 0 ? (
          <ol className="space-y-2">
            {[...aiAnalysis.todoPriorities]
              .sort((a, b) => a.suggestedOrder - b.suggestedOrder)
              .map((item) => (
                <li key={`${item.suggestedOrder}-${item.todoTitle}`} className="flex gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {item.suggestedOrder}
                  </span>
                  <div>
                    <span className="font-medium">{item.todoTitle}</span>
                    <p className="text-xs text-muted-foreground">{item.reason}</p>
                  </div>
                </li>
              ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">우선순위 제안 없음</p>
        )}
      </ReportSection>

      {/* Time Allocation */}
      <ReportSection title="시간 배분 제안" icon={Clock}>
        {aiAnalysis.timeAllocation.length > 0 ? (
          <div className="space-y-2">
            {aiAnalysis.timeAllocation.map((item) => (
              <div key={`${item.timeBlock}-${item.activity}`} className="flex gap-3 text-sm">
                <span className="shrink-0 font-mono text-xs text-muted-foreground w-24">
                  {item.timeBlock}
                </span>
                <div>
                  <span className="font-medium">{item.activity}</span>
                  <p className="text-xs text-muted-foreground">{item.reason}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">시간 배분 제안 없음</p>
        )}
      </ReportSection>

      {/* Conflicts */}
      {aiAnalysis.conflicts.length > 0 && (
        <ReportSection title="주의사항 / 충돌 감지" icon={AlertTriangle} variant="warning">
          <div className="space-y-3">
            {aiAnalysis.conflicts.map((item) => (
              <div key={item.description} className="text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400">{item.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <RefreshCw className="mr-1 inline h-3 w-3" />
                  {item.suggestion}
                </p>
              </div>
            ))}
          </div>
        </ReportSection>
      )}

      {/* Action Items */}
      <ReportSection title="핵심 실행 항목" icon={Target}>
        {aiAnalysis.actionItems.length > 0 ? (
          <ul className="space-y-2">
            {aiAnalysis.actionItems.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">실행 항목 없음</p>
        )}
      </ReportSection>
    </div>
  );
}

function TodoSnapshotList({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: Array<{ id: string; title: string; dueDate?: string | null; status: string }>;
  emptyMessage?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={`${title}-${item.id}`}
              className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm"
            >
              <div className="font-medium">{item.title}</div>
              <div className="text-xs text-muted-foreground">
                [{item.status}] {formatTodoDueDate(item.dueDate)}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyMessage ?? '항목 없음'}</p>
      )}
    </div>
  );
}

function formatTodoDueDate(dueDate?: string | null) {
  if (!dueDate) {
    return '기한 없음';
  }

  return `기한: ${dueDate.split('T')[0]}`;
}
