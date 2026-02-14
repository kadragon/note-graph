import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';

import { useToast } from '@web/hooks/use-toast';
import { invalidateMany } from '@web/lib/query-invalidation';

type InvalidateKeysStatic = readonly QueryKey[];
type InvalidateKeysFn<TData, TVariables> = (
  data: TData,
  variables: TVariables
) => readonly QueryKey[];

export interface StandardMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidateKeys: InvalidateKeysStatic | InvalidateKeysFn<TData, TVariables>;
  messages: {
    success: string;
    error: string;
  };
}

export function createStandardMutation<TData, TVariables>(
  options: StandardMutationOptions<TData, TVariables>
) {
  const { mutationFn, invalidateKeys, messages } = options;

  return function useStandardMutation() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    return useMutation({
      mutationFn,
      onSuccess: (data: TData, variables: TVariables) => {
        const keys =
          typeof invalidateKeys === 'function' ? invalidateKeys(data, variables) : invalidateKeys;

        invalidateMany(queryClient, keys);
        toast({
          title: '성공',
          description: messages.success,
        });
      },
      onError: (error: Error) => {
        toast({
          variant: 'destructive',
          title: '오류',
          description: error.message || messages.error,
        });
      },
    });
  };
}
