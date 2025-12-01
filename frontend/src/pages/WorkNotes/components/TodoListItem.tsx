// Trace: SPEC-todo-2, PR#121 review feedback - extract reusable todo item component
import { Pencil, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TODO_STATUS } from '@/constants/todoStatus';
import { cn, formatDateWithYear, preserveLineBreaksForMarkdown } from '@/lib/utils';
import type { Todo, TodoStatus } from '@/types/api';

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeSanitize, rehypeHighlight];

interface TodoListItemProps {
  todo: Todo;
  onToggle: (todoId: string, currentStatus: TodoStatus) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todoId: string) => void;
  togglePending?: boolean;
  deletePending?: boolean;
}

export function TodoListItem({
  todo,
  onToggle,
  onEdit,
  onDelete,
  togglePending = false,
  deletePending = false,
}: TodoListItemProps) {
  const isCompleted = todo.status === TODO_STATUS.COMPLETED;
  const isNonToggleable =
    todo.status === TODO_STATUS.ON_HOLD || todo.status === TODO_STATUS.STOPPED;
  const descriptionWithBreaks = todo.description
    ? preserveLineBreaksForMarkdown(todo.description)
    : '';

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 border rounded-md hover:bg-accent/50 transition-colors',
        isCompleted && 'opacity-60'
      )}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={() => onToggle(todo.id, todo.status)}
        disabled={togglePending || isNonToggleable}
        title={isNonToggleable ? '보류/중단 상태는 체크박스로 변경할 수 없습니다' : undefined}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            'text-base font-semibold leading-snug',
            isCompleted && 'line-through text-muted-foreground'
          )}
        >
          {todo.title}
        </p>
        {todo.description && (
          <div className="mt-1 text-xs text-muted-foreground leading-snug break-words">
            <div className="[&>*]:m-0 [&>p]:mb-1">
              <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
                {descriptionWithBreaks}
              </ReactMarkdown>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-1">
          <Badge variant={isCompleted ? 'secondary' : 'default'} className="text-xs">
            {todo.status}
          </Badge>
          {isCompleted ? (
            <Badge variant="outline" className="text-xs">
              완료: {formatDateWithYear(todo.updatedAt)}
            </Badge>
          ) : (
            <>
              {todo.waitUntil && (
                <Badge variant="outline" className="text-xs">
                  대기: {formatDateWithYear(todo.waitUntil)}
                </Badge>
              )}
              {todo.dueDate && (
                <Badge variant="outline" className="text-xs">
                  마감: {formatDateWithYear(todo.dueDate)}
                </Badge>
              )}
            </>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onEdit(todo)}
        className="h-8 w-8 p-0 shrink-0"
      >
        <Pencil className="h-3 w-3" />
        <span className="sr-only">수정</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(todo.id)}
        disabled={deletePending}
        className="h-8 w-8 p-0 shrink-0 text-destructive hover:text-destructive"
      >
        <Trash2 className="h-3 w-3" />
        <span className="sr-only">삭제</span>
      </Button>
    </div>
  );
}
