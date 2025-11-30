// Trace: SPEC-stats-1, TASK-048
/**
 * Distribution charts for category, person, and department statistics
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type {
  CategoryDistribution,
  PersonDistribution,
  DepartmentDistribution,
} from '@/types/api';

interface DistributionChartsProps {
  byCategory: CategoryDistribution[];
  byPerson: PersonDistribution[];
  byDepartment: DepartmentDistribution[];
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function DistributionCharts({
  byCategory,
  byPerson,
  byDepartment,
}: DistributionChartsProps) {
  // Prepare data for charts
  const categoryData = byCategory.map((item) => ({
    name: item.category || '미분류',
    count: item.count,
  }));

  const personData = byPerson.map((item) => ({
    name: `${item.personName}${item.currentDept ? ` (${item.currentDept})` : ''}`,
    count: item.count,
  }));

  const departmentData = byDepartment.map((item) => ({
    name: item.deptName || '미지정',
    count: item.count,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Category Distribution - Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>카테고리별 분포</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis />
                <Tooltip />
                <Legend />
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

      {/* Person Distribution - Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>담당자별 분포</CardTitle>
        </CardHeader>
        <CardContent>
          {personData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={personData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="hsl(var(--chart-2))" name="업무노트 수" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              데이터가 없습니다
            </div>
          )}
        </CardContent>
      </Card>

      {/* Department Distribution - Pie Chart */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>부서별 분포</CardTitle>
        </CardHeader>
        <CardContent>
          {departmentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={departmentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {departmentData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              데이터가 없습니다
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
