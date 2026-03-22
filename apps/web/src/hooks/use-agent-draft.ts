import { useToast } from '@web/hooks/use-toast';
import { API } from '@web/lib/api';
import type {
  AgentProgressEvent,
  AIGenerateDraftRequest,
  AIGenerateDraftResponse,
} from '@web/types/api';
import { useCallback, useRef, useState } from 'react';

export function useAgentDraft() {
  const { toast } = useToast();
  const [progress, setProgress] = useState<AgentProgressEvent[]>([]);
  const [isPending, setIsPending] = useState(false);
  const abortRef = useRef(false);

  const onProgress = useCallback((event: AgentProgressEvent) => {
    if (!abortRef.current) {
      setProgress((prev) => [...prev, event]);
    }
  }, []);

  const handleError = useCallback(
    (error: unknown) => {
      if (!abortRef.current) {
        toast({
          variant: 'destructive',
          title: '오류',
          description:
            error instanceof Error ? error.message : 'AI 에이전트 초안 생성에 실패했습니다.',
        });
      }
    },
    [toast]
  );

  const generate = useCallback(
    async (data: AIGenerateDraftRequest): Promise<AIGenerateDraftResponse | null> => {
      setIsPending(true);
      setProgress([]);
      abortRef.current = false;

      try {
        return await API.generateAgentDraft(data, onProgress);
      } catch (error) {
        handleError(error);
        return null;
      } finally {
        setIsPending(false);
      }
    },
    [onProgress, handleError]
  );

  const generateFromPDF = useCallback(
    async (
      file: File,
      metadata?: { category?: string; personIds?: string[]; deptName?: string }
    ): Promise<AIGenerateDraftResponse | null> => {
      setIsPending(true);
      setProgress([]);
      abortRef.current = false;

      try {
        return await API.generateAgentDraftFromPDF(file, metadata, onProgress);
      } catch (error) {
        handleError(error);
        return null;
      } finally {
        setIsPending(false);
      }
    },
    [onProgress, handleError]
  );

  const reset = useCallback(() => {
    abortRef.current = true;
    setProgress([]);
    setIsPending(false);
  }, []);

  return { generate, generateFromPDF, reset, progress, isPending };
}
