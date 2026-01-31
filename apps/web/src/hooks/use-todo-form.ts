import type {
  CreateTodoRequest,
  CustomIntervalUnit,
  RecurrenceType,
  RepeatRule,
} from '@web/types/api';
import { useCallback, useMemo, useState } from 'react';

const getTodayString = (): string => new Date().toISOString().split('T')[0];

export interface TodoFormValues {
  title: string;
  description: string;
  dueDate: string;
  waitUntil: string;
  repeatRule: RepeatRule;
  recurrenceType: RecurrenceType;
  customInterval: number;
  customUnit: CustomIntervalUnit;
  skipWeekends: boolean;
}

export interface UseTodoFormOptions {
  title?: string;
  description?: string;
  dueDate?: string;
  waitUntil?: string;
  repeatRule?: RepeatRule;
  recurrenceType?: RecurrenceType;
  customInterval?: number;
  customUnit?: CustomIntervalUnit;
  skipWeekends?: boolean;
}

const getDefaultValues = (): TodoFormValues => ({
  title: '',
  description: '',
  dueDate: getTodayString(),
  waitUntil: '',
  repeatRule: 'NONE',
  recurrenceType: 'DUE_DATE',
  customInterval: 1,
  customUnit: 'MONTH',
  skipWeekends: false,
});

export function useTodoForm(initialValues?: UseTodoFormOptions) {
  const defaults = getDefaultValues();

  const [values, setValues] = useState<TodoFormValues>(() => ({
    ...defaults,
    ...initialValues,
  }));

  const setField = useCallback(
    <K extends keyof TodoFormValues>(field: K, value: TodoFormValues[K]) => {
      setValues((prev) => {
        const newValues = { ...prev, [field]: value };

        // Auto-fill dueDate when waitUntil is set and dueDate is empty
        if (field === 'waitUntil' && !prev.dueDate && value) {
          newValues.dueDate = value as string;
        }

        return newValues;
      });
    },
    []
  );

  const isValid = useMemo(() => {
    return values.title.trim().length > 0;
  }, [values.title]);

  const getData = useCallback((): CreateTodoRequest => {
    const trimmedTitle = values.title.trim();
    const trimmedDescription = values.description.trim();
    const effectiveDueDate = values.dueDate || (values.waitUntil ? values.waitUntil : '');

    return {
      title: trimmedTitle,
      description: trimmedDescription || undefined,
      dueDate: effectiveDueDate || undefined,
      waitUntil: values.waitUntil || undefined,
      repeatRule: values.repeatRule,
      recurrenceType: values.recurrenceType,
      customInterval: values.repeatRule === 'CUSTOM' ? values.customInterval : undefined,
      customUnit: values.repeatRule === 'CUSTOM' ? values.customUnit : undefined,
      skipWeekends: values.skipWeekends,
    };
  }, [values]);

  const reset = useCallback(() => {
    setValues(getDefaultValues());
  }, []);

  return {
    values,
    setField,
    isValid,
    getData,
    reset,
  };
}
