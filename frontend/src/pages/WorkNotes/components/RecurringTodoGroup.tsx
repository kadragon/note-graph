// Trace: SPEC-todo-2, TASK-052
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useState } from 'react';
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
import type { RecurringTodoGroup as RecurringTodoGroupType } from './groupRecurringTodos';

// Repeat rule to Korean label mapping
const REPEAT_RULE_LABELS: Record<string, string> = {
  DAILY: '매일',
  WEEKLY: '매주',
  MONTHLY: '매월',
};

const getRepeatRuleLabel = (repeatRule: string): string => {
  return REPEAT_RULE_LABELS[repeatRule] ?? repeatRule;
};

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeSanitize, rehypeHighlight];

interface RecurringTodoGroupProps {
  group: RecurringTodoGroupType;
  onToggleTodo: (todoId: string, currentStatus: TodoStatus) => void;
  onEditTodo: (todo: Todo) => void;
  onDeleteTodo: (todoId: string) => void;
  togglePending: boolean;
  deletePending: boolean;
}

export function RecurringTodoGroup({
  group,
  onToggleTodo,
  onEditTodo,
  onDeleteTodo,
  togglePending,
  deletePending,
}: RecurringTodoGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Count completed vs total
  const completedCount = group.todos.filter((t) => t.status === TODO_STATUS.COMPLETED).length;
  const totalCount = group.todos.length;

  // Get the most recent incomplete todo (or first if all completed)
  const activeTodo = group.todos.find((t) => t.status !== TODO_STATUS.COMPLETED) || group.todos[0];

  return (
    <div className="border rounded-md">
      {/* Group Header - Collapsed View */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-semibold">{group.title}</p>
            <Badge variant="outline" className="gap-1 text-xs">
              <RefreshCw className="h-3 w-3" />
              {getRepeatRuleLabel(group.repeatRule)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {totalCount}개 ({completedCount}개 완료)
            </span>
          </div>
          {!isExpanded && activeTodo.dueDate && (
            <p className="text-xs text-muted-foreground mt-1">
              다음 마감: {formatDateWithYear(activeTodo.dueDate)}
            </p>
          )}
        </div>
      </button>

      {/* Expanded View - Show all instances */}
      {isExpanded && (
        <div className="border-t divide-y">
          {group.todos.map((todo) => {
            const isCompleted = todo.status === TODO_STATUS.COMPLETED;
            const isNonToggleable =
              todo.status === TODO_STATUS.ON_HOLD || todo.status === TODO_STATUS.STOPPED;
            const descriptionWithBreaks = todo.description
              ? preserveLineBreaksForMarkdown(todo.description)
              : '';

            return (
              <div
                key={todo.id}
                className={cn(
                  'flex items-start gap-3 p-3 hover:bg-accent/50 transition-colors',
                  isCompleted && 'opacity-60'
                )}
              >
                <Checkbox
                  checked={isCompleted}
                  onCheckedChange={() => onToggleTodo(todo.id, todo.status)}
                  disabled={togglePending || isNonToggleable}
                  title={
                    isNonToggleable ? '보류/중단 상태는 체크박스로 변경할 수 없습니다' : undefined
                  }
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium leading-snug',
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
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditTodo(todo);
                    }}
                    className="h-8 w-8 p-0"
                    aria-label="수정"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3 w-3"
                      aria-hidden="true"
                    >
                      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTodo(todo.id);
                    }}
                    disabled={deletePending}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    aria-label="삭제"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3 w-3"
                      aria-hidden="true"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
