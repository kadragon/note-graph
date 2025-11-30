// Trace: SPEC-stats-1, TASK-048
/**
 * Statistics dashboard page
 */

import { Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStatistics } from './hooks/useStatistics';
import { SummaryCards } from './components/SummaryCards';
import { DistributionCharts } from './components/DistributionCharts';
import { WorkNotesTable } from './components/WorkNotesTable';
import {
  getStatisticsPeriodLabel,
  formatDateRange,
  getAvailableYears,
  type StatisticsPeriod,
} from '@/lib/date-utils';

const PERIOD_TABS: { value: StatisticsPeriod; label: string }[] = [
  { value: 'this-week', label: '이번주' },
  { value: 'this-month', label: '이번달' },
  { value: 'first-half', label: '1~6월' },
  { value: 'second-half', label: '7~12월' },
  { value: 'this-year', label: '올해' },
  { value: 'last-week', label: '직전주' },
];

export default function Statistics() {
  const {
    period,
    setPeriod,
    year,
    setYear,
    dateRange,
    statistics,
    isLoading,
    error,
  } = useStatistics();

  const availableYears = getAvailableYears();
  const needsYearSelector = period === 'first-half' || period === 'second-half';

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">통계 대시보드</h1>
        <p className="text-muted-foreground mt-2">
          완료된 할일을 포함한 업무노트 통계
        </p>
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
            <Select value={year.toString()} onValueChange={(value) => setYear(parseInt(value))}>
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
          <DistributionCharts
            byCategory={statistics.distributions.byCategory}
            byPerson={statistics.distributions.byPerson}
            byDepartment={statistics.distributions.byDepartment}
          />

          {/* Work Notes Table */}
          <WorkNotesTable workNotes={statistics.workNotes} />
        </div>
      )}
    </div>
  );
}
