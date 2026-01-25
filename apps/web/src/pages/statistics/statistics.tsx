// Trace: SPEC-stats-1, TASK-048, TASK-054
/**
 * Statistics dashboard page
 */

import { useQuery } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@web/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@web/components/ui/tabs';
import { API } from '@web/lib/api';
import {
  formatDateRange,
  getAvailableYears,
  getStatisticsPeriodLabel,
  type StatisticsPeriod,
} from '@web/lib/date-utils';
import { ViewWorkNoteDialog } from '@web/pages/work-notes/components/view-work-note-dialog';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { DistributionCharts } from './components/distribution-charts';
import { SummaryCards } from './components/summary-cards';
import { WorkNotesTable } from './components/work-notes-table';
import { useStatistics } from './hooks/use-statistics';

const PERIOD_TABS: { value: StatisticsPeriod; label: string }[] = [
  { value: 'this-week', label: '이번주' },
  { value: 'this-month', label: '이번달' },
  { value: 'first-half', label: '1~6월' },
  { value: 'second-half', label: '7~12월' },
  { value: 'this-year', label: '올해' },
  { value: 'last-week', label: '직전주' },
];

export default function Statistics() {
  const { period, setPeriod, year, setYear, dateRange, statistics, isLoading, error } =
    useStatistics();

  const [selectedWorkNoteId, setSelectedWorkNoteId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: selectedWorkNote } = useQuery({
    queryKey: ['work-note-detail', selectedWorkNoteId],
    queryFn: () => API.getWorkNote(selectedWorkNoteId!),
    enabled: !!selectedWorkNoteId,
  });

  const handleWorkNoteClick = (workNoteId: string) => {
    setSelectedWorkNoteId(workNoteId);
    setIsDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setSelectedWorkNoteId(null);
    }
  };

  const availableYears = getAvailableYears();
  const needsYearSelector = period === 'first-half' || period === 'second-half';

  return (
    <div className="page-container space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">통계 대시보드</h1>
          <p className="page-description">완료된 할일을 포함한 업무노트 통계</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Period Tabs */}
        <Tabs value={period} onValueChange={(value) => setPeriod(value as StatisticsPeriod)}>
          <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full lg:w-auto">
            {PERIOD_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Year Selector */}
        {needsYearSelector && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">연도:</span>
            <Select value={year.toString()} onValueChange={(value) => setYear(parseInt(value, 10))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}년
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Date Range Display */}
      <div className="text-sm text-muted-foreground">
        조회 기간: {getStatisticsPeriodLabel(period, year)} (
        {formatDateRange(dateRange.startDate, dateRange.endDate)})
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Statistics Content */}
      {!isLoading && !error && statistics && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <SummaryCards
            totalWorkNotes={statistics.summary.totalWorkNotes}
            totalCompletedTodos={statistics.summary.totalCompletedTodos}
            completionRate={statistics.summary.completionRate}
          />

          {/* Distribution Charts */}
          <DistributionCharts byCategory={statistics.distributions.byCategory} />

          {/* Work Notes Table */}
          <WorkNotesTable workNotes={statistics.workNotes} onSelect={handleWorkNoteClick} />
        </div>
      )}

      <ViewWorkNoteDialog
        workNote={selectedWorkNote || null}
        open={isDialogOpen}
        onOpenChange={handleDialogOpenChange}
      />
    </div>
  );
}
