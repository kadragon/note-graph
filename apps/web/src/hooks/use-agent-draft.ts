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

  const generate = useCallback(
    async (data: AIGenerateDraftRequest): Promise<AIGenerateDraftResponse | null> => {
      setIsPending(true);
      setProgress([]);
      abortRef.current = false;

      try {
        const result = await API.generateAgentDraft(data, (event) => {
          if (!abortRef.current) {
            setProgress((prev) => [...prev, event]);
          }
        });
        return result;
      } catch (error) {
        if (!abortRef.current) {
          toast({
            variant: 'destructive',
            title: '오류',
            description:
              error instanceof Error ? error.message : 'AI 에이전트 초안 생성에 실패했습니다.',
          });
        }
        return null;
      } finally {
        setIsPending(false);
      }
    },
    [toast]
  );

  const reset = useCallback(() => {
    abortRef.current = true;
    setProgress([]);
    setIsPending(false);
  }, []);

  return { generate, reset, progress, isPending };
}
