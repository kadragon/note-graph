import { Badge } from '@/components/ui/badge';
import type { RAGSource } from '@/types/api';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  contexts?: RAGSource[];
}

export function ChatMessage({ role, content, contexts }: ChatMessageProps) {
  return (
    <div
      className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{content}</p>
        {contexts && contexts.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-xs font-semibold mb-2 opacity-70">출처:</p>
            <div className="space-y-1">
              {contexts.map((context, idx) => (
                <div key={idx} className="text-xs opacity-80">
                  <span className="font-medium">{context.title}</span>
                  <Badge
                    variant="outline"
                    className="ml-2 text-[10px] h-4 px-1"
                  >
                    {(context.score * 100).toFixed(0)}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
