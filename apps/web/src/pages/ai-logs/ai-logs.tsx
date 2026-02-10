import { Badge } from '@web/components/ui/badge';
import { Button } from '@web/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@web/components/ui/card';
import { Input } from '@web/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@web/components/ui/table';
import { format, parseISO } from 'date-fns';
import { Loader2, RefreshCw } from 'lucide-react';
import { useAIGatewayLogs } from './hooks/use-ai-gateway-logs';

function formatDateTime(value: string): string {
  try {
    return format(parseISO(value), 'yyyy-MM-dd HH:mm:ss');
  } catch {
    return value;
  }
}

function renderNullableNumber(value: number | null): string {
  return value === null ? '-' : value.toString();
}

export default function AILogs() {
  const {
    logs,
    pagination,
    isLoading,
    isFetching,
    error,
    searchInput,
    startDateInput,
    endDateInput,
    perPage,
    setSearchInput,
    setStartDateInput,
    setEndDateInput,
    setPerPage,
    applyFilters,
    refresh,
    canGoPrev,
    canGoNext,
    goPrev,
    goNext,
  } = useAIGatewayLogs();

  return (
    <div className="page-container space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI 로그</h1>
          <p className="page-description">Cloudflare AI Gateway 요청 메타데이터 조회</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>필터</CardTitle>
          <CardDescription>기본 조회 구간은 최근 24시간입니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="검색어 (provider, path, model 등)"
              aria-label="로그 검색어"
            />
            <Input
              type="datetime-local"
              value={startDateInput}
              onChange={(event) => setStartDateInput(event.target.value)}
              aria-label="시작 시각"
            />
            <Input
              type="datetime-local"
              value={endDateInput}
              onChange={(event) => setEndDateInput(event.target.value)}
              aria-label="종료 시각"
            />
            <Input
              type="number"
              min={1}
              max={100}
              value={perPage}
              onChange={(event) =>
                setPerPage(Math.min(100, Math.max(1, Number(event.target.value) || 1)))
              }
              aria-label="페이지당 개수"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={applyFilters}>조회</Button>
            <Button
              variant="outline"
              onClick={() => void refresh()}
              disabled={isFetching}
              aria-label="새로고침"
            >
              {isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              새로고침
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && !isLoading && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>로그 목록</CardTitle>
          <CardDescription>
            {pagination.totalCount}건 중 {pagination.count}건 표시
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              조회 조건에 해당하는 로그가 없습니다.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>createdAt</TableHead>
                  <TableHead>provider</TableHead>
                  <TableHead>path</TableHead>
                  <TableHead>requestType</TableHead>
                  <TableHead className="text-right">statusCode</TableHead>
                  <TableHead>success</TableHead>
                  <TableHead className="text-right">tokensIn</TableHead>
                  <TableHead className="text-right">tokensOut</TableHead>
                  <TableHead>event</TableHead>
                  <TableHead>cached</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell>{log.provider ?? '-'}</TableCell>
                    <TableCell className="max-w-[280px] truncate" title={log.path ?? ''}>
                      {log.path ?? '-'}
                    </TableCell>
                    <TableCell>{log.requestType ?? '-'}</TableCell>
                    <TableCell className="text-right">
                      {renderNullableNumber(log.statusCode)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.success ? 'default' : 'destructive'}>
                        {log.success ? 'true' : 'false'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {renderNullableNumber(log.tokensIn)}
                    </TableCell>
                    <TableCell className="text-right">
                      {renderNullableNumber(log.tokensOut)}
                    </TableCell>
                    <TableCell>{log.event ?? '-'}</TableCell>
                    <TableCell>
                      {log.cached === null ? '-' : log.cached ? 'true' : 'false'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              페이지 {pagination.page} / {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={goPrev} disabled={!canGoPrev || isFetching}>
                이전
              </Button>
              <Button variant="outline" onClick={goNext} disabled={!canGoNext || isFetching}>
                다음
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
