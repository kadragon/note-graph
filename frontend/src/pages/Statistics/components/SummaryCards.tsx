// Trace: SPEC-stats-1, TASK-048
/**
 * Summary statistics cards displaying key metrics
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, CheckCircle2, Target } from 'lucide-react';

interface SummaryCardsProps {
  totalWorkNotes: number;
  totalCompletedTodos: number;
  completionRate: number;
}

export function SummaryCards({
  totalWorkNotes,
  totalCompletedTodos,
  completionRate,
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">총 업무노트 수</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalWorkNotes.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">
            완료된 할일이 있는 업무노트
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">완료된 할일 수</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalCompletedTodos.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground mt-1">
            완료 상태의 할일
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">할일 완료율</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{completionRate.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground mt-1">
            전체 할일 대비 완료율
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
