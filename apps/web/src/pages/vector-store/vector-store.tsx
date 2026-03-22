import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@web/components/ui/alert-dialog';
import { Button } from '@web/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@web/components/ui/card';
import { useToast } from '@web/hooks/use-toast';
import { API } from '@web/lib/api';
import type { BatchProcessResult } from '@web/types/api';
import { AlertCircle, CheckCircle2, Clock, Database, Loader2, Play, RefreshCw } from 'lucide-react';

const BATCH_SIZE = 10;

export default function VectorStore({ embedded: isEmbedded = false }: { embedded?: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch embedding stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['embedding-stats'],
    queryFn: () => API.getEmbeddingStats(),
    // Only poll when there are pending embeddings
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.workNotes.pending === 0 && data.meetings.pending === 0) {
        return false;
      }
      return 5000; // Poll every 5 seconds when pending > 0
    },
  });

  // Handler factory functions to reduce duplication
  const createSuccessHandler = (title: string) => {
    return (data: { result: BatchProcessResult }) => {
      void queryClient.invalidateQueries({ queryKey: ['embedding-stats'] });
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

  // Aggregate stats across work notes and meetings
  const total = (stats?.workNotes.total ?? 0) + (stats?.meetings.total ?? 0);
  const embedded = (stats?.workNotes.embedded ?? 0) + (stats?.meetings.embedded ?? 0);
  const pending = (stats?.workNotes.pending ?? 0) + (stats?.meetings.pending ?? 0);
  const embeddingPercentage = total > 0 ? Math.round((embedded / total) * 100) : 0;

  return (
    <div className={isEmbedded ? undefined : 'page-container'}>
      {!isEmbedded && (
        <div>
          <h1 className="page-title">벡터 스토어 관리</h1>
          <p className="page-description">업무노트 및 회의록 임베딩 현황을 확인하고 관리합니다</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 문서</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                <div className="text-2xl font-bold">{total}</div>
                <p className="text-xs text-muted-foreground">
                  업무노트 {stats?.workNotes.total ?? 0} / 회의록 {stats?.meetings.total ?? 0}
                </p>
              </>
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
                <div className="text-2xl font-bold text-green-600">{embedded}</div>
                <p className="text-xs text-muted-foreground">{embeddingPercentage}% 완료</p>
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
                <div className="text-2xl font-bold text-yellow-600">{pending}</div>
                {pending > 0 && <p className="text-xs text-muted-foreground">처리 필요</p>}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      {stats && total > 0 && (
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
              {embedded} / {total} ({embeddingPercentage}%)
            </p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>작업</CardTitle>
          <CardDescription>벡터 스토어 임베딩 작업을 실행합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button
              onClick={() => embedPendingMutation.mutate()}
              disabled={isProcessing || pending === 0}
              className="flex-1"
            >
              {embedPendingMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              미완료 임베딩 처리
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={isProcessing} variant="outline" className="flex-1">
                  {reindexAllMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  전체 재인덱싱
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>전체 재인덱싱</AlertDialogTitle>
                  <AlertDialogDescription>
                    모든 문서를 다시 임베딩합니다. 이 작업은 시간이 오래 걸릴 수 있습니다.
                    {stats && total > 0 && (
                      <span className="block mt-2 font-medium">
                        총 {total}개의 문서가 재인덱싱됩니다.
                      </span>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={() => reindexAllMutation.mutate()}>
                    재인덱싱 시작
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {pending > 0 && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">
                  {pending}개의 문서가 임베딩 대기 중입니다
                </p>
                <p className="text-yellow-700 mt-1">
                  5분마다 자동 처리됩니다. 즉시 처리하려면 "미완료 임베딩 처리" 버튼을 클릭하세요.
                </p>
              </div>
            </div>
          )}

          {stats && pending === 0 && total > 0 && (
            <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-green-800">모든 문서가 벡터화되었습니다</p>
                <p className="text-green-700 mt-1">
                  AI 검색에서 업무노트와 회의록을 모두 활용할 수 있습니다.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
