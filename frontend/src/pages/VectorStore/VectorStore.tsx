import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Database,
  RefreshCw,
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { API } from '@/lib/api';
import type { BatchProcessResult } from '@/types/api';

const BATCH_SIZE = 10;

export default function VectorStore() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch embedding stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['embedding-stats'],
    queryFn: () => API.getEmbeddingStats(),
    refetchInterval: 5000, // Auto refresh every 5 seconds
  });

  // Handler factory functions to reduce duplication
  const createSuccessHandler = (title: string) => {
    return (data: { result: BatchProcessResult }) => {
      queryClient.invalidateQueries({ queryKey: ['embedding-stats'] });
      toast({
        title,
        description: `처리: ${data.result.processed}, 성공: ${data.result.succeeded}, 실패: ${data.result.failed}`,
      });
    };
  };

  const createErrorHandler = (title: string) => {
    return (error: Error) => {
      toast({
        title,
        description: error.message,
        variant: 'destructive',
      });
    };
  };

  // Embed pending mutation
  const embedPendingMutation = useMutation({
    mutationFn: () => API.embedPending(BATCH_SIZE),
    onSuccess: createSuccessHandler('임베딩 완료'),
    onError: createErrorHandler('임베딩 실패'),
  });

  // Reindex all mutation
  const reindexAllMutation = useMutation({
    mutationFn: () => API.reindexAll(BATCH_SIZE),
    onSuccess: createSuccessHandler('전체 재인덱싱 완료'),
    onError: createErrorHandler('재인덱싱 실패'),
  });

  const isProcessing = embedPendingMutation.isPending || reindexAllMutation.isPending;

  // Simplified percentage calculation
  const total = stats?.total ?? 0;
  const embedded = stats?.embedded ?? 0;
  const embeddingPercentage = total > 0 ? Math.round((embedded / total) * 100) : 0;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="page-title">벡터 스토어 관리</h1>
        <p className="page-description">업무노트 임베딩 현황을 확인하고 관리합니다</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 업무노트</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">임베딩 완료</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">{stats?.embedded ?? 0}</div>
                <p className="text-xs text-muted-foreground">
                  {embeddingPercentage}% 완료
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">임베딩 대기</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold text-yellow-600">{stats?.pending ?? 0}</div>
                {(stats?.pending ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    처리 필요
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      {stats && stats.total > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm font-medium">임베딩 진행률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-muted rounded-full h-4">
              <div
                className="bg-primary h-4 rounded-full transition-all duration-500"
                style={{ width: `${embeddingPercentage}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {stats.embedded} / {stats.total} ({embeddingPercentage}%)
            </p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>작업</CardTitle>
          <CardDescription>
            벡터 스토어 임베딩 작업을 실행합니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button
              onClick={() => embedPendingMutation.mutate()}
              disabled={isProcessing || (stats?.pending ?? 0) === 0}
              className="flex-1"
            >
              {embedPendingMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              미완료 임베딩 처리
            </Button>

            <Button
              onClick={() => reindexAllMutation.mutate()}
              disabled={isProcessing}
              variant="outline"
              className="flex-1"
            >
              {reindexAllMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              전체 재인덱싱
            </Button>
          </div>

          {(stats?.pending ?? 0) > 0 && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  {stats?.pending}개의 업무노트가 임베딩 대기 중입니다
                </p>
                <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                  "미완료 임베딩 처리" 버튼을 클릭하여 벡터 스토어에 저장하세요.
                </p>
              </div>
            </div>
          )}

          {stats && stats.pending === 0 && stats.total > 0 && (
            <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-green-800 dark:text-green-200">
                  모든 업무노트가 벡터화되었습니다
                </p>
                <p className="text-green-700 dark:text-green-300 mt-1">
                  AI 검색 및 챗봇에서 모든 업무노트를 활용할 수 있습니다.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
