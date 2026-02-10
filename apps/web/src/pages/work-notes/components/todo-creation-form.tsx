import { TODO_DESCRIPTION_MAX_LENGTH } from '@shared/types/todo';
import { Button } from '@web/components/ui/button';
import { Checkbox } from '@web/components/ui/checkbox';
import { Input } from '@web/components/ui/input';
import { Label } from '@web/components/ui/label';
import { Textarea } from '@web/components/ui/textarea';
import { useTodoForm } from '@web/hooks/use-todo-form';
import { getCharacterCount, truncateToMaxCharacters } from '@web/lib/character-length';
import type {
  CreateTodoRequest,
  CustomIntervalUnit,
  RecurrenceType,
  RepeatRule,
} from '@web/types/api';

const SELECT_CLASS_NAME =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const REPEAT_RULE_OPTIONS: Array<{ value: RepeatRule; label: string }> = [
  { value: 'NONE', label: '반복 안함' },
  { value: 'DAILY', label: '매일' },
  { value: 'WEEKLY', label: '매주' },
  { value: 'MONTHLY', label: '매월' },
  { value: 'CUSTOM', label: '커스텀' },
];

const CUSTOM_UNIT_OPTIONS: Array<{ value: CustomIntervalUnit; label: string }> = [
  { value: 'DAY', label: '일' },
  { value: 'WEEK', label: '주' },
  { value: 'MONTH', label: '개월' },
];

const RECURRENCE_TYPE_OPTIONS: Array<{ value: RecurrenceType; label: string }> = [
  { value: 'DUE_DATE', label: '마감일 기준' },
  { value: 'COMPLETION_DATE', label: '완료일 기준' },
];

interface TodoCreationFormProps {
  onSubmit: (data: CreateTodoRequest) => void;
  isPending: boolean;
}

export function TodoCreationForm({ onSubmit, isPending }: TodoCreationFormProps) {
  const { values, setField, isValid, getData } = useTodoForm();
  const descriptionLength = getCharacterCount(values.description);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onSubmit(getData());
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 p-3 border rounded-md space-y-3">
      <div className="grid gap-2">
        <Label htmlFor="todo-title">할일 제목</Label>
        <Input
          id="todo-title"
          value={values.title}
          onChange={(e) => setField('title', e.target.value)}
          placeholder="할일을 입력하세요"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="todo-description">설명 (선택사항)</Label>
        <Textarea
          id="todo-description"
          value={values.description}
          onChange={(e) =>
            setField(
              'description',
              truncateToMaxCharacters(e.target.value, TODO_DESCRIPTION_MAX_LENGTH)
            )
          }
          placeholder="상세 설명"
          className="min-h-[80px]"
        />
        <p className="text-xs text-muted-foreground text-right">
          {descriptionLength}/{TODO_DESCRIPTION_MAX_LENGTH}
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="todo-wait-until">대기일 (선택사항)</Label>
        <Input
          id="todo-wait-until"
          type="date"
          value={values.waitUntil}
          onChange={(e) => setField('waitUntil', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">이 날짜까지 대시보드에서 숨겨집니다.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="todo-due-date">마감일 (선택사항)</Label>
        <Input
          id="todo-due-date"
          type="date"
          value={values.dueDate}
          onChange={(e) => setField('dueDate', e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="todo-repeat-rule">반복 설정</Label>
        <select
          id="todo-repeat-rule"
          value={values.repeatRule}
          onChange={(e) => setField('repeatRule', e.target.value as RepeatRule)}
          className={SELECT_CLASS_NAME}
        >
          {REPEAT_RULE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {values.repeatRule === 'CUSTOM' && (
        <div className="grid gap-2">
          <Label>커스텀 반복 간격</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              max={365}
              value={values.customInterval}
              onChange={(e) => setField('customInterval', parseInt(e.target.value, 10) || 1)}
              className="w-20"
            />
            <select
              value={values.customUnit}
              onChange={(e) => setField('customUnit', e.target.value as CustomIntervalUnit)}
              className={SELECT_CLASS_NAME}
            >
              {CUSTOM_UNIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="flex items-center text-sm text-muted-foreground">마다</span>
          </div>
        </div>
      )}
      {values.repeatRule !== 'NONE' && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="todo-skip-weekends"
            checked={values.skipWeekends}
            onCheckedChange={(checked) => setField('skipWeekends', checked === true)}
          />
          <Label htmlFor="todo-skip-weekends" className="text-sm font-normal cursor-pointer">
            주말 제외 (토/일요일은 다음 월요일로)
          </Label>
        </div>
      )}
      {values.repeatRule !== 'NONE' && (
        <div className="grid gap-2">
          <Label htmlFor="todo-recurrence-type">반복 기준</Label>
          <select
            id="todo-recurrence-type"
            value={values.recurrenceType}
            onChange={(e) => setField('recurrenceType', e.target.value as RecurrenceType)}
            className={SELECT_CLASS_NAME}
          >
            {RECURRENCE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {values.recurrenceType === 'DUE_DATE'
              ? '다음 할일은 현재 마감일을 기준으로 생성됩니다.'
              : '다음 할일은 완료한 날짜를 기준으로 생성됩니다.'}
          </p>
        </div>
      )}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? '추가 중...' : '추가'}
      </Button>
    </form>
  );
}
