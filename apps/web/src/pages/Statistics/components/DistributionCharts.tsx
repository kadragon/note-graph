// Trace: SPEC-stats-1, TASK-048, TASK-054
/**
 * Distribution chart for category statistics
 */

import { Card, CardContent, CardHeader, CardTitle } from '@web/components/ui/card';
import type { CategoryDistribution } from '@web/types/api';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface DistributionChartsProps {
  byCategory: CategoryDistribution[];
}

export function DistributionCharts({ byCategory }: DistributionChartsProps) {
  // Prepare data for chart
  const categoryData = byCategory.map((item) => ({
    name: item.categoryName || '미분류',
    count: item.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>카테고리별 분포</CardTitle>
      </CardHeader>
      <CardContent>
        {categoryData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} interval={0} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--chart-1))" name="업무노트 수" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            데이터가 없습니다
          </div>
        )}
      </CardContent>
    </Card>
  );
}
