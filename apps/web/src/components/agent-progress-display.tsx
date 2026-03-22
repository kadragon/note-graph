import type { AgentProgressEvent } from '@web/types/api';
import { Check, Loader2 } from 'lucide-react';

export function AgentProgressDisplay({ events }: { events: AgentProgressEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        <span className="text-sm font-medium">입력 텍스트를 분석하고 있습니다...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 py-2">
      {events.map((event, index) => {
        const isLatest = index === events.length - 1;
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only list, never reorders
            key={index}
            className="flex items-center gap-2 transition-all duration-300"
          >
            {isLatest ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            ) : (
              <Check className="h-4 w-4 text-green-500 shrink-0" />
            )}
            <span className={isLatest ? 'text-sm font-medium' : 'text-sm text-muted-foreground'}>
              {event.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}
